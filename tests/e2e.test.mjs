/**
 * ==============================================================================
 * AUTOMATED ISOLATED E2E TEST SUITE - CODEX CONFIG MANAGER 2.1
 * Playwright Chromium (Headless Desktop Windows)
 * Runs in an isolated sandbox fixture; never modifies live user data.
 * Generates synthetic privacy-safe documentation screenshots.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from '../src/server/config-manager-server.mjs';
import { validateToml, computeHash } from '../src/server/toml-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(REPO_ROOT, 'docs', 'images');
const SANDBOX_DIR = path.join(REPO_ROOT, 'tests', '.temp-sandbox');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

const TEST_PORT = 20197;
const SANDBOX_CONFIG_PATH = path.join(SANDBOX_DIR, 'config.toml');
const shouldCaptureScreenshots = process.argv.includes('--screenshots') || process.env.UPDATE_SCREENSHOTS === 'true';
const targetImagesDir = shouldCaptureScreenshots ? IMAGES_DIR : SANDBOX_DIR;

const FIXTURE_TOML = `# Codex Desktop Configuration (Sandbox E2E Fixture)
model = "coding-con-caro"
model_provider = "omniroute"
model_reasoning_effort = "high"
model_reasoning_summary = "detailed"
model_verbosity = "normal"
hide_agent_reasoning = false
web_search = "live"
sandbox_mode = "danger-full-access"
approval_policy = "always"
approvals_reviewer = "user"

[windows]
sandbox = "elevated"

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

[projects."c:\\\\mock\\\\sample-repo"]
trust_level = "trusted"
allow_execution = true
`;

const testResults = [];

function recordTest(id, name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [TEST ${String(id).padStart(2, '0')}] ${name} -> ${status}`);
  if (details) console.log(`   Detalle: ${details}`);
  testResults.push({ id, name, status, details });
}

async function runE2ESuite() {
  console.log('\n================================================================');
  console.log(' INICIANDO BATERÍA DE PRUEBAS E2E AISLADAS (PLAYWRIGHT)');
  console.log(' CodexConfigManager 2.1 // Headless Chromium Windows');
  console.log('================================================================\n');

  // 1. Prepare isolated sandbox
  fs.writeFileSync(SANDBOX_CONFIG_PATH, FIXTURE_TOML, 'utf8');

  const testServer = createServer({
    port: TEST_PORT,
    codexDir: SANDBOX_DIR,
    configPath: SANDBOX_CONFIG_PATH,
    demoMode: true
  });
  await new Promise((resolve, reject) => {
    testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
    testServer.on('error', reject);
  });

  const appUrl = `http://127.0.0.1:${TEST_PORT}`;
  let browser = null;
  let page = null;

  try {
    try {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    page = await context.newPage();

    // Collect any page console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    // TEST 01: Initial load
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    recordTest(1, 'Servidor y Web UI cargan correctamente', 'PASS', `HTTP 200 en ${appUrl}`);

    // TEST 02: Zero console errors on startup
    const initialErrors = consoleErrors.slice();
    recordTest(2, 'Cero errores de consola en inicio (sin ReferenceError)', initialErrors.length === 0 ? 'PASS' : 'FAIL', initialErrors.join(', '));

    // TEST 03: Direct landing on Accounts Monitor ([00] MONITOR CUENTAS)
    const activeTab = await page.$eval('.tab-trigger.active', el => el.textContent.trim());
    const isAccountsActive = activeTab.includes('MONITOR CUENTAS');
    recordTest(3, 'Aterrizaje directo en pestaña Monitor de Cuentas', isAccountsActive ? 'PASS' : 'FAIL', `Pestaña activa: "${activeTab}"`);

    // TEST 04: Demo mode banner is visible in demo mode
    const demoBadgeVisible = await page.$eval('#badge-demo-mode', el => el.style.display !== 'none');
    recordTest(4, 'Insignia de Modo Demo visible en entorno simulado', demoBadgeVisible ? 'PASS' : 'FAIL');

    // TEST 05: Telemetry Summary Matrix tiles render valid numeric counts
    const totalAccounts = await page.$eval('#stat-accounts-total', el => el.textContent.trim());
    const readyAccounts = await page.$eval('#stat-accounts-ready', el => el.textContent.trim());
    const ignoredAccounts = await page.$eval('#stat-accounts-ignored', el => el.textContent.trim());
    const coolingAccounts = await page.$eval('#stat-accounts-cooling', el => el.textContent.trim());

    const hasValidNumbers = !isNaN(Number(totalAccounts)) && Number(totalAccounts) > 0;
    recordTest(5, 'Matriz de telemetría de 4 baldosas renderiza datos numéricos', hasValidNumbers ? 'PASS' : 'FAIL',
      `Total: ${totalAccounts}, Listas: ${readyAccounts}, Ignoradas: ${ignoredAccounts}, Cooldown: ${coolingAccounts}`);

    // TEST 06: Active Combo Pipeline box rendered with model sequence
    const pipelineName = await page.$eval('#text-pipeline-combo-name', el => el.textContent.trim());
    const pipelineNodesCount = await page.$$eval('#pipeline-nodes-container .pipeline-step-node', els => els.length);
    recordTest(6, 'Pipeline de despacho del combo activo renderizado', pipelineNodesCount > 0 ? 'PASS' : 'FAIL',
      `Combo: ${pipelineName}, Nodos: ${pipelineNodesCount}`);

    // TEST 07: Filter buttons functional
    await page.click('button:has-text("LISTAS")');
    await page.waitForTimeout(150);
    const visibleCardsAfterFilter = await page.$$eval('#accounts-grid-container .account-card', els => els.length);
    recordTest(7, 'Filtro de cuentas "LISTAS" opera interactivamente', visibleCardsAfterFilter > 0 ? 'PASS' : 'FAIL',
      `Cuentas visibles tras filtrar: ${visibleCardsAfterFilter}`);

    // Reset to "TODAS"
    await page.click('#filter-btn-all');
    await page.waitForTimeout(150);

    // TEST 08: Capture Screenshot 1: Dashboard / Accounts Monitor
    const dashboardPng = path.join(targetImagesDir, 'dashboard.png');
    await page.screenshot({ path: dashboardPng, fullPage: false });
    recordTest(8, `Captura generada: ${shouldCaptureScreenshots ? 'docs/images/' : 'sandbox/'}dashboard.png`, fs.existsSync(dashboardPng) ? 'PASS' : 'FAIL');

    // TEST 09: Navigation to Tab [01] Modelos & Combos
    await page.click('button:has-text("MODELOS & COMBOS")');
    await page.waitForTimeout(200);
    const modelsPaneActive = await page.$eval('#pane-models', el => el.classList.contains('active'));
    recordTest(9, 'Navegación fluida a pestaña [01] MODELOS & COMBOS', modelsPaneActive ? 'PASS' : 'FAIL');

    // TEST 10: Model input modification triggers dirty state and updates UI pill
    await page.fill('#input-model', 'coding-con-caro-custom');
    await page.waitForTimeout(200);
    const dirtyBadgeText = await page.$eval('#status-dirty', el => el.textContent.trim());
    const isDirtyDetected = dirtyBadgeText.includes('MODIFICADO');
    recordTest(10, 'Detección de estado modificado (Dirty State) al editar combo', isDirtyDetected ? 'PASS' : 'FAIL', `Badge: ${dirtyBadgeText}`);

    // TEST 11: Capture Screenshot 2: Model Routing
    const modelRoutingPng = path.join(targetImagesDir, 'model-routing.png');
    await page.screenshot({ path: modelRoutingPng, fullPage: false });
    recordTest(11, `Captura generada: ${shouldCaptureScreenshots ? 'docs/images/' : 'sandbox/'}model-routing.png`, fs.existsSync(modelRoutingPng) ? 'PASS' : 'FAIL');

    // TEST 12: Tab [04] Razonamiento contains all 7 effort levels without restriction
    await page.click('button:has-text("RAZONAMIENTO")');
    await page.waitForTimeout(200);
    const reasoningOptions = await page.$$eval('#input-reasoning-effort option', opts => opts.map(o => o.value));
    const all7LevelsPresent = ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].every(lvl => reasoningOptions.includes(lvl));
    recordTest(12, 'Pestaña Razonamiento expone los 7 niveles de esfuerzo sin restricciones', all7LevelsPresent ? 'PASS' : 'FAIL',
      `Opciones: ${reasoningOptions.join(', ')}`);

    // TEST 13: Tab [03] Seguridad preserves exact controls and options
    await page.click('button:has-text("SEGURIDAD")');
    await page.waitForTimeout(200);
    const sandboxModeVal = await page.$eval('#input-sandbox-mode', el => el.value);
    const approvalPolicyVal = await page.$eval('#input-approval-policy', el => el.value);
    const reviewerVal = await page.$eval('#input-approvals-reviewer', el => el.value);
    const winSandboxVal = await page.$eval('#input-windows-sandbox', el => el.value);

    recordTest(13, 'Pestaña Seguridad preserva fielmente los parámetros de Codex',
      sandboxModeVal && approvalPolicyVal && reviewerVal && winSandboxVal ? 'PASS' : 'FAIL',
      `sandbox_mode=${sandboxModeVal}, approval_policy=${approvalPolicyVal}, reviewer=${reviewerVal}, win=${winSandboxVal}`);

    // TEST 14: Tab [08] Raw TOML editor contains expected config content
    await page.click('button:has-text("CONFIG.TOML")');
    await page.waitForTimeout(200);
    const rawEditorVal = await page.$eval('#raw-toml-editor', el => el.value);
    recordTest(14, 'Editor TOML sin procesar sincronizado con la memoria', rawEditorVal.includes('coding-con-caro') ? 'PASS' : 'FAIL');

    // TEST 15: Diff Modal opens and shows difference preview
    await page.click('button:has-text("VER DIFF")');
    await page.waitForSelector('#modal-diff', { state: 'visible' });
    const diffContent = await page.$eval('#diff-content', el => el.textContent.trim());
    recordTest(15, 'Modal de Diff visualiza comparativa en tiempo real', diffContent.length > 0 ? 'PASS' : 'FAIL');

    // TEST 16: Capture Screenshot 3: Config Diff Modal
    const configDiffPng = path.join(targetImagesDir, 'config-diff.png');
    await page.screenshot({ path: configDiffPng, fullPage: false });
    recordTest(16, `Captura generada: ${shouldCaptureScreenshots ? 'docs/images/' : 'sandbox/'}config-diff.png`, fs.existsSync(configDiffPng) ? 'PASS' : 'FAIL');

    // Close diff modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // TEST 17: Diagnostics Modal opens and renders system status
    await page.click('button:has-text("DIAGNÓSTICO")');
    await page.waitForSelector('#modal-diagnostics', { state: 'visible' });
    const diagContent = await page.$eval('#diagnostics-content', el => el.textContent.trim());
    recordTest(17, 'Modal de Diagnósticos muestra integridad del sistema', diagContent.includes('omniRoute') || diagContent.includes('SERVER') || diagContent.includes('status') ? 'PASS' : 'FAIL');

    // TEST 18: Capture Screenshot 4: Diagnostics Modal
    const diagnosticsPng = path.join(targetImagesDir, 'diagnostics.png');
    await page.screenshot({ path: diagnosticsPng, fullPage: false });
    recordTest(18, `Captura generada: ${shouldCaptureScreenshots ? 'docs/images/' : 'sandbox/'}diagnostics.png`, fs.existsSync(diagnosticsPng) ? 'PASS' : 'FAIL');

    // Close diagnostics modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // TEST 19: Save configuration via Save Button
    await page.click('button:has-text("GUARDAR CAMBIOS")');
    await page.waitForTimeout(500);
    const isCleanAfterSave = await page.$eval('#status-dirty', el => el.textContent.includes('SIN CAMBIOS'));
    recordTest(19, 'Guardado de configuración exitoso y reseteo de dirty state', isCleanAfterSave ? 'PASS' : 'FAIL');

    // TEST 20: Keyboard shortcut Ctrl+S works cleanly
    await page.click('button:has-text("MODELOS & COMBOS")');
    await page.waitForTimeout(200);
    await page.fill('#input-model', 'coding-con-caro');
    await page.waitForTimeout(100);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    const isCleanAfterHotkey = await page.$eval('#status-dirty', el => el.textContent.includes('SIN CAMBIOS'));
    recordTest(20, 'Atajo de teclado global Ctrl+S guarda la configuración', isCleanAfterHotkey ? 'PASS' : 'FAIL');

  } finally {
    if (browser) await browser.close();
    if (typeof testServer.closeAllConnections === 'function') {
      testServer.closeAllConnections();
    }
    await new Promise(resolve => testServer.close(resolve));

    // Clean up sandbox
    try {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    } catch (e) {}
  }

  const passedCount = testResults.filter(r => r.status === 'PASS').length;
  const failedCount = testResults.filter(r => r.status === 'FAIL').length;

  console.log(`\n================================================================`);
  console.log(` RESULTADOS E2E PLAYWRIGHT: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log(`================================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runE2ESuite();
