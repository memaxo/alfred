# TUI Modes Guide

## Overview

ALFRED's TUI provides three interactive modes for different workflows. Each mode is optimized for a specific interaction pattern.

## Available Modes

| Mode      | Purpose                                    | Shortcut |
| --------- | ------------------------------------------ | -------- |
| **Chat**  | Conversational interaction with ALFRED     | `c`      |
| **Plan**  | Workflow planning and execution monitoring | `p`      |
| **Debug** | System debugging and diagnostics           | `d`      |

## Chat Mode

Interactive conversation with the ALFRED assistant using SSE streaming.

### Launching

```bash
# Launch directly
alfred tui chat

# Or from dashboard
# Press 'c' to enter chat mode
```

### Features

- Real-time streaming responses
- Message history with scrolling
- Tool call visibility
- Abort streaming with Ctrl+C

### Keyboard Shortcuts

| Key               | Action                    |
| ----------------- | ------------------------- |
| `Enter`           | Send message              |
| `↑/↓`             | Navigate input history    |
| `PageUp/PageDown` | Scroll message history    |
| `Ctrl+C`          | Cancel streaming response |
| `Ctrl+A`          | Move cursor to start      |
| `Ctrl+E`          | Move cursor to end        |
| `Escape`          | Exit chat mode            |

### Example Session

```
┌─ ALFRED Chat ────────────────────────────────────┐
│                                                  │
│ You: Create a todo for reviewing PRs             │
│                                                  │
│ Alfred: I'll create that todo for you.           │
│ > Calling todo.create...                         │
│                                                  │
│ Done! Created todo: "Review PRs" with priority 2 │
│                                                  │
├──────────────────────────────────────────────────┤
│ > Type a message...                              │
└──────────────────────────────────────────────────┘
 [Enter] Send  [Ctrl+C] Cancel  [Esc] Exit
```

## Plan Mode

Workflow planning, execution monitoring, and task management.

### Launching

```bash
# Launch directly
alfred tui plan

# Or from dashboard
# Press 'p' to enter plan mode
```

### Features

- View active workflow runs
- Monitor execution progress
- See task breakdowns
- View execution logs
- Cancel running workflows

### Keyboard Shortcuts

| Key      | Action                   |
| -------- | ------------------------ |
| `Enter`  | Start new workflow       |
| `↑/↓`    | Navigate workflows       |
| `Tab`    | Switch between panes     |
| `c`      | Cancel selected workflow |
| `r`      | Refresh status           |
| `l`      | View logs                |
| `Escape` | Exit plan mode           |

### Layout

```
┌─ Active Workflows ─────────┬─ Details ────────────────┐
│ ▶ Build feature X  [75%]  │ Run ID: run_abc123       │
│   Review PR #42    [done] │ Status: In Progress      │
│   Deploy staging   [wait] │ Started: 2 min ago       │
│                           │                          │
│                           │ Tasks:                   │
│                           │ ✅ Parse requirements    │
│                           │ ⏳ Generate code         │
│                           │ ⬜ Run tests             │
│                           │ ⬜ Create PR             │
└───────────────────────────┴──────────────────────────┘
 [Tab] Switch pane  [c] Cancel  [l] Logs  [Esc] Exit
```

## Debug Mode

System diagnostics, state inspection, and troubleshooting.

### Launching

```bash
# Launch directly
alfred tui debug

# Or from dashboard
# Press 'd' to enter debug mode
```

### Features

- Cognitive state inspection
- Event log viewer
- Metrics dashboard
- Pool health status
- Database connectivity check

### Keyboard Shortcuts

| Key      | Action          |
| -------- | --------------- |
| `Tab`    | Cycle panels    |
| `r`      | Refresh all     |
| `c`      | Cognitive state |
| `e`      | Event log       |
| `m`      | Metrics         |
| `p`      | Pool status     |
| `Escape` | Exit debug mode |

### Panels

#### Cognitive State Panel

Shows current cognitive phase, autonomy level, and physiology values.

```
┌─ Cognitive State ──────────────────────────────────┐
│ Phase: idle → thinking                             │
│ Autonomy: 0.75                                     │
│ Physiology:                                        │
│   Energy:     ████████████████████░░░░ 82%         │
│   Focus:      █████████████████░░░░░░░ 68%         │
│   Stress:     ████░░░░░░░░░░░░░░░░░░░░ 15%         │
└────────────────────────────────────────────────────┘
```

#### Event Log Panel

Real-time event stream with filtering.

```
┌─ Event Log ────────────────────────────────────────┐
│ [12:34:56] cognitive.transition idle→thinking      │
│ [12:34:55] workflow.start run_abc                  │
│ [12:34:54] assistant.generate started              │
│ [12:34:53] todo.create id=123                      │
└────────────────────────────────────────────────────┘
```

#### Metrics Panel

System performance metrics with sparklines.

```
┌─ Metrics ──────────────────────────────────────────┐
│ Request Latency (p99): 45ms  ▁▂▃▅▂▁▂▃▄▂          │
│ Active Requests:       3     ▃▄▅▄▃▄▅▆▅▄          │
│ Error Rate:            0.1%  ▁▁▁▂▁▁▁▁▂▁          │
│ Memory Usage:          512MB ▄▄▄▄▅▅▅▅▅▆          │
└────────────────────────────────────────────────────┘
```

## Dashboard View

The default TUI view shows multiple panels simultaneously.

### Launching

```bash
alfred tui
```

### Layout

```
┌─ Header ─────────────────────────────────────────────────────────┐
│ ALFRED v0.1.0                         🟢 Connected    12:34:56   │
├─ Cognitive ──────────┬─ Workflow ──────────┬─ Voice ─────────────┤
│ Phase: idle          │ Active: 2           │ STT: ✅ Ready       │
│ Autonomy: 0.75       │ Queued: 0           │ TTS: ✅ Ready       │
│ Energy: 82%          │ Last: 5m ago        │ Sessions: 0         │
├──────────────────────┴─────────────────────┴─────────────────────┤
│ Knowledge: 1,234 facts | Metrics: 45ms p99 | Memory: 512MB       │
└──────────────────────────────────────────────────────────────────┘
 [c] Chat  [p] Plan  [d] Debug  [q] Quit  [?] Help
```

### Panel Navigation

| Key         | Action         |
| ----------- | -------------- |
| `Tab`       | Next panel     |
| `Shift+Tab` | Previous panel |
| `1-9`       | Jump to panel  |
| `r`         | Refresh all    |
| `?`         | Show help      |
| `q`         | Quit           |

## Configuration

### Environment Variables

```bash
# Skip intro animation
ALFRED_TUI_SKIP_INTRO=true

# Theme (light/dark/auto)
ALFRED_TUI_THEME=dark

# Refresh interval (ms)
ALFRED_TUI_REFRESH_MS=1000
```

### Command Line Options

```bash
# Skip intro sequence
alfred tui --skip-intro

# Start in specific mode
alfred tui chat
alfred tui plan
alfred tui debug

# JSON output for scripting
alfred tui --json
```

## Troubleshooting

### "Connection failed" error

1. Check if the API server is running: `curl http://localhost:3000/healthz`
2. Verify `ALFRED_API_URL` environment variable
3. Check network connectivity

### Panels not updating

1. Press `r` to force refresh
2. Check SSE connection status in header
3. Verify tRPC subscriptions are working

### Display issues

1. Ensure terminal supports Unicode (UTF-8)
2. Try a different terminal emulator
3. Check terminal size (minimum 80x24)

### Keyboard shortcuts not working

1. Check for terminal key mapping conflicts
2. Try running without tmux/screen
3. Verify raw mode is enabled

## See Also

- [TUI Architecture](../architecture/tui-architecture.md)
- [Package Manifests](package-manifests.md)
- [MCP Integration](mcp-integration.md)
