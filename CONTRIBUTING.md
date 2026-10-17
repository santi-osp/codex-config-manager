# Contributing to Codex Config Manager

Thank you for your interest in contributing to **Codex Config Manager**! We welcome contributions that maintain the technical rigor, security posture, and retro-pixel minimalist identity of this project.

---

## Non-Negotiable Core Principles

Before opening a pull request, please review these architectural rules:

1. **Preserve Codex Permissions & Security Semantics**:
   - Never restrict, alter, or silently normalize `sandbox_mode`, `approval_policy`, `approvals_reviewer`, or `windows.sandbox`.
   - Never add unsolicited permission gates or approval dialogs to Codex.
2. **Preserve All Reasoning Effort Levels**:
   - OmniRoute dynamically controls reasoning effort through combo selection.
   - All 7 levels (`none`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`) must be preserved in UI selectors and config parsers without per-model filtering.
3. **Single-File Frontend Architecture**:
   - `src/web/index.html` is intentionally a single-file, zero-dependency HTML document containing all inline HTML, CSS, and vanilla JavaScript.
   - Do not migrate or refactor the frontend into React, Vue, Svelte, Vite, or a multi-file bundle.
4. **Retro-Pixel Aesthetic**:
   - Do not introduce heavy animation libraries (e.g. GSAP). Maintain the monospace, monochrome/dark terminal aesthetic.
5. **Zero Telemetry Mutation on Read**:
   - Reading telemetry (`GET` endpoints) must be strictly idempotent and read-only. Never write or insert database records on read paths.
6. **Zero Secrets in Code or Commits**:
   - Never commit API keys, personal user paths, OAuth tokens, or production database snapshots. Use dynamic keyring resolution or `DEMO_MODE` fixtures.

---

## Development Workflow

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **Windows 10 / 11** (recommended for native PowerShell and VBS shortcuts)

### 2. Clone and Install
```bash
git clone https://github.com/santi-osp/codex-config-manager.git
cd codex-config-manager
npm install
```

### 3. Running in Demo Mode (Mock Environment)
Run the server with synthetic, safe mock accounts and configs:
```bash
npm run demo
```
Open `http://127.0.0.1:20129` in your browser. A retro badge `[DEMO MODE // MOCK ENVIRONMENT]` confirms that mock data is active.

### 4. Running in Live Production Mode
```bash
npm start
```

---

## Running the Automated Test Suite

Every pull request must pass the full test suite with 100% pass rate:

```bash
npm test
```

This runs:
- `npm run test:unit`: Surgical TOML preservation and formatting.
- `npm run test:security`: Anti-CSRF, DNS rebinding, loopback isolation, and secret scanning.
- `npm run test:e2e`: Headless Chromium E2E automation in an isolated sandbox.

---

## Pull Request Guidelines

1. **Feature Branch**: Create a descriptive branch (`git checkout -b feature/your-feature-name` or `fix/issue-description`).
2. **Keep Commits Clean & Conventional**: Use conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).
3. **Run Tests Locally**: Ensure `npm test` passes before pushing.
4. **Documentation**: If adding or altering user-facing functionality, update `docs/ARCHITECTURE.md` or `README.md` accordingly.
