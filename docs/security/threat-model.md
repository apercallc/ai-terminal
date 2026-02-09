# Threat Model (Summary)

## Assets to protect

- User API keys (OpenAI/Anthropic/local provider tokens)
- User filesystem contents and shell execution context
- Release artifacts (DMG/App) and update channel
- Audit logs (may contain command history)

## Trust boundaries

- WebView UI (untrusted input surface) → Tauri/Rust commands (privileged)
- AI model output (untrusted) → command execution
- Network (untrusted) → provider APIs, downloads
- Local machine (semi-trusted) → other processes, environment variables

## Primary threats

- **Secret exfiltration**: API keys leaking via localStorage, logs, crash reports, or XSS.
- **Arbitrary command execution**: AI or injected content triggering shell/plugin APIs.
- **Supply-chain compromise**: tampered DMG or update artifacts.
- **Phishing/exfil via URL openers**: opening attacker-controlled URLs.
- **Website attacks**: XSS, clickjacking, mixed content, insecure redirects.

## Mitigations implemented in this repo

- API keys stored in macOS Keychain (never persisted in localStorage).
- Removed Tauri shell plugin to reduce RCE surface.
- AI command execution hardened (single-line enforcement; auto-exec disabled in prod).
- Audit logs redact common secret patterns.
- Docs server adds strict security headers, HSTS (when behind HTTPS), download rate limiting, and validated https-only download redirects.

## Remaining risks / operational mitigations

- Any terminal app can run user-typed commands; protect AI paths with approval UX.
- Use Apple code signing + notarization; publish checksums; keep signing keys isolated.
- Enforce WAF/CDN rate limiting and TLS termination for public website.
