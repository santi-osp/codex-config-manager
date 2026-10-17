# Testing Guide & Quality Assurance

Codex Config Manager features a comprehensive, multi-tiered automated test suite designed for deterministic verification without compromising user privacy or consuming live provider API quotas.

---

## Test Architecture

The testing suite consists of three decoupled layers:

```
+-------------------------------------------------------------------------+
|                          TEST EXECUTION MATRIX                          |
+-------------------------------------------------------------------------+
| 1. Unit Tests       | tests/toml-engine.test.mjs  | 30 Test Scenarios   |
| 2. Security Suite   | tests/security.test.mjs     | 19 Test Scenarios   |
| 3. Playwright E2E   | tests/e2e.test.mjs          | 20 Test Scenarios   |
+---------------------+-----------------------------+---------------------+
| TOTAL COVERAGE      | 69 Automated Scenarios      | 100% Pass Rate      |
+-------------------------------------------------------------------------+
```

---

## 1. Unit Tests (`tests/toml-engine.test.mjs`)

Validates the **Surgical Round-Trip TOML Engine**:
- **Surgical Key Mutation**: Confirms that updating top-level keys (`model`, `model_provider`, etc.) or table keys (`[windows]`, `[features]`) updates strictly the target line.
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

To run security tests:
```bash
npm run test:security
```

---

## 3. Playwright E2E Suite (`tests/e2e.test.mjs`)

Performs real end-to-end browser automation in a sandboxed, isolated environment:
- **Sandbox Isolation**: Spins up a temporary fixture directory with isolated `config.toml` and mock state database.
- **Browser Automation**: Uses Microsoft Edge / Chromium headless shell to interact with the DOM as a real user.
- **Default Navigation**: Verifies that the app opens directly to Tab `[00] MONITOR CUENTAS`.
- **Telemetry Visuals**: Checks metric tiles (Total, Ready, Ignored, Cooldown) and combo dispatch pipelines.
- **Dirty State Tracking**: Modifies inputs and asserts that the `MODIFICADO (SIN GUARDAR)` badge appears and disappears upon saving.
- **Modal Integrations**: Tests Diff Modal, Backups Modal, and Diagnostics Modal.
- **Keyboard Shortcuts**: Tests global hotkeys (`Ctrl+S` to save, `Escape` to close modals).
- **Screenshot Evidence Generation**: Automatically generates synthetic, privacy-safe UI screenshots into `docs/images/`.

To run E2E tests:
```bash
npm run test:e2e
```

---

## Running the Complete Suite

To execute all three suites in sequence:

```bash
npm test
```

Or via PowerShell:
```powershell
.\scripts\run-tests.ps1
```
