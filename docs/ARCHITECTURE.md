# Architecture & System Design

## Overview

**Codex Config Manager** is a technical desktop control plane for managing OpenAI Codex configurations, multi-model combo routing via OmniRoute, and Windows runtime parameters. It bridges a retro-pixel single-file web interface with local system files, SQLite state stores, and the OmniRoute gateway through an authenticated, loopback-only Node.js micro-daemon.

```
+-------------------------------------------------------------------------+
|                        DESKTOP BROWSER / WEB UI                         |
|      (src/web/index.html — Pure Vanilla JS + CSS + HTML5, No Bundler)   |
+-------------------------------------------------------------------------+
                                    ▲
                                    │ HTTP Loopback (127.0.0.1:20129)
                                    │ Anti-CSRF / Host & Origin Guarded
                                    ▼
+-------------------------------------------------------------------------+
|                       LOCAL NODE.JS BRIDGE DAEMON                       |
|                   (src/server/config-manager-server.mjs)                |
+-------------------+--------------------+--------------------------------+
                    │                    │
                    ▼                    ▼
     +------------------------------+   +-------------------------------+
     |   SURGICAL TOML ENGINE       |   |    OMNIROUTE GATEWAY PROXY    |
     |  (src/server/toml-engine.mjs)|   |     (http://127.0.0.1:20128)  |
     +--------------+---------------+   +---------------+---------------+
                    │                                   │
                    ▼                                   ▼
+-----------------------------------+   +-------------------------------+
|     CODEX DESKTOP RUNTIME         |   |    OMNIROUTE TELEMETRY        |
| - ~/.codex/config.toml (Atomic)   |   | - storage.sqlite              |
| - ~/.codex/state_5.sqlite         |   | - Dynamic API Key Discovery   |
| - Rolling Backups (.backup-*)     |   | - Circuit Breaker Status      |
+-----------------------------------+   +-------------------------------+
```

---

## 1. Single-File Web Frontend

The user interface lives in `src/web/index.html` as a standalone, zero-bundler document:
- **No Node/npm runtime needed for static inspection**: The UI HTML can be previewed or opened in any modern browser.
- **Surgical Two-Way Binding**: Form controls are bound to memory representations of the configuration. Changes update the raw TOML view in real-time.
- **Zero-Mutation Telemetry**: The UI polls `/api/omniroute/accounts` every 15 seconds (configurable) strictly via read-only requests.
- **Retro-Pixel Aesthetic**: Engineered with monospace typography, high-contrast monochrome tones, pixel indicators, and scanline accents, following technical editorial standards without heavy UI framework bloat or external CSS CDNs.

---

## 2. Surgical Round-Trip TOML Engine

Generic TOML parsers typically discard comments, alter whitespace, and reorder tables on serialization. To solve this, `src/server/toml-engine.mjs` implements a **surgical line-preserving modifier**:

1. **Targeted Replacement**: Using precise regex patterns, only the targeted key within its target section header (`[section]`) is replaced in place.
2. **Preservation of Unknown Keys & Sections**: Unmapped sections—such as arbitrary `[projects."..."]` tables and third-party `[mcp_servers.*]` definitions—are left 100% unaltered.
3. **Escaped Formatting**: Windows backslashes, quotes, booleans, and arrays are escaped safely without corrupting adjacent lines.
4. **Pre-Save Syntax Gate**: Before writing to disk, the resulting TOML string is fully validated using `smol-toml`. If parsing fails, the save is aborted immediately, preserving disk safety.

---

## 3. Atomic Disk Operations & Concurrency Safety

Writing configuration files for an active background daemon (such as Codex App Server) carries race condition risks. Codex Config Manager employs a multi-tiered safety pipeline:

1. **Hash Verification (`computeHash`)**: The server computes a SHA-256 hash of `config.toml` upon reading. Clients submit this hash with save requests (`expectedHash`). If disk content changed externally, an HTTP `409 Conflict` is returned, presenting a 3-way conflict modal to the user.
2. **Automated Rolling Backups**: Prior to any file alteration, `config.toml` is copied to `config.toml.backup-<ISO-timestamp>`. An auto-pruner ensures that no more than 10 backup generations are retained.
3. **Atomic File Replacement**: New content is written to a temporary sibling file (`config.toml.tmp-<timestamp>`), flushed to disk, and synchronously renamed (`fs.renameSync`) over `config.toml`. This atomic rename ensures that readers never see half-written states.

---

## 4. SQLite Synchronization & Process Recycling

When a model or combo is updated:
- **Thread Migration**: If `~/.codex/state_5.sqlite` exists, active unarchived threads in the `threads` table are updated to reflect the new `model` and `model_provider`.
- **Daemon Recycling**: If requested, the server sends a graceful stop signal to `packages/app-server-daemon/current/bin/codex.exe`.
- **ChatGPT Desktop Restart**: Using PowerShell window messaging (`CloseMainWindow`) and shell URI launching (`shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App`), ChatGPT Desktop is cycled gracefully without orphan background processes.

---

## 5. Security & Isolation Boundary

| Security Vector | Implementation Detail |
| --------------- | --------------------- |
| **Network Interface** | Binds strictly to `127.0.0.1`. Remote sockets not matching loopback are rejected (HTTP 403). |
| **DNS Rebinding** | Checks incoming `Host` header against `127.0.0.1` and `localhost`. |
| **Anti-CSRF** | Rejects non-loopback `Origin` headers. CORS reflects local origin explicitly; no wildcard `*` allowed. |
| **Credentials** | OmniRoute API key is resolved dynamically from local SQLite or environment; never in source. |
| **Demo Mode** | `DEMO_MODE=true` serves synthetic, sanitized fixtures for safe public testing and screenshot generation. |
