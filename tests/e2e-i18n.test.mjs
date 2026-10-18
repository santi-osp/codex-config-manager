/**
 * ==============================================================================
 * AUTOMATED PLAYWRIGHT E2E i18n TEST SUITE - CODEX CONFIG MANAGER 2.2.0
 * BILINGUAL (ES / EN) DESKTOP UI VERIFICATION
 * Runs in an isolated sandbox fixture with mock server on custom port.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from '../src/server/config-manager-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SANDBOX_DIR = path.join(REPO_ROOT, 'tests', '.temp-sandbox-i18n');
const IMAGES_DIR = path.join(REPO_ROOT, 'docs', 'images');

if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const TEST_PORT = 20198;
const SANDBOX_CONFIG_PATH = path.join(SANDBOX_DIR, 'config.toml');
const shouldCaptureScreenshots = process.argv.includes('--screenshots') || process.env.UPDATE_SCREENSHOTS === 'true';
const targetImagesDir = shouldCaptureScreenshots ? IMAGES_DIR : SANDBOX_DIR;

const FIXTURE_TOML = `# Codex Desktop Configuration (i18n E2E Fixture)
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
`;

const testResults = [];

function recordTest(id, name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [TEST ${String(id).padStart(2, '0')}] ${name} -> ${status}`);
  if (details) console.log(`   Detalle: ${details}`);
  testResults.push({ id, name, status, details });
}

async function runE2EI18nSuite() {
  console.log('\n================================================================');
  console.log(' INICIANDO BATERÍA DE PRUEBAS E2E i18n BILINGÜE (PLAYWRIGHT)');
  console.log(' CodexConfigManager 2.2.0 // Headless Chromium Windows');
  console.log('================================================================\n');

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
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };

    try {
      browser = await chromium.launch(launchOptions);
    } catch {
      browser = await chromium.launch({ ...launchOptions, channel: 'msedge' });
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    // -------------------------------------------------------------
    // TEST 01: Initial load defaults strictly to Spanish
    // -------------------------------------------------------------
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.lang-selector', { state: 'visible', timeout: 15000 });

    const htmlLang = await page.$eval('html', el => el.getAttribute('lang'));
    recordTest(1, 'Carga inicial establece <html lang="es"> por defecto', htmlLang === 'es' ? 'PASS' : 'FAIL', `lang="${htmlLang}"`);

    // -------------------------------------------------------------
    // TEST 02: Language selector buttons state on initial load
    // -------------------------------------------------------------
    const esActive = await page.$eval('#btn-lang-es', el => el.classList.contains('active') && el.getAttribute('aria-pressed') === 'true');
    const enInactive = await page.$eval('#btn-lang-en', el => !el.classList.contains('active') && el.getAttribute('aria-pressed') === 'false');
    recordTest(2, 'Selector refleja ES activo y EN inactivo con atributos ARIA', esActive && enInactive ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 03: Navigation tabs in Spanish
    // -------------------------------------------------------------
    const tab0Text = await page.$eval('.tab-trigger:nth-child(1) .tab-text', el => el.textContent.trim());
    const tab1Text = await page.$eval('.tab-trigger:nth-child(2) .tab-text', el => el.textContent.trim());
    const tab3Text = await page.$eval('.tab-trigger:nth-child(4) .tab-text', el => el.textContent.trim());
    const isSpanishTabs = tab0Text === 'MONITOR CUENTAS' && tab1Text === 'MODELOS & COMBOS' && tab3Text === 'SEGURIDAD';
    recordTest(3, 'Pestañas de navegación renderizan en Español', isSpanishTabs ? 'PASS' : 'FAIL', `${tab0Text} | ${tab1Text} | ${tab3Text}`);

    // -------------------------------------------------------------
    // TEST 04: Header actions in Spanish
    // -------------------------------------------------------------
    const saveBtnText = await page.$eval('header .btn-solid-dark span', el => el.textContent.trim());
    const diffBtnText = await page.$eval('#btn-open-diff span', el => el.textContent.trim());
    recordTest(4, 'Botones principales del header en Español', saveBtnText === 'GUARDAR CAMBIOS' && diffBtnText === 'VER DIFF' ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 05: Accounts summary matrix in Spanish
    // -------------------------------------------------------------
    const statTotalLabel = await page.$eval('.account-stat-card:nth-child(1) .account-stat-label', el => el.textContent.trim());
    const statReadyLabel = await page.$eval('.account-stat-card:nth-child(2) .account-stat-label', el => el.textContent.trim());
    recordTest(5, 'Matriz de 4 baldosas de telemetría en Español', statTotalLabel === 'TOTAL CUENTAS CONECTADAS' && statReadyLabel === 'LISTAS PARA DESPACHO' ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 06: Zero console errors on startup
    // -------------------------------------------------------------
    const criticalErrors = consoleErrors.filter(err => !err.includes('fonts.g') && !err.includes('favicon'));
    recordTest(6, 'Cero errores de consola en arranque con i18n activo', criticalErrors.length === 0 ? 'PASS' : 'FAIL', criticalErrors.join(', '));

    // -------------------------------------------------------------
    // TEST 07: Live switch to English without page reload
    // -------------------------------------------------------------
    let navigationOccurred = false;
    page.on('framenavigated', () => { navigationOccurred = true; });

    await page.click('#btn-lang-en');
    await page.waitForTimeout(100);

    const htmlLangEn = await page.$eval('html', el => el.getAttribute('lang'));
    const enNowActive = await page.$eval('#btn-lang-en', el => el.classList.contains('active') && el.getAttribute('aria-pressed') === 'true');
    const esNowInactive = await page.$eval('#btn-lang-es', el => !el.classList.contains('active') && el.getAttribute('aria-pressed') === 'false');

    recordTest(7, 'Cambio instantáneo a EN sin recarga de página',
      !navigationOccurred && htmlLangEn === 'en' && enNowActive && esNowInactive ? 'PASS' : 'FAIL',
      `Reloaded: ${navigationOccurred}, lang="${htmlLangEn}"`);

    // -------------------------------------------------------------
    // TEST 08: Navigation tabs translated to English
    // -------------------------------------------------------------
    const tab0TextEn = await page.$eval('.tab-trigger:nth-child(1) .tab-text', el => el.textContent.trim());
    const tab1TextEn = await page.$eval('.tab-trigger:nth-child(2) .tab-text', el => el.textContent.trim());
    const tab3TextEn = await page.$eval('.tab-trigger:nth-child(4) .tab-text', el => el.textContent.trim());
    const isEnTabs = tab0TextEn === 'ACCOUNTS MONITOR' && tab1TextEn === 'MODELS & COMBOS' && tab3TextEn === 'SECURITY';
    recordTest(8, 'Pestañas de navegación traducidas inmediatamente a Inglés', isEnTabs ? 'PASS' : 'FAIL', `${tab0TextEn} | ${tab1TextEn} | ${tab3TextEn}`);

    // -------------------------------------------------------------
    // TEST 09: Header buttons translated to English
    // -------------------------------------------------------------
    const saveBtnTextEn = await page.$eval('header .btn-solid-dark span', el => el.textContent.trim());
    const diffBtnTextEn = await page.$eval('#btn-open-diff span', el => el.textContent.trim());
    const retestBtnTextEn = await page.$eval('#label-retest-connections', el => el.textContent.trim());
    recordTest(9, 'Botones de acción del header traducidos a Inglés',
      saveBtnTextEn === 'SAVE CHANGES' && diffBtnTextEn === 'VIEW DIFF' && retestBtnTextEn === 'FORCE RE-TEST ACCOUNTS' ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 10: Telemetry strip translated to English
    // -------------------------------------------------------------
    const dirtyTextEn = await page.$eval('#status-dirty span:nth-child(2)', el => el.textContent.trim());
    const systemReadyTextEn = await page.$eval('[data-i18n="telemetry.system_ready"]', el => el.textContent.trim());
    recordTest(10, 'Franja de telemetría superior traducida a Inglés',
      dirtyTextEn === 'NO CHANGES' && systemReadyTextEn === 'SYSTEM: READY' ? 'PASS' : 'FAIL',
      `Dirty: "${dirtyTextEn}", System: "${systemReadyTextEn}"`);

    // -------------------------------------------------------------
    // TEST 11: Accounts summary tiles translated to English
    // -------------------------------------------------------------
    const statTotalEn = await page.$eval('.account-stat-card:nth-child(1) .account-stat-label', el => el.textContent.trim());
    const statReadyEn = await page.$eval('.account-stat-card:nth-child(2) .account-stat-label', el => el.textContent.trim());
    const statIgnoredEn = await page.$eval('.account-stat-card:nth-child(3) .account-stat-label', el => el.textContent.trim());
    recordTest(11, 'Matriz de 4 baldosas de telemetría traducida a Inglés',
      statTotalEn === 'TOTAL CONNECTED ACCOUNTS' && statReadyEn === 'READY FOR DISPATCH' && statIgnoredEn === 'IGNORED / QUOTA EXHAUSTED' ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 12: Pipeline execution sequence box in English
    // -------------------------------------------------------------
    const pipelineTagEn = await page.$eval('[data-i18n="pipeline.spec_tag"]', el => el.textContent.trim());
    const activeTargetPillEn = await page.$eval('.pipeline-step-node.active-first', el => el.textContent);
    recordTest(12, 'Pipeline de despacho y nodo activo en Inglés',
      pipelineTagEn.length > 0 && activeTargetPillEn.includes('CURRENT ACTIVE TARGET') ? 'PASS' : 'FAIL');

    // Capture English Dashboard Screenshot
    const dashboardEnPng = path.join(targetImagesDir, 'dashboard-en.png');
    await page.screenshot({ path: dashboardEnPng, fullPage: false });

    // -------------------------------------------------------------
    // TEST 13: Account cards rendered with English badges & specs
    // -------------------------------------------------------------
    const cardBadgeText = await page.$eval('.account-card.ready .account-verdict-badge', el => el.textContent.trim());
    const cardReasonHeader = await page.$eval('.account-card.ready .account-reason-box strong', el => el.textContent.trim());
    const cardSpecHealth = await page.$eval('.account-card.ready .telemetry-spec-row:nth-child(1) span', el => el.textContent.trim());
    recordTest(13, 'Tarjetas de cuentas muestran badges, headers y specs en Inglés',
      cardBadgeText === 'READY FOR COMBO' && cardReasonHeader === 'OPERATIONAL STATUS:' && cardSpecHealth === 'HEALTH:' ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 14: Filter buttons translated and functional
    // -------------------------------------------------------------
    const filterAllText = await page.$eval('#filter-btn-all', el => el.textContent.trim());
    const filterReadyText = await page.$eval('#filter-btn-ready', el => el.textContent.trim());
    await page.click('#filter-btn-ready');
    await page.waitForTimeout(100);
    const visibleCardsEn = await page.$$eval('#accounts-grid-container .account-card', els => els.length);
    recordTest(14, 'Filtros de cuentas traducidos (ALL, READY) y operativos',
      filterAllText.includes('ALL') && filterReadyText.includes('READY') && visibleCardsEn > 0 ? 'PASS' : 'FAIL');

    // Reset filter
    await page.click('#filter-btn-all');

    // -------------------------------------------------------------
    // TEST 15: LocalStorage persistence across page reloads
    // -------------------------------------------------------------
    const persistedLang = await page.evaluate(() => localStorage.getItem('codex-config-manager:ui-language'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lang-selector', { state: 'visible' });

    const htmlLangAfterReload = await page.$eval('html', el => el.getAttribute('lang'));
    const enActiveAfterReload = await page.$eval('#btn-lang-en', el => el.classList.contains('active'));
    recordTest(15, 'Preferencia de idioma persistida en localStorage tras F5',
      persistedLang === 'en' && htmlLangAfterReload === 'en' && enActiveAfterReload ? 'PASS' : 'FAIL',
      `localStorage=${persistedLang}, html.lang=${htmlLangAfterReload}`);

    // -------------------------------------------------------------
    // TEST 16: Navigation to Tab [04] Reasoning with 7 levels in English
    // -------------------------------------------------------------
    await page.click('button:has-text("REASONING")');
    await page.waitForTimeout(150);
    const reasoningOptionText = await page.$eval('#input-reasoning-effort option[value="ultra"]', el => el.textContent.trim());
    recordTest(16, 'Pestaña Razonamiento traduce descripciones sin alterar valores',
      reasoningOptionText.includes('Ultra with auto-delegation') ? 'PASS' : 'FAIL',
      `Option text: "${reasoningOptionText}"`);

    // -------------------------------------------------------------
    // TEST 17: Tab [03] Security translates option descriptions preserving values
    // -------------------------------------------------------------
    await page.click('button:has-text("SECURITY")');
    await page.waitForTimeout(150);
    const sandboxOptText = await page.$eval('#input-sandbox-mode option[value="danger-full-access"]', el => el.textContent.trim());
    const approvalOptText = await page.$eval('#input-approval-policy option[value="never"]', el => el.textContent.trim());
    recordTest(17, 'Pestaña Seguridad traduce descripciones preservando opciones de Codex',
      sandboxOptText.includes('No terminal or disk restrictions') && approvalOptText.includes('Autonomous execution without interruption') ? 'PASS' : 'FAIL');

    // -------------------------------------------------------------
    // TEST 18: Unsaved changes (Dirty state) preserved when toggling language
    // -------------------------------------------------------------
    await page.click('button:has-text("MODELS & COMBOS")');
    await page.waitForTimeout(150);
    await page.fill('#input-model', 'coding-con-caro-i18n-test');
    await page.waitForTimeout(100);

    // Switch back to ES
    await page.click('#btn-lang-es');
    await page.waitForTimeout(100);

    const modelInputVal = await page.$eval('#input-model', el => el.value);
    const dirtyBadgeEs = await page.$eval('#status-dirty', el => el.textContent.trim());
    recordTest(18, 'Estado modificado (isDirty) e input preservados al alternar idioma',
      modelInputVal === 'coding-con-caro-i18n-test' && dirtyBadgeEs.includes('MODIFICADO (SIN GUARDAR)') ? 'PASS' : 'FAIL',
      `Input: "${modelInputVal}", Dirty: "${dirtyBadgeEs}"`);

    // -------------------------------------------------------------
    // TEST 19: Diff Modal opens and renders localized content
    // -------------------------------------------------------------
    await page.click('#btn-open-diff');
    await page.waitForSelector('#modal-diff', { state: 'visible' });
    const diffTitle = await page.$eval('#modal-diff .modal-header span', el => el.textContent.trim());
    recordTest(19, 'Modal de Diff se visualiza con encabezado en Español',
      diffTitle.includes('[DIFF] COMPARACIÓN DE CAMBIOS') ? 'PASS' : 'FAIL');

    // Switch language to EN while modal is open (via API to test modal responsiveness)
    await page.evaluate(() => window.setLanguage('en'));
    await page.waitForTimeout(100);
    const diffTitleEn = await page.$eval('#modal-diff .modal-header span', el => el.textContent.trim());
    const isModalStillOpen = await page.$eval('#modal-diff', el => el.classList.contains('active'));
    recordTest(20, 'Modal permanece abierto y traduce su contenido al alternar idioma',
      isModalStillOpen && diffTitleEn.includes('[DIFF] COMPARISON OF CHANGES') ? 'PASS' : 'FAIL');

    // Close diff modal
    await page.click('#modal-diff .modal-footer button:has-text("CLOSE")');
    await page.waitForSelector('#modal-diff', { state: 'hidden' });

    // -------------------------------------------------------------
    // TEST 21: Diagnostics modal translated in English
    // -------------------------------------------------------------
    await page.click('#btn-open-diagnostics');
    await page.waitForSelector('#modal-diagnostics', { state: 'visible' });
    await page.waitForSelector('#diagnostics-content .diag-grid', { timeout: 10000 });
    const diagCardTitle = await page.$eval('#diagnostics-content .diag-card:nth-child(1) h4', el => el.textContent.trim());
    recordTest(21, 'Modal de Diagnósticos renderiza tarjetas traducidas a Inglés',
      diagCardTitle === 'LOCAL SERVER' ? 'PASS' : 'FAIL', `Card title: "${diagCardTitle}"`);

    // Close diagnostics modal
    await page.click('#modal-diagnostics .modal-footer button:has-text("CLOSE")');
    await page.waitForSelector('#modal-diagnostics', { state: 'hidden' });

    // -------------------------------------------------------------
    // TEST 22: Keyboard accessibility (Space/Enter on language button)
    // -------------------------------------------------------------
    await page.focus('#btn-lang-es');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const esActiveViaKeyboard = await page.$eval('#btn-lang-es', el => el.classList.contains('active'));
    recordTest(22, 'Accesibilidad por teclado: selección de idioma mediante Enter', esActiveViaKeyboard ? 'PASS' : 'FAIL');

  } catch (err) {
    console.error('\n❌ ERROR INESPERADO EN EJECUCIÓN E2E i18n:', err);
    recordTest(99, 'Ejecución completa de suite E2E i18n', 'FAIL', err.message);
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => testServer.close(resolve)).catch(() => {});
    try {
      if (fs.existsSync(SANDBOX_DIR)) {
        fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
      }
    } catch {}
  }

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;

  console.log('\n================================================================');
  console.log(` RESULTADOS E2E i18n PLAYWRIGHT: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2EI18nSuite();
