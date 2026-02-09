# macOS Entitlements + Signing Checklist

## Developer ID distribution (recommended for direct download)

- Enable **Hardened Runtime** (codesign default for notarization)
- Use a minimal entitlements file (see `src-tauri/entitlements.plist`)
- Sign:
  - `.app` inside the bundle
  - frameworks/helpers
  - final `.app`
  - final `.dmg`
- Notarize the final `.dmg`
- Staple the notarization ticket

## App Sandbox (Mac App Store only)

App Sandbox is **not** recommended for this terminal-style app unless you are shipping via the Mac App Store and redesign for sandbox limitations.

If you do sandbox:
- Expect restrictions on spawning shells and arbitrary filesystem access.
- Use security-scoped bookmarks for file access.

## Minimum entitlement guidance

- Keep empty unless a concrete feature requires it.
- Avoid `com.apple.security.cs.allow-jit`, `disable-library-validation`, etc. unless you have a very specific, reviewed need.

## CI Secrets (GitHub Actions)

You will typically need:
- `APPLE_CERTIFICATE` (base64 p12)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD` (app-specific password)
- `APPLE_TEAM_ID`

If using Tauri updater signature:
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
