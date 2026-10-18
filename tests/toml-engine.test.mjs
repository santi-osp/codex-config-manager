import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeHash,
  validateToml,
  formatTomlValue,
  extractTrailingComment,
  updateFieldInToml,
  applyBatchUpdates,
  generateDiff
} from '../src/server/toml-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Comprehensive standalone TOML fixture that models a full production Codex configuration
const FIXTURE_TOML = `# Codex Technical Configuration
model = "coding-con-caro"
model_provider = "omniroute"
model_reasoning_effort = "high"
model_reasoning_summary = "detailed"
model_verbosity = "normal"
hide_agent_reasoning = false
web_search = "live"
sandbox_mode = "read-write"
approval_policy = "always"
approvals_reviewer = "user"

[windows]
sandbox = "disabled"

[features]
prevent_idle_sleep = true
write_stdin_approval = false
guardian_approval = false
fast_mode = true
multi_agent = true
in_app_browser = true
shell_tool = true

[desktop]
conversationDetailMode = "detailed"
followUpQueueMode = "queue"
open-link-in-target-preference = "external-browser"
open-local-url-in-target-preference = "in-app-browser"
ambient-suggestions-enabled = true
show-context-window-usage = true
toys-confetti-enabled = false

[model_providers.omniroute]
name = "OmniRoute"
base_url = "http://localhost:20128/v1"
env_key = "OMNIROUTE_API_KEY"
wire_api = "chat"
requires_openai_auth = true

[projects."c:\\\\mock\\\\repos\\\\project-alpha"]
trust_level = "trusted"
allow_execution = true

[projects."c:\\\\mock\\\\repos\\\\project-beta"]
trust_level = "restricted"
allow_execution = false

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "C:\\\\mock\\\\repos"]

[mcp_servers.memory]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-memory"]
`;

async function runTests() {
  console.log('=== PRUEBAS UNITARIAS: TOML ENGINE SURGICAL ROUND-TRIP ===\n');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} - ${details}`);
      failed++;
    }
  }

  // TEST 1: Validación sintáctica del TOML de referencia
  const sampleToml = (process.env.CODEX_CONFIG_PATH && fs.existsSync(process.env.CODEX_CONFIG_PATH))
    ? fs.readFileSync(process.env.CODEX_CONFIG_PATH, 'utf8')
    : FIXTURE_TOML;

  const v1 = validateToml(sampleToml);
  assert('TOML de referencia es sintácticamente válido', v1.valid === true);

  // TEST 2: Preservación quirúrgica: cambiar únicamente `model`
  const updated1 = updateFieldInToml(sampleToml, '', 'model', 'coding-con-caro-test');
  const v2 = validateToml(updated1);
  assert('TOML resultante al cambiar model es válido', v2.valid === true);
  assert('model fue actualizado correctamente', v2.data.model === 'coding-con-caro-test');

  // Verificar que NADA de permisos de Codex cambió
  assert('sandbox_mode se conserva idéntico', v2.data.sandbox_mode === v1.data.sandbox_mode);
  assert('approval_policy se conserva idéntico', v2.data.approval_policy === v1.data.approval_policy);
  assert('approvals_reviewer se conserva idéntico', v2.data.approvals_reviewer === v1.data.approvals_reviewer);
  assert('[windows].sandbox se conserva idéntico', v2.data.windows.sandbox === v1.data.windows.sandbox);

  // Verificar que NADA de razonamiento cambió si no se editó
  assert('model_reasoning_effort se conserva idéntico', v2.data.model_reasoning_effort === v1.data.model_reasoning_effort);
  assert('model_reasoning_summary se conserva idéntico', v2.data.model_reasoning_summary === v1.data.model_reasoning_summary);
  assert('model_verbosity se conserva idéntico', v2.data.model_verbosity === v1.data.model_verbosity);

  // Verificar que las tablas secundarias se preservan intactas
  assert('Todas las tablas [projects.*] se conservan intactas', Object.keys(v2.data.projects || {}).length === Object.keys(v1.data.projects || {}).length);
  assert('Todas las tablas [mcp_servers.*] se conservan intactas', Object.keys(v2.data.mcp_servers || {}).length === Object.keys(v1.data.mcp_servers || {}).length);

  // TEST 3: Soporte para todos los 7 niveles de razonamiento de OmniRoute sin normalización
  const reasoningLevels = ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  for (const lvl of reasoningLevels) {
    const withLvl = updateFieldInToml(sampleToml, '', 'model_reasoning_effort', lvl);
    const vLvl = validateToml(withLvl);
    assert(`Nivel de razonamiento '${lvl}' aceptado y preservado fielmente`, vLvl.valid === true && vLvl.data.model_reasoning_effort === lvl);
  }

  // TEST 4: Cadenas complejas: rutas Windows con barras invertidas, comillas y caracteres especiales
  const testWinPath = 'C:\\mock\\Special Projects\\App #1\\v2.0\\';
  const withPath = updateFieldInToml(sampleToml, 'model_providers.omniroute', 'base_url', testWinPath);
  const vPath = validateToml(withPath);
  assert('Rutas con barras invertidas y espacios se escapan y preservan válidas', vPath.valid === true && vPath.data.model_providers.omniroute.base_url === testWinPath);

  // TEST 5: Actualización por lotes (Batch) sin tocar secciones ajenas
  const batchUpdates = [
    { section: '', key: 'model', value: 'coding-con-caro' },
    { section: '', key: 'model_reasoning_effort', value: 'high' },
    { section: 'features', key: 'code_mode_host', value: true }
  ];
  const batchRes = applyBatchUpdates(sampleToml, batchUpdates);
  const vBatch = validateToml(batchRes);
  assert('Actualización por lote genera TOML válido', vBatch.valid === true);
  assert('Batch actualizó model', vBatch.data.model === 'coding-con-caro');
  assert('Batch actualizó reasoning effort a high', vBatch.data.model_reasoning_effort === 'high');
  assert('Batch actualizó feature code_mode_host a true', vBatch.data.features.code_mode_host === true);

  // TEST 6: Detección y reporte claro de errores sintácticos
  const badToml = sampleToml + '\n\nclave_invalida = "sin cerrar las comillas\n';
  const vBad = validateToml(badToml);
  assert('TOML inválido es detectado correctamente', vBad.valid === false);
  assert('Error incluye mensaje explicativo', typeof vBad.error.message === 'string' && vBad.error.message.length > 0);

  // TEST 7: Diff Generator detecta únicamente las líneas modificadas
  const diff = generateDiff(sampleToml, updated1);
  assert('Diff genera cambios detectables', diff.length > 0);
  assert('Diff detecta la línea de model modificada', diff.some(d => d.content.includes('coding-con-caro-test')));

  // TEST 8: Control de Hash SHA-256 para detección de colisiones externas
  const h1 = computeHash(sampleToml);
  const h2 = computeHash(updated1);
  assert('SHA256 consistente para el mismo archivo', computeHash(sampleToml) === h1);
  assert('SHA256 cambia cuando el contenido varía', h1 !== h2);

  // TEST 9: Helper extractTrailingComment analiza correctamente los comentarios
  assert('Detecta comentario estándar tras valor', extractTrailingComment(' "val" # my comment') === ' # my comment');
  assert('Preserva múltiples espacios previos al comentario', extractTrailingComment(' true   # keep alive') === '   # keep alive');
  assert('Preserva comillas dentro de comentario', extractTrailingComment(' "test" # don\'t touch') === ' # don\'t touch');
  assert('Ignora almohadilla # dentro de cadena entre comillas dobles', extractTrailingComment(' "http://example.com/#anchor"') === '');
  assert('Ignora almohadilla # dentro de comillas simples', extractTrailingComment(" 'val#anchor'") === '');
  assert('Maneja comillas escapadas antes del comentario', extractTrailingComment(' "some \\" quote" # comment') === ' # comment');
  assert('Retorna cadena vacía cuando no hay comentario', extractTrailingComment(' 42') === '');

  // TEST 10: Preservación quirúrgica de comentarios en línea al modificar claves
  const tomlWithComments = [
    '# Top header',
    'model = "coding-con-caro" # modelo preferido de produccion',
    'model_provider = "omniroute"',
    '',
    '[windows]',
    'sandbox = "disabled"   # aislamiento nativo de windows',
    'elevated = true'
  ].join('\n');

  const updatedComments1 = updateFieldInToml(tomlWithComments, '', 'model', 'o3-mini');
  assert('Comentario en línea en clave raíz preservado exactamente',
    updatedComments1.includes('model = "o3-mini" # modelo preferido de produccion'));

  const updatedComments2 = updateFieldInToml(updatedComments1, 'windows', 'sandbox', 'elevated');
  assert('Comentario en línea dentro de sección [windows] preservado con espacios',
    updatedComments2.includes('sandbox = "elevated"   # aislamiento nativo de windows'));

  // TEST 11: Preservación de saltos de línea Windows (CRLF) vs Linux (LF)
  const crlfToml = 'model = "old"\r\nmodel_provider = "omniroute"\r\n';
  const updatedCrlf = updateFieldInToml(crlfToml, '', 'model', 'new');
  assert('Entrada con CRLF preserva CRLF al actualizar', updatedCrlf === 'model = "new"\r\nmodel_provider = "omniroute"\r\n');
  assert('No contiene saltos LF aislados sin retorno de carro', !/[^\r]\n/.test(updatedCrlf));

  const lfToml = 'model = "old"\nmodel_provider = "omniroute"\n';
  const updatedLf = updateFieldInToml(lfToml, '', 'model', 'new');
  assert('Entrada con LF preserva LF al actualizar', updatedLf === 'model = "new"\nmodel_provider = "omniroute"\n');

  // TEST 12: Fidelidad de 0 bytes modificados en líneas no tocadas
  const multiSectionToml = [
    '# Comentario inicial de 6 líneas',
    '# con varias descripciones técnicas',
    'model = "alpha"',
    'model_provider = "omniroute"',
    '',
    '[features]',
    'fast_mode = true',
    'multi_agent = false',
    '',
    '[desktop]',
    'theme = "monochrome"',
    ''
  ].join('\n');

  const afterSingleEdit = updateFieldInToml(multiSectionToml, 'features', 'multi_agent', true);
  const origLines = multiSectionToml.split('\n');
  const newLines = afterSingleEdit.split('\n');
  assert('Misma cantidad de líneas al editar una clave existente', origLines.length === newLines.length);

  let differentLineCount = 0;
  for (let i = 0; i < origLines.length; i++) {
    if (origLines[i] !== newLines[i]) {
      differentLineCount++;
      assert(`Línea modificada es la esperada: ${newLines[i]}`, newLines[i] === 'multi_agent = true');
    }
  }
  assert('Exactamente una línea cambió en todo el documento (0 alteraciones colaterales)', differentLineCount === 1);

  console.log(`\n=== RESULTADOS TOML ENGINE: ${passed} PASSED / ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
