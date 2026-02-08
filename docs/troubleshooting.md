# Troubleshooting

## Build Issues

### `cargo build` fails with missing system libraries

**Fix**: Install Xcode Command Line Tools:
```bash
xcode-select --install
```

### `npm run tauri dev` shows blank window

**Cause**: Vite dev server hasn't started yet.

**Fix**: Wait a few seconds for Vite to compile. Check that port 1420 is not in use:
```bash
lsof -i :1420
```

### Rust compilation is slow

**Fix**: Use `sccache` for caching:
```bash
brew install sccache
export RUSTC_WRAPPER=sccache
```

## Runtime Issues

### Terminal shows "Disconnected" overlay

**Cause**: PTY session failed to spawn or crashed.

**Fix**:
1. Check that your default shell exists: `echo $SHELL`
2. Restart the app
3. Check logs in `~/Library/Application Support/com.aiterminal.app/logs/`

### API key not loading

**Cause**: Keychain access issue.

**Fix**:
1. Open macOS Keychain Access app
2. Search for "com.aiterminal.app"
3. Verify the entry exists
4. If corrupted, delete and re-enter in Settings

### LLM connection test fails

**OpenAI**:
- Verify your API key is valid and has credits
- Check that `https://api.openai.com` is reachable
- Ensure the model name is correct (e.g., `gpt-4`, not `GPT-4`)

**Anthropic**:
- Verify API key starts with `sk-ant-`
- Check that your account has API access enabled

**Local**:
- Verify local server is running: `curl http://127.0.0.1:1234/v1/models`
- Check the correct port and model name
- Ensure the model is fully loaded before testing

### Commands hang during execution

**Cause**: The command is waiting for input, or the completion marker wasn't detected.

**Fix**:
1. Click "Stop" to abort
2. Avoid commands with interactive prompts (use `-y` flags)
3. If persistent, restart the terminal session

### High CPU usage

**Cause**: Terminal output flood or runaway process.

**Fix**:
1. Kill the running process in the terminal
2. Reduce scrollback buffer in Settings → Advanced → Scrollback Lines
3. If the issue is in a child process, use `kill` or `pkill`

## Agent Issues

### Agent generates bad plans

**Fix**:
- Use a more capable model (GPT-4 over GPT-3.5)
- Be more specific in your goal description
- Break complex goals into smaller steps

### Agent stuck in "retrying" state

**Cause**: Repeated failures exceeding the retry limit.

**Fix**:
1. Click "Stop" to cancel
2. Check the command output in the terminal for error details
3. Rephrase your goal
4. Increase max retries in Settings → Advanced

### Safety detector blocks a safe command

**Fix**: The safety detector uses pattern matching which can produce false positives. You can still approve the command manually in Safe Mode. If you consistently get false positives, consider switching to Auto-Accept Mode (use with caution).

## Log Files

Logs are stored at:
```
~/Library/Application Support/com.aiterminal.app/logs/
```

Each file is named `YYYY-MM-DD.jsonl` and contains one JSON entry per line:
```json
{
  "id": "uuid",
  "timestamp": "ISO 8601",
  "command": "the command",
  "source": "agent|user",
  "risk_level": "safe|low|medium|high|critical",
  "approved": true,
  "exit_code": 0,
  "output_preview": "first 200 chars...",
  "session_id": "uuid"
}
```

## Getting Help

If none of the above resolves your issue:

1. Check the [GitHub Issues](https://github.com/yourusername/terminal-ill/issues)
2. Open a new issue with:
   - macOS version
   - App version
   - Steps to reproduce
   - Relevant log entries
