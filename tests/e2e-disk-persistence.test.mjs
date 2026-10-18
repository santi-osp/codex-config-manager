/**
 * ==============================================================================
 * REAL ISOLATED DISK PERSISTENCE & RECOVERY E2E TEST SUITE
 * Codex Config Manager 2.1.1
 * Runs against a real temporary directory on disk (os.tmpdir()).
 * Proves atomic write, backup generation, SHA-256 conflict detection (409),
 * syntax validation gate (400), SQLite thread synchronization, and restore.
 * Never touches actual user data.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from '../src/server/config-manager-server.mjs';
import { computeHash, updateFieldInToml } from '../src/server/toml-engine.mjs';

let DatabaseSync = null;
try {
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch (e) {
  // node:sqlite optional / version dependent
}

const TEST_PORT = 20195;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const INITIAL_FIXTURE_TOML = [
  '# Codex Desktop Configuration (Isolated Real Disk E2E)',
  'model = "coding-con-caro" # default model',
  'model_provider = "omniroute"',
  'model_reasoning_effort = "high"',
  'model_reasoning_summary = "detailed"',
  'model_verbosity = "normal"',
  'hide_agent_reasoning = false',
  'web_search = "live"',
  'sandbox_mode = "danger-full-access"',
  'approval_policy = "always"',
  'approvals_reviewer = "user"',
  '',
  '[windows]',
  'sandbox = "elevated" # windows container isolation',
  '',
  '[features]',
  'fast_mode = true',
  'multi_agent = true',
  '',
  '[desktop]',
  'conversationDetailMode = "detailed"',
  ''
].join('\r\n');

async function runDiskPersistenceSuite() {
  console.log('\n================================================================');
  console.log(' INICIANDO BATERÍA E2E DE PERSISTENCIA REAL EN DISCO');
  console.log(' CodexConfigManager 2.1.1 // Entorno Aislado Temporal');
  console.log('================================================================\n');

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

  // 1. Create unique isolated temporary directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-disk-e2e-'));
  const configPath = path.join(tempDir, 'config.toml');
  const stateDbPath = path.join(tempDir, 'state_5.sqlite');

  fs.writeFileSync(configPath, INITIAL_FIXTURE_TOML, 'utf8');

  // Optional: create isolated SQLite state db
  if (DatabaseSync) {
    try {
      const db = new DatabaseSync(stateDbPath);
      db.exec(`
        CREATE TABLE threads (
          id TEXT PRIMARY KEY,
          model TEXT,
          model_provider TEXT,
          archived INTEGER DEFAULT 0,
          updated_at_ms INTEGER
        );
        INSERT INTO threads (id, model, model_provider, archived, updated_at_ms)
        VALUES ('thread-1', 'codex', 'openai', 0, 1000);
      `);
      db.close();
    } catch (e) {
      console.warn('[E2E Disk] Aviso inicializando SQLite simulado:', e.message);
    }
  }

  // 2. Start server with explicit dependency injection pointing to tempDir
  const server = createServer({
    port: TEST_PORT,
    codexDir: tempDir,
    configPath,
    stateDbPath,
    demoMode: false
  });

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  let initialHash = '';
  let backupCreatedPath = '';

  try {
    // TEST 1: GET /api/config reads real disk file and returns accurate SHA-256
    const getRes = await fetch(`${BASE_URL}/api/config`);
    assert('GET /api/config responde HTTP 200 OK', getRes.status === 200);
    const getData = await getRes.json();
    initialHash = getData.hash;
    assert('GET /api/config retorna el contenido exacto de disco', getData.toml === INITIAL_FIXTURE_TOML);
    assert('GET /api/config calcula el SHA256 correcto', getData.hash === computeHash(INITIAL_FIXTURE_TOML));
    assert('GET /api/config reporta la ruta del archivo de prueba', getData.path === configPath);

    // TEST 2: POST /api/config/preview-diff generates real diff against disk without writing
    const diffToml = updateFieldInToml(INITIAL_FIXTURE_TOML, '', 'model', 'o3-mini');
    const diffRes = await fetch(`${BASE_URL}/api/config/preview-diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toml: diffToml })
    });
    assert('POST /api/config/preview-diff responde HTTP 200 OK', diffRes.status === 200);
    const diffData = await diffRes.json();
    assert('preview-diff valida sintaxis como correcta', diffData.valid === true);
    assert('preview-diff detecta las líneas modificadas', diffData.diff.some(d => d.content.includes('o3-mini')));

    // Verify disk was NOT touched by preview-diff
    assert('preview-diff no modificó el archivo en disco', fs.readFileSync(configPath, 'utf8') === INITIAL_FIXTURE_TOML);

    // TEST 3: POST /api/config (Atomic Save) with valid expectedHash
    const saveToml = updateFieldInToml(INITIAL_FIXTURE_TOML, '', 'model', 'o3-mini');
    const saveRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toml: saveToml,
        expectedHash: initialHash
      })
    });
    assert('Guardado atómico responde HTTP 200 OK', saveRes.status === 200);
    const saveData = await saveRes.json();
    assert('Respuesta confirma éxito en guardado', saveData.success === true);
    assert('Respuesta incluye ruta del backup creado', typeof saveData.backupPath === 'string');
    backupCreatedPath = saveData.backupPath;

    // Verify disk content after atomic save
    const diskAfterSave = fs.readFileSync(configPath, 'utf8');
    assert('Archivo en disco fue actualizado con el nuevo modelo', diskAfterSave.includes('model = "o3-mini"'));
    assert('Preservó comentario en línea del modelo (# default model)', diskAfterSave.includes('model = "o3-mini" # default model'));
    assert('Preservó saltos de línea CRLF en disco', diskAfterSave.includes('\r\n') && !/[^\r]\n/.test(diskAfterSave));

    // Verify backup file was physically created
    assert('Archivo de backup existe físicamente en el directorio', fs.existsSync(backupCreatedPath));
    assert('Backup contiene el contenido previo original', fs.readFileSync(backupCreatedPath, 'utf8') === INITIAL_FIXTURE_TOML);

    // Verify SQLite active thread synchronization if sqlite is available
    if (DatabaseSync && fs.existsSync(stateDbPath)) {
      try {
        const db = new DatabaseSync(stateDbPath);
        const thread = db.prepare("SELECT model, model_provider FROM threads WHERE id = 'thread-1'").get();
        assert('SQLite sincronizó hilo activo a o3-mini', thread.model === 'o3-mini' && thread.model_provider === 'omniroute');
        db.close();
      } catch (e) {
        console.warn('Aviso comprobando SQLite:', e.message);
      }
    }

    // TEST 4: POST /api/config (Conflict Detection HTTP 409)
    // Attempt to save using initialHash (which is now stale)
    const conflictRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toml: updateFieldInToml(diskAfterSave, '', 'model', 'claude-3-7-sonnet'),
        expectedHash: initialHash // STALE!
      })
    });
    assert('Detección de colisión externa retorna HTTP 409 Conflict', conflictRes.status === 409);
    const conflictData = await conflictRes.json();
    assert('Respuesta de colisión contiene flag conflict: true', conflictData.conflict === true);
    assert('Respuesta de colisión reporta expectedHash y currentHash', conflictData.expectedHash === initialHash && conflictData.currentHash === saveData.hash);

    // Verify disk was NOT modified on 409
    assert('Disco permanece intacto tras 409 Conflict', fs.readFileSync(configPath, 'utf8') === diskAfterSave);

    // TEST 5: POST /api/config (Invalid TOML Gate HTTP 400)
    const invalidRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toml: 'clave_rota = "sin comilla de cierre\n',
        expectedHash: saveData.hash
      })
    });
    assert('Sintaxis TOML rota rechazada con HTTP 400 Bad Request', invalidRes.status === 400);
    const invalidData = await invalidRes.json();
    assert('Respuesta incluye mensaje descriptivo de sintaxis protegida', invalidData.error.includes('inválida'));

    // Verify disk was NOT modified on 400
    assert('Disco protegido intacto tras rechazo de sintaxis inválida', fs.readFileSync(configPath, 'utf8') === diskAfterSave);

    // TEST 6: GET /api/config/backups lists backups on disk
    const backupsRes = await fetch(`${BASE_URL}/api/config/backups`);
    assert('GET /api/config/backups responde HTTP 200 OK', backupsRes.status === 200);
    const backupsData = await backupsRes.json();
    assert('Lista de backups contiene el backup recién creado', backupsData.backups.some(b => b.name === path.basename(backupCreatedPath)));

    // TEST 7: POST /api/config/restore-backup restores previous version
    const restoreRes = await fetch(`${BASE_URL}/api/config/restore-backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupName: path.basename(backupCreatedPath) })
    });
    assert('POST /api/config/restore-backup responde HTTP 200 OK', restoreRes.status === 200);
    const restoreData = await restoreRes.json();
    assert('Restauración confirma éxito', restoreData.success === true);

    // Verify disk content after restore matches INITIAL_FIXTURE_TOML
    const diskAfterRestore = fs.readFileSync(configPath, 'utf8');
    assert('Disco restaurado contiene el contenido original inicial', diskAfterRestore === INITIAL_FIXTURE_TOML);

  } finally {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise(resolve => server.close(resolve));

    // Cleanup temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log(`\n=== RESULTADOS E2E DISK PERSISTENCE: ${passed} PASSED / ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runDiskPersistenceSuite();
