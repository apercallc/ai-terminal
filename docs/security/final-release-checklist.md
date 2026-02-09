# Final Security Checklist (Pre-Release)

## Desktop app

- [ ] API keys stored only in Keychain; no plaintext persistence
- [ ] Audit logs redact secrets and are stored with restrictive permissions
- [ ] Auto-execution disabled in production; approval required for AI commands
- [ ] No shell/command execution plugins exposed to the WebView
- [ ] CSP is restrictive (no `https://*` connect-src)
- [ ] External URL opening is allowlisted and https-only

## Signing / notarization

- [ ] Build in CI with Apple Developer ID signing
- [ ] Notarize and staple the DMG
- [ ] Generate SHA-256 checksums for all release assets and publish them
- [ ] Store signing keys in CI secrets; rotate on compromise

## Website

- [ ] TLS everywhere; HSTS enabled
- [ ] CSP deployed as a response header (not only meta tags)
- [ ] Clickjacking protections enabled (`frame-ancestors 'none'`)
- [ ] Rate limiting enabled at edge
- [ ] Download endpoint uses signed URLs; no public bucket listing

## Incident response

- [ ] SECURITY.md present with working disclosure email
- [ ] Triage/runbook for incoming reports
