# TODO - Windows 10/11 Support (Feature Parity with macOS)

Goal: ship Windows builds that match the current macOS feature set (terminal + agent + providers + safety + all “nice-to-have” panels).

## ✅ Definition of Done
- [ ] App runs on Windows 10 + 11 (fresh machine) with no missing runtime dependencies
- [ ] Same user-facing features as macOS (tabs, splits, session restore, SSH panel, recording, export, voice, collaboration, plugins/tools, etc.)
- [ ] Secrets storage works on Windows (equivalent to macOS Keychain)
- [ ] Installers produced in CI and attached to GitHub Releases
- [ ] CI runs unit tests + builds on Windows

## 🎯 Scope / Target Matrix
- [ ] Confirm minimum Windows 10 version (recommend 19041 / 2004+) and Windows 11
- [ ] Confirm CPU targets: x64 required; arm64 optional
- [ ] Confirm installer format(s): NSIS and/or MSI (Tauri bundle targets)
- [ ] Confirm WebView runtime requirement (WebView2); decide whether to bundle bootstrapper or require preinstall

## 🧱 Build, Bundle, Release

### Tauri Bundling
- [x] Windows subsystem configured for release (no console window) ✅ `src-tauri/src/main.rs`
- [x] Windows icon present ✅ `src-tauri/icons/icon.ico`
- [ ] Update `src-tauri/tauri.conf.json` bundle targets to include Windows (`"nsis"`, `"msi"`) alongside macOS
- [ ] Add Windows-specific bundle config (installer metadata, per-user install, upgrade code, etc.)
- [ ] Ensure `productName`, descriptions, and docs no longer claim “macOS only” once Windows ships

### Code Signing
- [ ] Decide signing strategy (Authenticode): certificate storage + timestamping endpoint
- [ ] Add signing to CI release workflow (secrets + tauri-action env)
- [ ] Document local signing steps for maintainers

### CI / GitHub Actions
- [ ] Add Windows job to `.github/workflows/ci.yml` to run:
  - `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`
  - Rust format/clippy (or at minimum `cargo build` for `src-tauri`)
- [ ] Add Windows build artifacts to `.github/workflows/release.yml`:
  - Upload `.exe`/`.msi`/`.nsis` outputs from `src-tauri/target/release/bundle/**`
- [ ] Make icon generation step cross-platform (current workflows assume `bash` on macOS)

## 🧩 Rust Backend: Windows Portability

### 1) Secrets Storage (macOS Keychain parity)
Current state: `src-tauri/src/keychain.rs` uses a cross-platform credential backend (`keyring`) and is compiled/registered on all platforms.

- [x] Avoid macOS-only keychain dependency in Rust backend
- [x] Use OS credential store on Windows via `keyring` (Credential Manager)
- [ ] Ensure Tauri commands stay the same on all platforms:
  - `store_api_key(provider, api_key)`
  - `get_api_key(provider)`
  - `delete_api_key(provider)`
- [ ] Update error handling semantics to match macOS behavior (missing key returns `None`, not an error)
- [ ] Add/extend unit tests (mocked at frontend is fine) to cover Windows codepath behavior

### 2) PTY + Shell Support
- [x] PTY backend is already portable (`portable-pty`) ✅ `src-tauri/src/pty.rs`
- [ ] Validate `portable-pty` + ConPTY behavior on Windows (resize, kill, exit events, long output)
- [ ] Decide default shell on Windows:
  - PowerShell 7 if installed
  - else Windows PowerShell
  - optional: cmd.exe
  - optional: WSL (`wsl.exe`) for a “Linux-like” shell
- [ ] Ensure completion-marker detection is robust with CRLF output on Windows
- [ ] Ensure encoding is correct (UTF-8 output, non-ASCII characters)

### 3) Files/Paths/Logs
- [ ] Confirm log directory location on Windows (AppData/Roaming via `dirs`/Tauri app paths)
- [ ] Update troubleshooting docs with Windows log path
- [ ] Validate `list_directory` and path handling works with Windows separators and drive letters

## 🪟 Frontend + WebView2 Behavior

### WebView2 Compatibility Checks
- [ ] Verify clipboard copy/paste, selection, and keyboard shortcuts behave as expected in WebView2
- [ ] Verify window sizing/min sizes match expectations on Windows
- [ ] Verify file downloads/exports (HTML/PDF) work on Windows (print-to-PDF behavior differs)

### Voice Input Parity
- [ ] Verify Web Speech API availability/behavior inside Tauri WebView2
- [ ] If Web Speech is unavailable or limited, implement an equivalent Windows voice input path (same UX surface)

## 🧪 Feature Parity Test Matrix (Windows)

### Core App
- [ ] Launch, create terminal tab, run commands, stop/cancel
- [ ] Tabs + splits + drag resizing
- [ ] Session persistence restore (tabs/splits) after app restart

### Agent + Safety
- [ ] Safe mode approval modal works for every step
- [ ] Auto-accept mode works; cancel/stop interrupts correctly
- [ ] Dangerous-command detector parity (same risk levels + blacklist behavior)
- [ ] JSONL audit logging created and readable in History view

### Providers
- [ ] OpenAI: save/load/delete API key (Windows secure storage), test connection, streaming
- [ ] Anthropic: save/load/delete API key, test connection, streaming
- [ ] Local: base URL + model, `/models` validation, streaming

### Panels / “Nice-to-Haves”
- [ ] Suggestions / CommandPalette
- [ ] Templates panel (CRUD + substitution)
- [ ] Shortcuts panel (record keys; ensure key combos are captured correctly on Windows)
- [ ] Bookmarks panel (import/export)
- [ ] Tools panel + Plugins panel (hook execution, persistence)
- [ ] Collaboration panel (create/join session, command sharing)
- [ ] Recording controls (record/playback/import/export)
- [ ] Export panel (HTML/PDF/text output)
- [ ] SSH panel:
  - Confirm `ssh` availability on Windows (OpenSSH Client optional feature)
  - Key path selection + quoting works with Windows paths

### Automated Testing
- [ ] Run unit tests on Windows in CI
- [ ] Add a small Windows smoke E2E (launch app + render terminal) if feasible in GitHub Actions

## 📚 Documentation Updates
- [ ] Update `readme.md` and `docs/setup.md` to include Windows prerequisites (Node, Rust, MSVC Build Tools, WebView2)
- [ ] Update `docs/troubleshooting.md` with Windows-specific troubleshooting + log locations
- [ ] Update `docs/architecture.md` to describe cross-platform key storage (not “macOS Keychain only”)

## 🚢 Release Checklist (Windows)
- [ ] Build + sign installers in release workflow
- [ ] Attach Windows artifacts to GitHub Release
- [ ] Verify install/uninstall/upgrade on clean Windows 10 VM
- [ ] Verify first-run experience (permissions, voice, network access)

---

Last updated: Windows support planning checklist created.
