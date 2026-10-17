import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import {
  computeHash,
  validateToml,
  generateDiff
} from './toml-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// Configurable ports & paths (portable across systems & test sandboxes)
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 20129;
const USER_HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
export const CODEX_DIR = process.env.CODEX_DIR || path.join(USER_HOME, '.codex');
export const CONFIG_PATH = process.env.CODEX_CONFIG_PATH || path.join(CODEX_DIR, 'config.toml');
export const STATE_DB_PATH = process.env.CODEX_STATE_DB_PATH || path.join(CODEX_DIR, 'state_5.sqlite');
const APPDATA_ROAMING = process.env.APPDATA || path.join(USER_HOME, 'AppData', 'Roaming');
export const OMNIROUTE_DB_PATH = process.env.OMNIROUTE_DB_PATH || path.join(APPDATA_ROAMING, 'omniroute', 'storage.sqlite');
export const OMNIROUTE_URL = process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128';

const WEB_DIR = path.resolve(__dirname, '../web');
const HTML_PATH = path.join(WEB_DIR, 'index.html');
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

/**
 * Checks whether the current request or runtime environment is in Demo Mode.
 */
export function isDemoMode(req, url) {
  if (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1') return true;
  if (url && (url.searchParams.get('demo') === '1' || url.searchParams.get('demo') === 'true')) return true;
  if (req && (req.headers['x-demo-mode'] === '1' || req.headers['x-demo-mode'] === 'true')) return true;
  return false;
}

/**
 * Synthetic Demo Data (100% fictional fixtures for public demos & CI tests)
 */
export const SYNTHETIC_DEMO_CONFIG_TOML = `# Codex Desktop Configuration (Demo Sandbox)
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

export function getSyntheticDemoAccounts() {
  const now = Date.now();
  const reset5h = new Date(now + 4 * 3600 * 1000).toISOString();
  const reset7d = new Date(now + 5 * 86400 * 1000).toISOString();

  const connections = [
    {
      id: 'conn-caro-primary',
      provider: 'openai',
      name: 'demo-caro@matrix.internal',
      email: 'demo-caro@matrix.internal',
      auth_type: 'oauth',
      priority: 10,
      is_active: true,
      test_status: 'ok',
      last_tested: new Date(now - 120000).toISOString(),
      last_error: null,
      circuit_breaker: { state: 'CLOSED', failure_count: 0 },
      is_cooling: false,
      cooling_remaining_seconds: 0,
      rate_limited_until: null,
      quota: {
        usage5h: 18,
        limit5h: 100,
        resetAt5h: reset5h,
        usage7d: 32,
        limit7d: 100,
        resetAt7d: reset7d
      },
      evaluation: {
        willIgnore: false,
        badge: 'LISTA PARA EL COMBO',
        reason: 'Conexión activa, disyuntor cerrado y credenciales validadas.',
        level: 'ok'
      }
    },
    {
      id: 'conn-gemini-pro',
      provider: 'google',
      name: 'demo-gemini@matrix.internal',
      email: 'demo-gemini@matrix.internal',
      auth_type: 'api_key',
      priority: 8,
      is_active: true,
      test_status: 'ok',
      last_tested: new Date(now - 300000).toISOString(),
      last_error: null,
      circuit_breaker: { state: 'CLOSED', failure_count: 0 },
      is_cooling: false,
      cooling_remaining_seconds: 0,
      rate_limited_until: null,
      quota: {
        usage5h: 54,
        limit5h: 100,
        resetAt5h: reset5h,
        usage7d: 70,
        limit7d: 100,
        resetAt7d: reset7d
      },
      evaluation: {
        willIgnore: false,
        badge: 'LISTA PARA EL COMBO',
        reason: 'Conexión activa, disyuntor cerrado y credenciales validadas.',
        level: 'ok'
      }
    },
    {
      id: 'conn-claude-fast',
      provider: 'anthropic',
      name: 'demo-claude@matrix.internal',
      email: 'demo-claude@matrix.internal',
      auth_type: 'api_key',
      priority: 6,
      is_active: true,
      test_status: 'ok',
      last_tested: new Date(now - 60000).toISOString(),
      last_error: 'HTTP 429: Too Many Requests',
      circuit_breaker: { state: 'HALF_OPEN', failure_count: 1 },
      is_cooling: true,
      cooling_remaining_seconds: 45,
      rate_limited_until: new Date(now + 45000).toISOString(),
      quota: {
        usage5h: 98,
        limit5h: 100,
        resetAt5h: reset5h,
        usage7d: 82,
        limit7d: 100,
        resetAt7d: reset7d
      },
      evaluation: {
        willIgnore: true,
        badge: 'ENFRIAMIENTO (45s)',
        reason: 'Rate-limited (HTTP 429). En enfriamiento.',
        level: 'warn'
      }
    },
    {
      id: 'conn-deepseek-backup',
      provider: 'deepseek',
      name: 'demo-deepseek@matrix.internal',
      email: 'demo-deepseek@matrix.internal',
      auth_type: 'api_key',
      priority: 3,
      is_active: true,
      test_status: 'error',
      last_tested: new Date(now - 900000).toISOString(),
      last_error: 'Conexión interrumpida por el gateway',
      circuit_breaker: { state: 'OPEN', failure_count: 5 },
      is_cooling: false,
      cooling_remaining_seconds: 0,
      rate_limited_until: null,
      quota: null,
      evaluation: {
        willIgnore: true,
        badge: 'DISYUNTOR ABIERTO',
        reason: 'Circuit Breaker abierto (5 fallos consecutivos).',
        level: 'error'
      }
    }
  ];

  const combos = [
    {
      id: 'combo-caro',
      name: 'coding-con-caro',
      strategy: 'priority',
      models: [
        {
          id: 'm1',
          model: 'o3-mini',
          providerId: 'openai',
          connectionId: 'conn-caro-primary',
          label: 'Primary Caro o3-mini',
          connection: connections[0],
          willIgnore: false,
          statusBadge: 'LISTA PARA EL COMBO',
          level: 'ok'
        },
        {
          id: 'm2',
          model: 'gemini-2.5-pro',
          providerId: 'google',
          connectionId: 'conn-gemini-pro',
          label: 'Fallback Gemini Pro',
          connection: connections[1],
          willIgnore: false,
          statusBadge: 'LISTA PARA EL COMBO',
          level: 'ok'
        },
        {
          id: 'm3',
          model: 'claude-3-7-sonnet',
          providerId: 'anthropic',
          connectionId: 'conn-claude-fast',
          label: 'Cooldown Sonnet',
          connection: connections[2],
          willIgnore: true,
          statusBadge: 'ENFRIAMIENTO (45s)',
          level: 'warn'
        }
      ]
    },
    {
      id: 'combo-review',
      name: 'codex-auto-review',
      strategy: 'round_robin',
      models: [
        {
          id: 'm4',
          model: 'o3-mini',
          providerId: 'openai',
          connectionId: 'conn-caro-primary',
          label: 'Caro Reviewer',
          connection: connections[0],
          willIgnore: false,
          statusBadge: 'LISTA PARA EL COMBO',
          level: 'ok'
        }
      ]
    }
  ];

  return {
    accounts: connections,
    connections,
    combos,
    summary: { total: connections.length, ready: 2, ignored: 2 },
    timestamp: new Date().toISOString(),
    demoMode: true
  };
}

/**
 * Retrieves the OmniRoute API key securely.
 * Priority:
 * 1. process.env.OMNIROUTE_API_KEY
 * 2. OmniRoute local sqlite storage
 * Returns null if unavailable; NEVER falls back to hardcoded secrets.
 */
export function getOmniRouteApiKey() {
  if (process.env.OMNIROUTE_API_KEY) {
    return process.env.OMNIROUTE_API_KEY;
  }
  try {
    if (fs.existsSync(OMNIROUTE_DB_PATH)) {
      const db = new DatabaseSync(OMNIROUTE_DB_PATH);
      db.exec('PRAGMA busy_timeout = 3000;');
      const row = db.prepare('SELECT key FROM api_keys WHERE is_active = 1 LIMIT 1').get();
      if (row && row.key) return row.key;
    }
  } catch (e) {
    console.warn('[Server] Error leyendo API key de OmniRoute:', e.message);
  }
  return null;
}

/**
 * Pure read-only telemetry reader.
 * DOES NOT mutate database records on GET requests.
 */
export function getOmniRouteAccountsData() {
  if (!fs.existsSync(OMNIROUTE_DB_PATH)) {
    return { error: 'OmniRoute database no encontrada', connections: [], combos: [], summary: { total: 0, ready: 0, ignored: 0 } };
  }

  try {
    const db = new DatabaseSync(OMNIROUTE_DB_PATH);
    db.exec('PRAGMA busy_timeout = 3000;');
    const rawConns = db.prepare('SELECT * FROM provider_connections').all();
    const rawCbs = db.prepare('SELECT * FROM domain_circuit_breakers').all();
    const rawCombos = db.prepare('SELECT id, name, data FROM combos').all();

    const now = Date.now();
    const connections = rawConns.map(conn => {
      const cb = rawCbs.find(c => c.name.includes(conn.id) || c.name === conn.provider);
      const cbState = cb ? cb.state : 'CLOSED';
      const cbFailures = cb ? cb.failure_count : 0;

      let isCooling = false;
      let coolingRemainingSec = 0;
      if (conn.rate_limited_until) {
        const untilMs = new Date(conn.rate_limited_until).getTime();
        if (untilMs > now) {
          isCooling = true;
          coolingRemainingSec = Math.round((untilMs - now) / 1000);
        }
      }

      let quota = null;
      if (conn.provider_specific_data) {
        try {
          const psd = JSON.parse(conn.provider_specific_data);
          const qScope = psd.codexQuotaStateByScope?.codex;
          if (qScope) {
            quota = {
              usage5h: qScope.usage5h ?? 0,
              limit5h: qScope.limit5h ?? 100,
              resetAt5h: qScope.resetAt5h ?? null,
              usage7d: qScope.usage7d ?? 0,
              limit7d: qScope.limit7d ?? 100,
              resetAt7d: qScope.resetAt7d ?? null
            };
          }
        } catch (e) {}
      }

      let willIgnore = false;
      let badge = 'LISTA PARA EL COMBO';
      let reason = 'Conexión activa, disyuntor cerrado y credenciales validadas.';
      let level = 'ok';

      if (!conn.is_active) {
        willIgnore = true;
        badge = 'DESACTIVADA';
        reason = 'La conexión está marcada como inactiva en OmniRoute.';
        level = 'error';
      } else if (cbState === 'OPEN') {
        willIgnore = true;
        badge = 'DISYUNTOR ABIERTO';
        reason = `Circuit Breaker abierto (${cbFailures} fallos consecutivos).`;
        level = 'error';
      } else if (isCooling) {
        willIgnore = true;
        badge = `ENFRIAMIENTO (${coolingRemainingSec}s)`;
        reason = `Rate-limited (HTTP 429). En enfriamiento hasta las ${new Date(conn.rate_limited_until).toLocaleTimeString()}.`;
        level = 'warn';
      } else if (conn.test_status === 'error') {
        willIgnore = true;
        badge = 'FALLO CREDENCIALES';
        reason = `Credential Gate: ${conn.last_error || 'Error en última comprobación'}`;
        level = 'error';
      } else if (quota && quota.usage5h >= quota.limit5h) {
        willIgnore = true;
        badge = 'CUOTA 5H AGOTADA';
        reason = `Límite 5h alcanzado (${quota.usage5h}/${quota.limit5h}). Reinicia a las ${new Date(quota.resetAt5h).toLocaleTimeString()}.`;
        level = 'warn';
      } else if (quota && quota.usage7d >= quota.limit7d) {
        willIgnore = true;
        badge = 'CUOTA 7D AGOTADA';
        reason = `Límite semanal alcanzado (${quota.usage7d}/${quota.limit7d}). Reinicia el ${new Date(quota.resetAt7d).toLocaleDateString()}.`;
        level = 'warn';
      }

      return {
        id: conn.id,
        provider: conn.provider,
        name: conn.name || conn.email || (conn.id ? conn.id.slice(0, 8) : 'conn'),
        email: conn.email || null,
        auth_type: conn.auth_type,
        priority: conn.priority,
        is_active: Boolean(conn.is_active),
        test_status: conn.test_status || 'unknown',
        last_tested: conn.last_tested,
        last_error: conn.last_error,
        circuit_breaker: { state: cbState, failure_count: cbFailures },
        is_cooling: isCooling,
        cooling_remaining_seconds: coolingRemainingSec,
        rate_limited_until: conn.rate_limited_until,
        quota,
        evaluation: { willIgnore, badge, reason, level }
      };
    });

    const combos = rawCombos.map(c => {
      try {
        const data = JSON.parse(c.data);
        return {
          id: c.id,
          name: c.name,
          strategy: data.strategy || 'priority',
          models: (data.models || []).map(m => {
            const matchedConn = connections.find(conn => conn.id === m.connectionId);
            return {
              id: m.id,
              model: m.model,
              providerId: m.providerId,
              connectionId: m.connectionId,
              label: m.label,
              connection: matchedConn || null,
              willIgnore: matchedConn ? matchedConn.evaluation.willIgnore : false,
              statusBadge: matchedConn ? matchedConn.evaluation.badge : 'DESCONOCIDO',
              level: matchedConn ? matchedConn.evaluation.level : 'error'
            };
          })
        };
      } catch (e) {
        return { id: c.id, name: c.name, models: [] };
      }
    });

    const total = connections.length;
    const ready = connections.filter(c => !c.evaluation.willIgnore).length;
    const ignored = total - ready;

    return {
      accounts: connections,
      connections,
      combos,
      summary: { total, ready, ignored },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return { error: err.message, connections: [], combos: [], summary: { total: 0, ready: 0, ignored: 0 } };
  }
}

/**
 * Creates and configures the HTTP server instance.
 */
export function createServer() {
  return http.createServer(async (req, res) => {
    // 1. Loopback Address Security Check
    const remote = req.socket?.remoteAddress || '';
    const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!isLoopback && remote !== '') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Acceso denegado: solo solicitudes desde loopback local (127.0.0.1 / ::1) son permitidas.' }));
      return;
    }

    // 2. Host & Origin Security Validation (anti-DNS Rebinding & anti-CSRF)
    const host = req.headers.host || '';
    const origin = req.headers.origin;

    const isAllowedHost = /^127\.0\.0\.1(:\d+)?$/.test(host) || /^localhost(:\d+)?$/.test(host) || host === '';
    let isAllowedOrigin = true;
    if (origin !== undefined) {
      isAllowedOrigin = origin === 'null' || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
    }

    if (!isAllowedHost || !isAllowedOrigin) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Acceso restringido únicamente a solicitudes locales autorizadas.' }));
      return;
    }

    // Security Hardening Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    // CORS Headers (Strict Local Loopback Binding)
    if (origin && isAllowedOrigin && origin !== 'null') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${PORT}`);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Demo-Mode');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const demo = isDemoMode(req, url);

    // Static Web UI
    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (fs.existsSync(HTML_PATH)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(HTML_PATH).pipe(res);
        return;
      }
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), demoMode: demo }));
      return;
    }

    // Static Assets
    if (url.pathname === '/assets/codex-config-icon.png') {
      const iconPath = path.join(ASSETS_DIR, 'codex-config-icon.png');
      if (fs.existsSync(iconPath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(iconPath).pipe(res);
        return;
      }
    }

    if (url.pathname === '/assets/codex-config-icon.ico') {
      const icoPath = path.join(ASSETS_DIR, 'codex-config-icon.ico');
      if (fs.existsSync(icoPath)) {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        fs.createReadStream(icoPath).pipe(res);
        return;
      }
    }

    // GET /api/config: Read config.toml with SHA256 hash
    if (url.pathname === '/api/config' && req.method === 'GET') {
      try {
        if (demo) {
          const content = SYNTHETIC_DEMO_CONFIG_TOML;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            toml: content,
            hash: computeHash(content),
            path: 'DEMO_SANDBOX/config.toml',
            updated: new Date().toISOString(),
            demoMode: true
          }));
          return;
        }

        if (!fs.existsSync(CONFIG_PATH)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'config.toml no encontrado' }));
          return;
        }
        const content = fs.readFileSync(CONFIG_PATH, 'utf8');
        const hash = computeHash(content);
        const stat = fs.statSync(CONFIG_PATH);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          toml: content,
          hash,
          path: CONFIG_PATH,
          updated: stat.mtime
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/config/preview-diff: Diff preview without saving
    if (url.pathname === '/api/config/preview-diff' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { toml } = JSON.parse(body || '{}');
          const diskContent = demo
            ? SYNTHETIC_DEMO_CONFIG_TOML
            : (fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : '');
          const diff = generateDiff(diskContent, toml);
          const check = validateToml(toml);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            valid: check.valid,
            syntaxError: check.error,
            diff
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /api/config: Atomic Save with Validation & Conflict Detection
    if (url.pathname === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          if (typeof data.toml !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Falta campo toml' }));
            return;
          }

          // 1. Strict syntax validation
          const validation = validateToml(data.toml);
          if (!validation.valid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Sintaxis TOML inválida. Guardado cancelado para proteger la configuración.',
              details: validation.error
            }));
            return;
          }

          // Demo Mode branch: validate and simulate success safely without disk write
          if (demo) {
            const newHash = computeHash(data.toml);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              hash: newHash,
              backupPath: 'DEMO_SANDBOX/config.toml.backup-demo',
              activeModel: validation.data?.model || 'coding-con-caro',
              threadsUpdated: 1,
              daemonRestart: 'Simulado en modo DEMO',
              demoMode: true,
              message: '[DEMO MODE] Configuración validada y simulada exitosamente sin modificar archivos reales'
            }));
            return;
          }

          // 2. Collision / External modification check
          const currentDisk = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : '';
          const currentHash = computeHash(currentDisk);
          if (data.expectedHash && data.expectedHash !== currentHash && !data.forceOverwrite) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              conflict: true,
              error: 'El archivo config.toml fue modificado externamente desde la última lectura.',
              currentHash,
              expectedHash: data.expectedHash
            }));
            return;
          }

          // 3. Backup with auto-pruning (max 10)
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(CODEX_DIR, `config.toml.backup-${timestamp}`);
          if (fs.existsSync(CONFIG_PATH)) {
            fs.copyFileSync(CONFIG_PATH, backupPath);
          }
          try {
            const backups = fs.readdirSync(CODEX_DIR)
              .filter(f => f.startsWith('config.toml.backup-'))
              .map(f => ({ name: f, time: fs.statSync(path.join(CODEX_DIR, f)).mtimeMs }))
              .sort((a,b) => b.time - a.time);
            if (backups.length > 10) {
              backups.slice(10).forEach(b => {
                try { fs.unlinkSync(path.join(CODEX_DIR, b.name)); } catch (e) {}
              });
            }
          } catch (e) {}

          // 4. Atomic write (.tmp -> renameSync)
          const tmpConfigPath = path.join(CODEX_DIR, `config.toml.tmp-${Date.now()}`);
          fs.writeFileSync(tmpConfigPath, data.toml, 'utf8');
          fs.renameSync(tmpConfigPath, CONFIG_PATH);
          const newHash = computeHash(data.toml);

          // 5. Sync active threads in SQLite state_5 if present
          const activeModel = validation.data?.model || null;
          const activeProvider = validation.data?.model_provider || 'omniroute';
          let threadsUpdated = 0;

          if (activeModel && fs.existsSync(STATE_DB_PATH)) {
            try {
              const db = new DatabaseSync(STATE_DB_PATH);
              db.exec('PRAGMA busy_timeout = 5000;');
              const latest = db.prepare('SELECT id FROM threads ORDER BY updated_at_ms DESC LIMIT 1').get();
              if (latest && latest.id) {
                db.prepare('UPDATE threads SET model = ?, model_provider = ? WHERE id = ?').run(activeModel, activeProvider, latest.id);
                threadsUpdated++;
              }
              const r = db.prepare("UPDATE threads SET model = ?, model_provider = ? WHERE (model = 'codex' OR model IS NULL) AND id != ?").run(activeModel, activeProvider, latest?.id || '');
              threadsUpdated += r.changes;
            } catch (dbErr) {
              console.warn('[Server] Aviso sincronizando threads en SQLite:', dbErr.message);
            }
          }

          // 6. Optional daemon recycling
          let daemonRestart = null;
          if (data.restartDaemon) {
            try {
              const daemonExe = path.join(CODEX_DIR, 'packages', 'app-server-daemon', 'current', 'bin', 'codex.exe');
              if (fs.existsSync(daemonExe)) {
                await execAsync(`"${daemonExe}" app-server daemon stop`).catch(() => {});
                daemonRestart = 'Daemon reciclado ordenadamente';
              }
            } catch (dErr) {
              daemonRestart = dErr.message;
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            hash: newHash,
            backupPath,
            activeModel,
            threadsUpdated,
            daemonRestart,
            message: 'Configuración guardada y sincronizada exitosamente con escritura atómica'
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /api/config/backups: List available backups
    if (url.pathname === '/api/config/backups' && req.method === 'GET') {
      try {
        if (demo || !fs.existsSync(CODEX_DIR)) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            backups: [
              { name: 'config.toml.backup-demo-1', time: new Date().toISOString(), size: 1024 }
            ]
          }));
          return;
        }

        const backups = fs.readdirSync(CODEX_DIR)
          .filter(f => f.startsWith('config.toml.backup-'))
          .map(f => {
            const stat = fs.statSync(path.join(CODEX_DIR, f));
            return { name: f, time: stat.mtime, size: stat.size };
          })
          .sort((a,b) => new Date(b.time) - new Date(a.time));

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ backups }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/config/restore-backup: Safe restoration of a backup
    if (url.pathname === '/api/config/restore-backup' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { backupName } = JSON.parse(body || '{}');
          if (demo) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              hash: computeHash(SYNTHETIC_DEMO_CONFIG_TOML),
              message: `[DEMO MODE] Backup simulado restaurado exitosamente`
            }));
            return;
          }

          const targetBackup = path.join(CODEX_DIR, path.basename(backupName || ''));
          if (!fs.existsSync(targetBackup)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Archivo de backup no encontrado' }));
            return;
          }

          const backupContent = fs.readFileSync(targetBackup, 'utf8');
          const val = validateToml(backupContent);
          if (!val.valid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'El archivo de backup está corrupto o es inválido' }));
            return;
          }

          const tmpPath = path.join(CODEX_DIR, `config.toml.tmp-${Date.now()}`);
          fs.writeFileSync(tmpPath, backupContent, 'utf8');
          fs.renameSync(tmpPath, CONFIG_PATH);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            hash: computeHash(backupContent),
            message: `Backup ${path.basename(backupName)} restaurado exitosamente`
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /api/omniroute/models: Authenticated model catalog proxy
    if (url.pathname === '/api/omniroute/models' && req.method === 'GET') {
      if (demo) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          data: [
            { id: 'coding-con-caro', name: 'coding-con-caro' },
            { id: 'codex-auto-review', name: 'codex-auto-review' },
            { id: 'o3-mini', name: 'o3-mini' },
            { id: 'claude-3-7-sonnet', name: 'claude-3-7-sonnet' },
            { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro' }
          ]
        }));
        return;
      }

      try {
        const apiKey = getOmniRouteApiKey();
        const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
        const omniRes = await fetch(`${OMNIROUTE_URL}/models`, {
          headers,
          signal: AbortSignal.timeout(5000)
        });
        if (omniRes.ok) {
          const data = await omniRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        } else {
          res.writeHead(omniRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `OmniRoute devolvió status ${omniRes.status}` }));
        }
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `OmniRoute no disponible en ${OMNIROUTE_URL}: ${err.message}` }));
      }
      return;
    }

    // GET /api/omniroute/accounts: Live accounts & combos telemetry
    if (url.pathname === '/api/omniroute/accounts' && req.method === 'GET') {
      try {
        const data = demo ? getSyntheticDemoAccounts() : getOmniRouteAccountsData();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/omniroute/test-all: Trigger batch connection testing
    if (url.pathname === '/api/omniroute/test-all' && req.method === 'POST') {
      if (demo) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          batchResult: { tested: 4, success: 4 },
          data: getSyntheticDemoAccounts(),
          message: '[DEMO MODE] Todas las conexiones simuladas probadas con éxito'
        }));
        return;
      }

      try {
        const apiKey = getOmniRouteApiKey();
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const omniRes = await fetch(`${OMNIROUTE_URL}/api/providers/test-batch`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ mode: 'all' })
        });

        const batchResult = await omniRes.json().catch(() => ({}));
        const updatedData = getOmniRouteAccountsData();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: omniRes.ok,
          batchResult,
          data: updatedData,
          message: omniRes.ok ? 'Todas las conexiones probadas exitosamente' : 'Prueba completada con advertencias'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Fallo al contactar OmniRoute: ${err.message}` }));
      }
      return;
    }

    // POST /api/omniroute/test-connection: Re-test specific connection
    if (url.pathname === '/api/omniroute/test-connection' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { connectionId } = JSON.parse(body || '{}');
          if (!connectionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Falta connectionId' }));
            return;
          }

          if (demo) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              testResult: { valid: true },
              data: getSyntheticDemoAccounts(),
              message: `[DEMO MODE] Conexión ${connectionId} validada exitosamente`
            }));
            return;
          }

          const apiKey = getOmniRouteApiKey();
          const headers = {};
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

          const omniRes = await fetch(`${OMNIROUTE_URL}/api/providers/${connectionId}/test`, {
            method: 'POST',
            headers
          });

          const testResult = await omniRes.json().catch(() => ({}));
          const updatedData = getOmniRouteAccountsData();

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: omniRes.ok,
            testResult,
            data: updatedData,
            message: testResult.valid ? 'Conexión validada exitosamente' : (testResult.error || 'Fallo en la prueba')
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /api/omniroute/clear-cooldown: Clear rate-limit & reset circuit breaker
    if (url.pathname === '/api/omniroute/clear-cooldown' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { connectionId } = JSON.parse(body || '{}');
          if (!connectionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Falta connectionId' }));
            return;
          }

          if (demo) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              data: getSyntheticDemoAccounts(),
              message: `[DEMO MODE] Enfriamiento reseteado para ${connectionId}`
            }));
            return;
          }

          const apiKey = getOmniRouteApiKey();
          const headers = { 'Content-Type': 'application/json' };
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

          const omniRes = await fetch(`${OMNIROUTE_URL}/api/providers/${connectionId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ rateLimitedUntil: null })
          });

          try {
            if (fs.existsSync(OMNIROUTE_DB_PATH)) {
              const db = new DatabaseSync(OMNIROUTE_DB_PATH);
              db.exec('PRAGMA busy_timeout = 3000;');
              db.prepare("UPDATE domain_circuit_breakers SET state = 'CLOSED', failure_count = 0 WHERE name LIKE ?").run(`%${connectionId}%`);
            }
          } catch (dbErr) {}

          const updatedData = getOmniRouteAccountsData();

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: omniRes.ok,
            data: updatedData,
            message: 'Enfriamiento y disyuntor reseteados exitosamente'
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /api/omniroute/clear-all: Master reset
    if (url.pathname === '/api/omniroute/clear-all' && req.method === 'POST') {
      if (demo) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          data: getSyntheticDemoAccounts(),
          message: '[DEMO MODE] Master Reset simulado exitosamente'
        }));
        return;
      }

      try {
        if (fs.existsSync(OMNIROUTE_DB_PATH)) {
          const db = new DatabaseSync(OMNIROUTE_DB_PATH);
          db.exec('PRAGMA busy_timeout = 5000;');
          db.prepare("UPDATE domain_circuit_breakers SET state = 'CLOSED', failure_count = 0").run();
          db.prepare("UPDATE provider_connections SET rate_limited_until = NULL WHERE rate_limited_until IS NOT NULL").run();
        }
        const updatedData = getOmniRouteAccountsData();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          data: updatedData,
          message: 'Master Reset: Todos los disyuntores y períodos de enfriamiento han sido reseteados a 0'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // POST /api/sync-all-threads: Sync active threads to chosen combo
    if (url.pathname === '/api/sync-all-threads' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { model, modelProvider } = JSON.parse(body || '{}');
          const targetModel = model || 'coding-con-caro';
          const targetProvider = modelProvider || 'omniroute';
          let updatedCount = 0;

          if (demo) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              updatedCount: 3,
              model: targetModel,
              message: `[DEMO MODE] 3 hilos sincronizados exitosamente a '${targetModel}'`
            }));
            return;
          }

          if (fs.existsSync(STATE_DB_PATH)) {
            const db = new DatabaseSync(STATE_DB_PATH);
            db.exec('PRAGMA busy_timeout = 5000;');
            const r = db.prepare('UPDATE threads SET model = ?, model_provider = ? WHERE archived = 0').run(targetModel, targetProvider);
            updatedCount = r.changes;
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            updatedCount,
            model: targetModel,
            message: `${updatedCount} hilos activos sincronizados exitosamente a '${targetModel}'`
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /api/restart-desktop-app: Graceful restart of ChatGPT Desktop
    if (url.pathname === '/api/restart-desktop-app' && req.method === 'POST') {
      if (demo) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: '[DEMO MODE] ChatGPT / Codex Desktop reinicio simulado exitosamente'
        }));
        return;
      }

      try {
        const gracefulCloseScript = `
          $procs = Get-Process -Name ChatGPT -ErrorAction SilentlyContinue
          if ($procs) {
            $procs | ForEach-Object { $_.CloseMainWindow() } | Out-Null
            $waited = 0
            while ((Get-Process -Name ChatGPT -ErrorAction SilentlyContinue) -and ($waited -lt 6)) {
              Start-Sleep -Milliseconds 500
              $waited += 1
            }
            if (Get-Process -Name ChatGPT -ErrorAction SilentlyContinue) {
              Stop-Process -Name ChatGPT -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Milliseconds 800
          }
        `;
        await execAsync(gracefulCloseScript, { shell: 'powershell.exe' });
        await new Promise(r => setTimeout(r, 600));

        try {
          const daemonExe = path.join(CODEX_DIR, 'packages', 'app-server-daemon', 'current', 'bin', 'codex.exe');
          if (fs.existsSync(daemonExe)) {
            await execAsync(`"${daemonExe}" app-server daemon stop`).catch(() => {});
          }
        } catch (dErr) {}
        await new Promise(r => setTimeout(r, 800));

        await execAsync('cmd.exe /c start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: 'ChatGPT / Codex Desktop reiniciado exitosamente de forma limpia'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // GET /api/diagnostics: Redacted diagnostics report
    if (url.pathname === '/api/diagnostics' && req.method === 'GET') {
      try {
        if (demo) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            timestamp: new Date().toISOString(),
            serverPort: PORT,
            demoMode: true,
            omniRoute: { url: OMNIROUTE_URL, status: 'MOCK_ONLINE', online: true },
            configToml: { size: SYNTHETIC_DEMO_CONFIG_TOML.length, mtime: new Date().toISOString(), hash: computeHash(SYNTHETIC_DEMO_CONFIG_TOML) },
            accountsSummary: { total: 4, ready: 2, ignored: 2 },
            combosAvailable: ['coding-con-caro', 'codex-auto-review']
          }));
          return;
        }

        let omniOnline = false;
        let omniStatusText = 'OFFLINE';
        try {
          const ping = await fetch(`${OMNIROUTE_URL}/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
          if (ping && ping.ok) {
            omniOnline = true;
            omniStatusText = 'HEALTHY';
          }
        } catch (e) {}

        let configStat = null;
        if (fs.existsSync(CONFIG_PATH)) {
          const s = fs.statSync(CONFIG_PATH);
          configStat = { size: s.size, mtime: s.mtime, hash: computeHash(fs.readFileSync(CONFIG_PATH, 'utf8')) };
        }

        const accData = getOmniRouteAccountsData();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          timestamp: new Date().toISOString(),
          serverPort: PORT,
          demoMode: false,
          omniRoute: { url: OMNIROUTE_URL, status: omniStatusText, online: omniOnline },
          configToml: configStat,
          accountsSummary: accData.summary,
          combosAvailable: (accData.combos || []).map(c => c.name)
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });
}

// Start listener if executed directly as main script
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const server = createServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Server] Puerto ${PORT} ya está ocupado por otra instancia activa. Saliendo limpiamente.`);
      process.exit(0);
    } else {
      console.error('[Server] Error en servidor HTTP:', err);
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Codex Config Server escuchando en http://127.0.0.1:${PORT}`);
    if (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1') {
      console.log(`[Server] DEMO MODE ACTIVO: Servidor operando con datos sintéticos seguros.`);
    }
  });
}
