# Production Readiness (macOS) — Remaining Work

Date: 2026-02-09

Scope: **Everything except Windows support**. This document covers:
- macOS desktop app release (Tauri)
- docs/marketing website + download endpoint
- operational/security readiness (signing, notarization, incident response)

---

## 0) Quick definition of “production ready”

A release is considered production-ready when:
- A tag push (e.g. `v1.0.1`) successfully publishes a **signed + notarized** DMG to GitHub Releases.
- Checksums are published alongside the release.
- App behavior matches the security checklist (no auto-exec in prod, secrets not persisted in plaintext, audit logs redacted).
- Website download endpoint serves the current DMG via a **https-only** signed URL (or bundled artifact) with optional host allowlist.
- You have an incident response path (SECURITY.md + runbook).

---

## 1) Release prerequisites (one-time setup)

### 1.1 Apple signing + notarization requirements

- [ ] Apple Developer Program membership
- [ ] Developer ID Application certificate
- [ ] An App-Specific Password for notarization

### 1.2 Configure GitHub Actions secrets (required for tag-based production releases)

These must be set in the repo’s GitHub Actions secrets:

- [ ] `APPLE_CERTIFICATE` — base64 of a `.p12`
- [ ] `APPLE_CERTIFICATE_PASSWORD` — password for the `.p12`
- [ ] `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: <Name> (<TeamID>)`
- [ ] `APPLE_TEAM_ID` — your Team ID
- [ ] `APPLE_ID` — Apple ID email
- [ ] `APPLE_PASSWORD` — app-specific password

Notes:
- Tag pushes require these secrets; the workflow intentionally fails without them.
- If you *must* produce an unsigned build temporarily, use `workflow_dispatch` with `allow_unsigned=true` (it will be marked `prerelease`).

### 1.3 Produce `APPLE_CERTIFICATE` (base64) from a p12

Example (local machine):

```bash
# Export your Developer ID Application cert + private key to a .p12 using Keychain Access.
# Then base64 it for GitHub Secrets:
base64 -i path/to/certificate.p12 | pbcopy
```

---

## 2) Pre-release code & config checks (every release)

### 2.1 Version synchronization

Keep these versions in sync:
- [ ] `package.json` version
- [ ] `src-tauri/tauri.conf.json` version
- [ ] `src-tauri/Cargo.toml` version

### 2.2 Local validation (fast)

Run locally:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run tauri build
```

---

## 3) Security checklist verification (every release)

Use: `docs/security/final-release-checklist.md`

### 3.1 Desktop app

- [ ] API keys stored only in Keychain (no plaintext persistence)
  - Implementation: `src-tauri/src/keychain.rs` + frontend avoids saving keys to localStorage.
- [ ] Audit logs redact secrets and are stored with restrictive permissions
  - Implementation: `src-tauri/src/logger.rs` (redaction + file/dir permissions).
- [ ] Auto-execution disabled in production builds
  - Implementation: `src/lib/agent/executor.ts` + `src/hooks/useSettings.ts`.
- [ ] CSP is restrictive
  - Implementation: `src-tauri/tauri.conf.json`.
- [ ] External URL opening is allowlisted and https-only
  - Implementation: `src-tauri/src/external.rs` (host allowlist).

### 3.2 Signing/notarization

- [ ] Confirm the release workflow produced notarized artifacts (no fallback text in release body)
- [ ] Confirm `checksums-sha256.txt` exists as a release asset

---

## 4) Cut a production release (macOS)

### 4.1 Ensure main is green

- [ ] CI passes on main (lint, typecheck, unit tests, E2E smoke).

### 4.2 Create and push the tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Expected:
- The “Release” workflow runs.
- It builds signed + notarized artifacts.
- It publishes DMG + checksums to GitHub Releases.

### 4.3 Post-build verification (release artifacts)

On a macOS machine:

- [ ] Download DMG from GitHub Releases
- [ ] Verify checksum matches `checksums-sha256.txt`

```bash
shasum -a 256 path/to/AI\ Terminal_*.dmg
```

- [ ] Verify Gatekeeper assessment (should pass if notarized):

```bash
spctl -a -vv path/to/AI\ Terminal.app
```

- [ ] Verify codesign:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/AI\ Terminal.app
```

---

## 5) Clean-machine smoke test (release candidate)

Use a fresh macOS VM/user profile.

- [ ] Install: drag app from DMG → Applications
- [ ] First run: no unexpected prompts beyond normal macOS security prompts
- [ ] Terminal spawns and runs a basic command (e.g. `echo hello`)
- [ ] Safe Mode approval works end-to-end for an agent goal
- [ ] API key save/load/delete works via Keychain
- [ ] Audit log is created and entries are readable in History
- [ ] Uninstall flow: Settings → Uninstall guidance works; local data deletion behaves as expected

---

## 6) Website / docs deployment (production)

The docs server is `scripts/serve-docs.mjs`.

### 6.1 Configure downloads

Option A — Redirect to your signed binary URL:
- [ ] Set `AI_TERMINAL_DMG_URL` to an `https://` URL
- [ ] (Recommended) Set `AI_TERMINAL_DOWNLOAD_ALLOW_HOSTS` to a comma-separated host allowlist

Option B — Bundle DMG with the site:
- [ ] Place the DMG at `docs/downloads/ai-terminal-macos.dmg`

### 6.2 Provide a checksum endpoint (optional but recommended)

- [ ] Set `AI_TERMINAL_DMG_SHA256` to the DMG checksum

This enables:
- `GET /downloads/ai-terminal-macos.dmg.sha256`

### 6.3 Security headers and TLS

- [ ] Serve behind HTTPS
- [ ] Ensure HSTS and CSP headers are set at edge if using a CDN/WAF
- [ ] Add rate limiting at edge for multi-node deployments

See: `docs/security/website-headers.md`

---

## 7) Incident response readiness (one-time, then keep current)

- [ ] Confirm `SECURITY.md` email is monitored
- [ ] Ensure the runbook is usable by maintainers

See: `docs/security/incident-response.md`

---

## 8) Optional hardening (recommended before broader distribution)

- [ ] Add dependency vulnerability scanning to CI (npm + cargo)
- [ ] Ensure release signing keys and Apple secrets are rotation-ready
- [ ] Document internal “release captain” checklist (who does what, when)
