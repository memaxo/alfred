# Using ALFRED TUI with Local MLX Models

This guide covers how to set up and use the ALFRED Terminal UI (TUI) with local models served via MLX on Apple Silicon.

## Requirements

- **Hardware**: Apple Silicon Mac (M1, M2, M3, M4)
- **OS**: macOS 13.5+
- **Python**: 3.11+
- **ALFRED**: TUI installed (`@alfred/tui`)

## Setup

### 1. Install vllm-mlx

The `vllm-mlx` server is vendored in the ALFRED repository.

```bash
# Navigate to vendor directory
cd vendor/vllm-mlx

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install in editable mode
pip install -e .
```

### 2. Start the Local Model Server

Serve a model like GLM-4.7 Flash (optimized for speed and efficiency).

```bash
vllm-mlx serve mlx-community/GLM-4.7-Flash-8bit-gs32 \
  --host 0.0.0.0 --port 8000 \
  --continuous-batching --use-paged-cache
```

### 3. Configure ALFRED TUI

Ensure the TUI knows where to find the local server. You can set these in your `.env` or pass them as environment variables.

```bash
export VLLM_MLX_BASE_URL=http://localhost:8000/v1
# Optional: if you set --api-key on the server
# export VLLM_MLX_API_KEY=your-secret-key
```

### 4. Launch TUI Chat

Start the TUI directly in chat mode or navigate from the dashboard.

```bash
# Start directly in chat mode
alfred tui chat

# Or start dashboard and press Ctrl+T
alfred tui
```

## Features

- **Fully Offline**: No data leaves your machine when using local models.
- **Model Switching**: Press `Ctrl+M` in chat mode to switch between local MLX models and cloud providers.
- **Rich Formatting**: Real-time markdown rendering with syntax-highlighted code blocks.
- **Persistent History**: Chat sessions are saved locally to `~/.alfred/tui/chat_history.json`.
- **Health Monitoring**: Real-time MLX connection status in the chat header.

## Troubleshooting

- **Server Offline**: Verify `vllm-mlx` is running and reachable at the configured `VLLM_MLX_BASE_URL`.
- **Performance**: Ensure you are using a quantized model (e.g., `-8bit` or `-4bit`) for optimal speed on consumer hardware.
- **Port Conflicts**: If port 8000 is taken, change the `--port` in the serve command and update `VLLM_MLX_BASE_URL`.
