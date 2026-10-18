# Changelog

All notable changes to **Codex Config Manager** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.1] - 2026-10-17

### Fixed
- **Surgical TOML Inline Comment Preservation**: Preserves trailing inline comments (`# ...`) when modifying top-level and section keys, preventing comment stripping during configuration updates.
- **Line Ending Fidelity**: Detects and preserves native Windows CRLF (`\r\n`) vs Unix LF (`\n`) line endings, eliminating widespread diff noise on file saves.
- **Server Dependency Injection & Path Resolution**: Refactored `createServer(options)` with full dependency injection (`port`, `codexDir`, `configPath`, `stateDbPath`, `omniRouteDbPath`, `omniRouteUrl`, `demoMode`, `htmlPath`, `assetsDir`), ensuring test sandboxes run with complete isolation.
- **Safe Environment Loading**: Added built-in `.env` file loader (`loadEnvFile`) running before path resolution without overwriting existing environment variables.
- **Documentation Link Hygiene**: Converted all local `file:///` URLs to relative repository links in `README.md`.
- **Node.js Engine Documentation**: Aligned documented minimum Node.js engine requirement to `>=22.5.0` (required for built-in `node:sqlite`).

### Added
- **Dedicated Real Disk Persistence E2E Test Suite (`tests/e2e-disk-persistence.test.mjs`)**: 29 automated test scenarios verifying atomic writes, `.backup-...` creation, SHA-256 collision detection (HTTP 409), malformed TOML rejection (HTTP 400), and SQLite thread updates in an isolated temp directory.
- **Screenshot Protection**: Separated screenshot generation into a dedicated command (`npm run docs:screenshots`), preventing regular test runs from unintentionally modifying `docs/images/*.png`.
- **Expanded CI Quality Gates**: Added automated `test:disk` and Playwright Chromium E2E execution to `.github/workflows/ci.yml`.

---

## [2.1.0] - 2026-10-17

### Added
- **Built-in Demo Mode (`DEMO_MODE=true` / `?demo=1`)**: Enables 100% synthetic mock fixtures for public demonstration, testing, and continuous integration without requiring active local Codex or OmniRoute installations.
- **Automated Multi-Tier Test Suite (`npm test`)**:
  - `tests/toml-engine.test.mjs`: 30 unit tests validating surgical in-place key replacement, reasoning effort preservation, and Windows path escaping.
  - `tests/security.test.mjs`: 19 security tests validating loopback binding, Host/Origin header filtering, anti-CSRF, and secrets sanitization.
  - `tests/e2e.test.mjs`: 20 isolated end-to-end browser tests using Playwright Chromium headless in a sandboxed fixture.
- **Direct Modal Triggers**: Added hero action cluster buttons for `VER DIFF`, `RESPALDOS`, and `DIAGNÓSTICO`.
- **Privacy-Safe Visuals**: Generated fresh, synthetic high-resolution screenshots (`dashboard.png`, `model-routing.png`, `config-diff.png`, `diagnostics.png`) and retro SVG banner (`readme-hero.svg`).
- **Standardized Community Files**: Added `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, and `docs/RELEASE_CHECKLIST.md`.

### Security Hardening
- **Eliminated Hardcoded Secrets**: Removed fallback API key from `src/server/config-manager-server.mjs`. Keys are resolved dynamically from the local keyring or environment.
- **Strict Network Isolation**: Enforced loopback socket binding (`127.0.0.1`, `::1`). Non-loopback requests are immediately blocked with HTTP 403.
- **DNS Rebinding & Anti-CSRF Guard**: Validates incoming `Host` and `Origin` headers against strict localhost patterns. Removed wildcard (`*`) CORS headers on sensitive endpoints.
- **Zero-Mutation Telemetry Reads**: Removed database mutation (`ensureOmniRouteCombosAutoHeal()`) from telemetry read paths. `GET /api/omniroute/accounts` is strictly read-only and idempotent.

### Fixed
- **Clean Console on Startup**: Defined canonical `updateRawPreview()` hook to prevent `ReferenceError` exceptions across all bound form inputs.
- **Path Portability**: Eliminated hardcoded user profile paths across the codebase. Server and launch scripts now dynamically resolve user home directories via `process.env.USERPROFILE || os.homedir()` and parent script directories.
- **Dynamic Origin Adaptation**: Updated `CONFIG_SERVER_URL` in frontend to adapt dynamically to the serving HTTP host and port.

---

## [2.0.0] - 2026-10-15

### Added
- Centralized Windows desktop repository structure.
- 9-tab technical interface covering accounts telemetry, model combos, reasoning parameters, execution features, and desktop preferences.
- Surgical round-trip TOML engine preserving arbitrary comments, indentation, and unmapped `[projects.*]` tables.
- Atomic file write pipeline (`.tmp` write followed by atomic rename) with rolling backups (up to 10 snapshots).
- Automatic SQLite thread synchronization for active conversations.
- Clean process recycling for ChatGPT Desktop and Codex App Server daemons.
