# Contributing to AI Terminal

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- **macOS** (native app — macOS only)
- **Node.js 20+** and npm
- **Rust** (latest stable via [rustup](https://rustup.rs/))
- **Xcode Command Line Tools**: `xcode-select --install`

### Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/terminal-ill.git
cd terminal-ill

# Install frontend dependencies
npm install

# Run in dev mode (starts Vite + Tauri)
npm run tauri dev
```

### Project Structure

```
terminal-ill/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Core libraries
│   │   ├── agent/          # AI agent (planner, executor, state machine)
│   │   ├── llm/            # LLM provider implementations
│   │   ├── safety/         # Command safety analysis
│   │   └── analytics/      # Usage metrics
│   ├── types/              # TypeScript type definitions
│   └── __tests__/          # Unit tests
├── src-tauri/              # Rust backend (Tauri)
│   └── src/
│       ├── pty.rs          # PTY management
│       ├── keychain.rs     # macOS Keychain integration
│       └── logger.rs       # Audit logging
├── e2e/                    # Playwright E2E tests
├── scripts/                # Build & utility scripts
└── docs/                   # Documentation
```

## Development Workflow

### Branching

- `main` — stable release branch
- `develop` — development integration branch
- `feature/*` — feature branches off develop
- `fix/*` — bug fix branches

### Making Changes

1. Create a feature branch: `git checkout -b feature/my-feature develop`
2. Make changes and write tests
3. Run the full test suite: `npm test`
4. Lint and format: `npm run lint && npm run format`
5. Commit with a descriptive message: `git commit -m "feat: add new LLM provider"`
6. Push and open a PR to `develop`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `style:` — formatting, no code change
- `refactor:` — code restructuring
- `test:` — adding/updating tests
- `chore:` — build process, tooling

## Testing

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# Watch mode
npx vitest --watch

# E2E tests (requires dev server running)
npm run tauri dev  # in another terminal
npx playwright test
```

### Test Coverage Requirements

- Minimum 70% coverage across lines, functions, branches, and statements
- All new code must include tests
- Safety-critical code (detector, executor) requires >90% coverage

## Code Style

- **TypeScript**: Strict mode, no `any` without justification
- **React**: Functional components with hooks, no class components
- **Rust**: Follow `cargo fmt` and `cargo clippy` standards
- **CSS**: BEM-like naming in component CSS files

### Formatting

```bash
npm run format    # Auto-format with Prettier
npm run lint      # ESLint check
cargo fmt --manifest-path src-tauri/Cargo.toml  # Rust formatting
```

## Adding a New LLM Provider

1. Create `src/lib/llm/my-provider.ts` implementing the `LLMProvider` interface
2. Add to the factory in `src/lib/llm/index.ts`
3. Add the provider type to `ProviderType` in `src/types/index.ts`
4. Update Settings component with provider options
5. Write unit tests in `src/__tests__/llm/my-provider.test.ts`

## Architecture Notes

- See [docs/architecture.md](docs/architecture.md) for detailed architecture docs
- LLM calls are made from the frontend (not Rust) for easier streaming
- PTY management is in Rust for native performance
- API keys are stored in the macOS Keychain (never in localStorage or files)

## Reporting Issues

- Use the GitHub issue tracker
- Include macOS version, app version, and steps to reproduce
- For crashes, include the log files from `~/Library/Application Support/com.aiterminal.app/logs/`

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
