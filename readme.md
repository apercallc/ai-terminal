# AI Terminal for macOS

AI-powered macOS terminal app that can run commands for you, troubleshoot errors, and complete setup tasks automatically.

## Download

- Download (GitHub Releases): <https://github.com/apercallc/ai-terminal/releases>

Download the `.dmg` from the latest release and install the app normally.

Note: On first launch, macOS Gatekeeper may block the app. If that happens, open **System Settings → Privacy & Security** and allow it.

## Features

- Native macOS app (Tauri)
- Built-in terminal UI
- AI-assisted command execution and troubleshooting
- Safe mode (approval) and auto-accept mode
- Supports OpenAI, Anthropic, and local OpenAI-compatible servers

## Supported Providers

### OpenAI

Provide an API key that starts with `sk-...`.

### Anthropic

Provide an API key that starts with `sk-ant-...`.

### Local (LM Studio / Ollama / any OpenAI-compatible server)

Example settings:

- Base URL: `http://127.0.0.1:1234/v1`
- API Key: anything (many local servers ignore this)
- Model: `qwen2.5-7b-instruct`

## How It Works

1. You provide a goal (example: “install node”)
2. The agent proposes commands
3. Commands run in the integrated terminal
4. Output is analyzed; errors are fixed; steps are retried until complete

## Modes

- Safe Mode (default): shows each command and asks for approval
- Auto-Accept Mode: runs commands immediately (enable in Settings)

## Development

### Install

```bash
npm ci
```

### Run (Tauri dev)

```bash
npm run tauri dev
```

### Build (Tauri)

```bash
### Local notarization (macOS)

To troubleshoot notarization locally (same approach as CI), build a signed `.app` and then run:

- `./scripts/notarize-local.sh "/path/to/AI Terminal.app"`

This script reads notarization credentials from environment variables (Apple ID or App Store Connect API key). It does not print secrets.

If you want to mirror CI signing locally (temporary keychain + base64 `.p12`), you can use:

- `./scripts/build-signed-local.sh`
npm run tauri build
```

Build output (macOS): `src-tauri/target/release/bundle/dmg/`

## Publishing a Release (GitHub Actions)

This repo publishes public release downloads via GitHub Releases.

For a step-by-step production checklist (signing/notarization, clean-machine verification, website download config), see `docs/production-readiness.md`.

1. Update versions (keep these in sync):
   - `package.json` version
   - `src-tauri/tauri.conf.json` version
   - `src-tauri/Cargo.toml` version
2. Create and push a tag that starts with `v`:

```bash
git tag v1.0.1
git push origin v1.0.1
```

That triggers the GitHub Actions workflow and uploads the `.dmg` to the GitHub Release page.

The release workflow also uploads `checksums-sha256.txt` alongside the assets.

## Security Notes

- API keys are stored in macOS Keychain
- Auto-accept is optional
- This app can execute real shell commands; use responsibly

## License

MIT
