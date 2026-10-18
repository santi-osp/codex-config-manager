# Pre-Release Quality Gates & Verification Checklist (v2.1.1)

Every release of **Codex Config Manager** must satisfy the 14 mandatory release gates prior to public distribution.

---

## Release Gates Matrix (G1–G14)

| Gate | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **G1** | **Codex Permissions & Reasoning Integrity** | `tests/toml-engine.test.mjs` verifies `sandbox_mode`, `approval_policy`, `approvals_reviewer`, `windows.sandbox`, and all 7 reasoning effort levels (`none`..`ultra`). | :white_check_mark: PASS |
| **G2** | **Zero-Mutation Telemetry Reads** | Removed `ensureOmniRouteCombosAutoHeal()` from `getOmniRouteAccountsData()`. Verified GET requests perform 0 INSERT/UPDATE operations. | :white_check_mark: PASS |
| **G3** | **Zero Secrets & Zero PII Leakage** | Automated regex scan for personal paths (`C:\Users\...`), emails, and API keys. All real tokens replaced with dynamic discovery or mock fixtures. | :white_check_mark: PASS |
| **G4** | **Loopback Binding & Network Isolation** | Server binds to `127.0.0.1`. Sockets inspected for loopback addresses (`127.0.0.1`, `::1`). Non-loopback requests rejected (HTTP 403). | :white_check_mark: PASS |
| **G5** | **DNS Rebinding & Anti-CSRF Hardening** | `tests/security.test.mjs` tests malicious Host (`attacker.com`) and spoofed Origin headers (`attacker-localhost.com`), asserting HTTP 403. | :white_check_mark: PASS |
| **G6** | **Atomic File Operations & Backups** | Atomic `.tmp-[timestamp]` writes with `fs.renameSync` and rolling backups up to 10 generations. Collision detection with SHA-256 hash. | :white_check_mark: PASS |
| **G7** | **Unit Test Suite (TOML Engine)** | 45 unit tests in `tests/toml-engine.test.mjs` pass cleanly (comments, CRLF/LF, 0-byte fidelity). | :white_check_mark: PASS |
| **G8** | **Security & Hardening Suite** | 27 security tests in `tests/security.test.mjs` pass cleanly (Loopback, Origin, env loader, DI). | :white_check_mark: PASS |
| **G9** | **Real Disk Persistence E2E Suite** | 29 isolated disk persistence and recovery tests in `tests/e2e-disk-persistence.test.mjs` pass cleanly. | :white_check_mark: PASS |
| **G10** | **Playwright UI E2E Suite** | 20 end-to-end browser automation tests in `tests/e2e.test.mjs` pass cleanly in an isolated sandbox. | :white_check_mark: PASS |
| **G11** | **Synthetic Privacy-Safe Imagery** | Protected screenshots in `docs/images/` using synthetic demo accounts; separate `docs:screenshots` script. | :white_check_mark: PASS |
| **G12** | **Single-File Frontend Architecture** | Verified `src/web/index.html` is a standalone, vanilla HTML5+CSS+JS document without external node/npm build dependencies. | :white_check_mark: PASS |
| **G13** | **Path Portability & CI Compatibility** | Paths resolved via `process.env.USERPROFILE || os.homedir()`, overridable via environment variables. Dynamic parent folder resolution in VBS scripts. | :white_check_mark: PASS |
| **G14** | **Documentation & Community Standards** | Relative repository links in `README.md`, truthful Node `>=22.5.0` engine requirement, `SECURITY.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md`. | :white_check_mark: PASS |

---

## Automated Verification Summary

```text
================================================================
 SUMMARY AUDIT RESULTS (v2.1.1)
================================================================
Total Test Scenarios Executed : 121
Total Passed                  : 121
Total Failed                  : 0
Total Regressions             : 0
Release Gate Decision         : ALL GATES PASS -> AUTHORIZED FOR RELEASE
================================================================
```
