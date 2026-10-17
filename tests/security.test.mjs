import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createServer } from '../src/server/config-manager-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeRawRequest({ host = '127.0.0.1', port, path: reqPath = '/health', method = 'GET', headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host,
      port,
      path: reqPath,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('=== SECURITY & HARDENING TEST SUITE ===\n');
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

  const TEST_PORT = 20199;
  process.env.PORT = String(TEST_PORT);
  process.env.DEMO_MODE = 'true';

  const testServer = createServer();
  await new Promise((resolve, reject) => {
    testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
    testServer.on('error', reject);
  });

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // TEST 1: Source code secret scan - zero hardcoded fallback API keys in server code
    const serverSrc = fs.readFileSync(path.resolve(__dirname, '../src/server/config-manager-server.mjs'), 'utf8');
    assert('No hardcoded fallback API key in server source', !/return\s+['"]sk-[a-zA-Z0-9_\-]+['"]/.test(serverSrc));
    assert('No personal user paths hardcoded in server source', !serverSrc.includes('C:\\Users\\') && !serverSrc.includes('/Users/'));

    // TEST 2: Security headers present on responses
    const healthRes = await makeRawRequest({ port: TEST_PORT, path: '/health', headers: { Host: `127.0.0.1:${TEST_PORT}` } });
    assert('Health check returns 200 OK', healthRes.status === 200);
    assert('X-Content-Type-Options is nosniff', healthRes.headers['x-content-type-options'] === 'nosniff');
    assert('X-Frame-Options is DENY', healthRes.headers['x-frame-options'] === 'DENY');
    assert('Referrer-Policy is no-referrer', healthRes.headers['referrer-policy'] === 'no-referrer');

    // TEST 3: Reject non-local / malicious Host header (DNS rebinding prevention)
    const badHostRes = await makeRawRequest({
      port: TEST_PORT,
      path: '/health',
      headers: { Host: 'attacker.evil.com' }
    });
    assert('Rejects malicious Host header with 403 Forbidden', badHostRes.status === 403);

    // TEST 4: Reject malicious Origin (e.g. cross-origin attacker page)
    const badOriginRes = await makeRawRequest({
      port: TEST_PORT,
      path: '/health',
      headers: { Host: `127.0.0.1:${TEST_PORT}`, Origin: 'http://malicious-site.com' }
    });
    assert('Rejects cross-origin attacker with 403 Forbidden', badOriginRes.status === 403);

    // TEST 5: Reject subdomain/prefix bypass attempt (e.g. localhost.attacker.com)
    const bypassOriginRes = await makeRawRequest({
      port: TEST_PORT,
      path: '/health',
      headers: { Host: `127.0.0.1:${TEST_PORT}`, Origin: 'http://attacker-localhost.com' }
    });
    assert('Rejects spoofed origin containing localhost with 403 Forbidden', bypassOriginRes.status === 403);

    // TEST 6: Accept authorized localhost and 127.0.0.1 Origin
    const validLocalhostRes = await makeRawRequest({
      port: TEST_PORT,
      path: '/health',
      headers: { Host: `localhost:${TEST_PORT}`, Origin: `http://localhost:${TEST_PORT}` }
    });
    assert('Accepts authorized localhost origin', validLocalhostRes.status === 200);
    assert('CORS header reflects local origin instead of wildcard *', validLocalhostRes.headers['access-control-allow-origin'] === `http://localhost:${TEST_PORT}`);

    // TEST 7: DEMO_MODE serves synthetic safe accounts without touching disk or real credentials
    const demoAccountsRes = await fetch(`${baseUrl}/api/omniroute/accounts?demo=1`);
    assert('Demo accounts API returns 200 OK', demoAccountsRes.status === 200);
    const demoAccounts = await demoAccountsRes.json();
    assert('Demo mode returns synthetic accounts', demoAccounts.accounts.length > 0 && demoAccounts.demoMode === true);
    assert('Demo accounts do not contain real user credentials', demoAccounts.accounts.every(a => a.id.startsWith('conn-')));

    // TEST 8: DEMO_MODE config save validates TOML without writing to real disk
    const demoSaveRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': '1' },
      body: JSON.stringify({ toml: 'model = "coding-con-caro"\n' })
    });
    assert('Demo config save succeeds with simulation response', demoSaveRes.status === 200);
    const demoSaveJson = await demoSaveRes.json();
    assert('Demo save flag is returned', demoSaveJson.demoMode === true);

    // TEST 9: Reject invalid TOML on save (syntax validation gate)
    const invalidSaveRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Mode': '1' },
      body: JSON.stringify({ toml: 'invalid = "unterminated string\n' })
    });
    assert('Rejects invalid TOML with 400 Bad Request', invalidSaveRes.status === 400);

    // TEST 10: Index HTML does not leak hardcoded user paths
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    const htmlText = await htmlRes.text();
    assert('Served index.html does not contain hardcoded user path', !htmlText.includes('C:\\Users\\santi'));
    assert('Served index.html defines updateRawPreview', htmlText.includes('function updateRawPreview'));

  } finally {
    if (typeof testServer.closeAllConnections === 'function') {
      testServer.closeAllConnections();
    }
    await new Promise(resolve => testServer.close(resolve));
  }

  console.log(`\n=== RESULTADOS SECURITY TESTS: ${passed} PASSED / ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runSecurityTests();
