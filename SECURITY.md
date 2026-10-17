# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.1.x   | :white_check_mark: |
| < 2.1   | :x:                |

---

## Local Threat Model & Architecture

Codex Config Manager is designed as a **strictly local desktop control plane** for Windows systems. It is not a multi-tenant web application and does not expose ports to the public Internet or local area networks (LAN).

### 1. Loopback Binding & Interface Isolation
- The backend HTTP daemon binds exclusively to `127.0.0.1` (`localhost`).
- Incoming socket addresses are validated against loopback addresses (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`). Any foreign socket is immediately rejected with `403 Forbidden`.

### 2. DNS Rebinding & Cross-Origin Request Forgery (Anti-CSRF)
- **Host Header Validation**: All requests are checked against strict localhost patterns (`127.0.0.1(:port)` or `localhost(:port)`). Spoofed hosts from malicious domains attempting DNS rebinding are blocked.
- **Origin Validation**: Cross-origin requests from web domains (e.g. `http://malicious-site.com` or `http://attacker-localhost.com`) are rejected with `403 Forbidden`. Local origin headers are strictly bound without wildcard (`*`) fallbacks on sensitive endpoints.

### 3. Telemetry Read Integrity
- Telemetry reads (`GET /api/omniroute/accounts`, `GET /api/config`, `GET /api/diagnostics`) are **strictly read-only and idempotent**.
- No database mutations, insertions, or table modifications occur during telemetry fetching.

### 4. Zero Secrets in Source & Credentials Isolation
- API tokens, OAuth keys, and personal credentials are never stored in client code, frontend bundles, or Git repositories.
- The manager reads connection keys dynamically from local SQLite storage or environment variables (`OMNIROUTE_API_KEY`) at runtime.
- Built-in `DEMO_MODE` provides 100% synthetic mock fixtures for public demonstration and continuous integration without touching user disks.

### 5. Atomic File System Operations
- Writes to `config.toml` execute atomically (`.tmp-[timestamp]` followed by synchronous rename).
- Automated rolling backups (up to 10 snapshots) are generated prior to any write.
- Codex permissions (`sandbox_mode`, `approval_policy`, `approvals_reviewer`, `windows.sandbox`) and reasoning effort levels are preserved bit-for-bit without normalization.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within this project, please **do not open a public issue**.

Please report vulnerabilities privately via:
1. **GitHub Security Advisory**: Open a private draft advisory under the [Security tab](https://github.com/santi-osp/codex-config-manager/security/advisories/new).
2. **Direct Contact**: Contact the maintainer via GitHub profile `@santi-osp`.

Please provide:
- A description of the vulnerability.
- Steps to reproduce or a minimal proof-of-concept.
- An assessment of the potential impact.

We strive to acknowledge security reports within 48 hours and release validated patches swiftly.
