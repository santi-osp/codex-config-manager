# Testing Guide & Quality Assurance

Codex Config Manager features a comprehensive, multi-tiered automated test suite designed for deterministic verification without compromising user privacy or consuming live provider API quotas.

---

## Test Architecture

The testing suite consists of four decoupled layers:

```
+-----------------------------------------------------------------------------------+
|                               TEST EXECUTION MATRIX                               |
+-----------------------------------------------------------------------------------+
| 1. Unit Tests         | tests/toml-engine.test.mjs           | 45 Test Scenarios  |
| 2. Security Suite     | tests/security.test.mjs              | 27 Test Scenarios  |
| 3. Real Disk E2E      | tests/e2e-disk-persistence.test.mjs  | 29 Test Scenarios  |
| 4. Playwright UI E2E  | tests/e2e.test.mjs                   | 20 Test Scenarios  |
+-----------------------+--------------------------------------+--------------------+
| TOTAL COVERAGE        | 121 Automated Scenarios              | 100% Pass Rate     |
+-----------------------------------------------------------------------------------+
```

---

## 1. Unit Tests (`tests/toml-engine.test.mjs`)

Validates the **Surgical Round-Trip TOML Engine**:
- **Surgical Key Mutation**: Confirms that updating top-level keys (`model`, `model_provider`, etc.) or table keys (`[windows]`, `[features]`) updates strictly the target line.
- **Inline Comment Preservation**: Confirms that trailing inline comments (`key = "val" # comment`) are strictly preserved across modifications.
- **Line Ending Fidelity**: Asserts that CRLF (`\r\n`) and LF (`\n`) line endings are preserved without generating false diffs.
- **0-Byte Unmodified Line Fidelity**: Confirms untouched sections, comments, and whitespace remain byte-for-byte identical.
- **Section Preservation**: Confirms that all arbitrary unmapped `[projects."..."]` tables and `[mcp_servers.*]` configurations remain 100% intact.
- **Reasoning Effort Integrity**: Verifies all 7 reasoning effort levels (`none`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`) without restrictive per-model filtering.
- **Windows Path Escaping**: Validates complex Windows filesystem paths with backslashes, spaces, and Unicode characters.
- **Syntax Validation**: Ensures invalid TOML syntax is intercepted before touching the filesystem.
- **SHA-256 Hash Calculation**: Verifies collision detection algorithms.

To run unit tests:
```bash
npm run test:unit
```

---

## 2. Security & Hardening Suite (`tests/security.test.mjs`)

Audits the local security perimeter and defense-in-depth protections:
- **Zero Secrets in Code**: Scans source files to verify that no hardcoded fallback keys or personal filesystem paths exist.
- **Loopback Enforcement**: Tests that incoming sockets originating from non-loopback interfaces are rejected with HTTP 403.
- **Host & Origin Validation**: Verifies rejection of DNS rebinding attacks (`Host: attacker.evil.com`) and cross-origin hijacking attempts (`Origin: http://malicious-site.com`).
- **Security Headers**: Asserts presence of `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.
- **Demo Mode Isolation**: Confirms that requests in demo mode return synthetic fixtures without querying the user's disk or live OmniRoute database.
- **Environment Loader & DI**: Verifies that `loadEnvFile()` does not clobber existing environment variables and `createServer(options)` respects injected options.

To run security tests:
```bash
npm run test:security
```

---

## 3. Real Disk Persistence & Recovery E2E (`tests/e2e-disk-persistence.test.mjs`)

Executes real filesystem operations in a temporary isolated sandbox (`os.tmpdir()`):
- **Atomic File Write Pipeline**: Verifies `.tmp` write followed by `fs.renameSync` into `config.toml`.
- **Rolling Backup Creation**: Validates physical creation of timestamped backups (`config.toml.backup-...`) on disk.
- **SHA-256 Conflict Gate (HTTP 409)**: Confirms that saving against an outdated `expectedHash` rejects with 409 Conflict without modifying disk.
- **Syntax Protection Gate (HTTP 400)**: Asserts that invalid TOML payloads are rejected with 400 Bad Request, leaving existing disk files intact.
- **Backup Listing & Restoration**: Validates `GET /api/config/backups` and `POST /api/config/restore-backup`.
- **SQLite Thread Synchronization**: Confirms active threads in `state_5.sqlite` are updated cleanly upon saving.

To run real disk persistence tests:
```bash
npm run test:disk
```

---

## 4. Playwright Synthetic UI Demo E2E (`tests/e2e.test.mjs`)

Performs real end-to-end browser automation in a sandboxed, isolated environment:
- **Sandbox Isolation**: Spins up a temporary fixture directory with isolated mock configuration.
- **Browser Automation**: Uses Chromium headless shell to interact with the DOM as a real user.
- **Default Navigation**: Verifies that the app opens directly to Tab `[00] MONITOR CUENTAS`.
- **Telemetry Visuals**: Checks metric tiles (Total, Ready, Ignored, Cooldown) and combo dispatch pipelines.
- **Dirty State Tracking**: Modifies inputs and asserts that the `MODIFICADO (SIN GUARDAR)` badge appears and disappears upon saving.
- **Modal Integrations**: Tests Diff Modal, Backups Modal, and Diagnostics Modal.
- **Keyboard Shortcuts**: Tests global hotkeys (`Ctrl+S` to save, `Escape` to close modals).

To run UI demo tests:
```bash
npm run test:e2e
```

To regenerate documentation screenshots:
```bash
npm run docs:screenshots
```

---

## Running the Complete Suite

To execute all four suites in sequence:

```bash
npm test
```

Or via PowerShell:
```powershell
.\scripts\run-tests.ps1
```
