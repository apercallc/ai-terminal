# Setup Guide

## Prerequisites

| Requirement | Version | Install |
|------------|---------|---------|
| macOS | 10.15+ | — |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) or `brew install node` |
| Rust | latest stable | [rustup.rs](https://rustup.rs/) |
| Xcode CLI Tools | latest | `xcode-select --install` |

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org-or-username>/ai-terminal.git
cd ai-terminal
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Verify Rust Installation

```bash
rustc --version   # Should show 1.75+
cargo --version
```

If Rust is not installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 4. Run in Development Mode

```bash
npm run tauri dev
```

This starts:
- Vite dev server on `http://localhost:1420`
- Tauri app window connected to the dev server

Hot reload is active for both frontend (Vite HMR) and Rust (recompile on change).

## LLM Provider Setup

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Open Settings (⚙️ in status bar)
3. Select "OpenAI" as provider
4. Paste your API key
5. Click "Save to Keychain"
6. Click "Test Connection"

### Anthropic (Claude)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Select "Anthropic (Claude)" as provider
3. Paste your API key (starts with `sk-ant-`)
4. Save and test

### Local LLM (LM Studio / Ollama)

1. Install [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.ai/)
2. Start the local server
3. Select "Local LLM" as provider
4. Set Base URL (default: `http://127.0.0.1:1234/v1`)
5. Enter the model name loaded in your local server
6. Test connection

## Building for Production

```bash
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/dmg/AI Terminal.dmg`
- `src-tauri/target/release/bundle/macos/AI Terminal.app`

### Signing (Optional)

For distribution, set up code signing:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
npm run tauri build
```

## Running Tests

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# E2E (requires dev server)
npx playwright test
```

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
