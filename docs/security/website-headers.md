# Website Security Headers (Production)

This repo’s docs server (`scripts/serve-docs.mjs`) sets strong defaults (CSP, COOP/CORP, HSTS when behind HTTPS, etc.).

If you deploy behind a CDN / reverse proxy, configure headers at the edge as well.

## Recommended headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; ...`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

## TLS requirements

- Redirect HTTP → HTTPS at the edge
- Disable mixed content
- Prefer modern TLS config and automatic certificate rotation

## Rate limiting

- Enforce at the edge (WAF/CDN). The Node server includes a basic single-node limiter.

## Secure downloads

- Prefer short-lived **signed URLs** for binaries.
- Set `AI_TERMINAL_DMG_URL` to the signed https URL.
- Optionally set `AI_TERMINAL_DOWNLOAD_ALLOW_HOSTS` to restrict redirect targets.
- Publish `AI_TERMINAL_DMG_SHA256` to allow manual verification.
