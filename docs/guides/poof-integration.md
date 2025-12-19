# Poof Integration Guide

## Overview

ALFRED integrates with [poof](https://github.com/Jarred-Sumner/poof) for ephemeral filesystem isolation during multi-agent wave execution. Poof provides lightweight sandboxing using Linux overlayfs and namespaces, enabling:

- **Ephemeral execution**: Filesystem changes vanish when agents complete
- **Reviewable changes**: Changes captured for inspection before applying
- **Resource guardrails**: Memory, PID, and timeout limits via cgroups

## When to Use Poof

| Use Case | Poof Mode | Description |
|----------|-----------|-------------|
| Research agents | `exec` | Exploratory work where changes should not persist |
| Coder agents | `run` | Changes captured for review before merging |
| Untrusted scripts | `exec` | Run potentially dangerous commands safely |
| Parallel agents | `run` | Isolate each agent's filesystem changes |

## Prerequisites

### Linux Host

Poof only works on Linux (uses kernel namespaces and overlayfs). On macOS/Windows, ALFRED automatically falls back to worktree-based isolation.

### Installation

**Recommended: Use the installation script**

```bash
bun run install:poof
```

**Manual installation:**

```bash
# Debian / Ubuntu
curl -LO https://github.com/jarred-sumner/poof/releases/latest/download/poof_amd64.deb
sudo dpkg -i poof_amd64.deb

# Arch Linux
curl -LO https://github.com/jarred-sumner/poof/releases/latest/download/poof-x86_64.pkg.tar.xz
sudo pacman -U poof-x86_64.pkg.tar.xz

# Static Binary (any distro)
curl -L https://github.com/jarred-sumner/poof/releases/latest/download/poof-linux-x86_64-musl -o poof
chmod +x poof
sudo mv poof /usr/local/bin/
```

### Docker Requirements

When running ALFRED inside Docker, poof needs additional permissions:

| Setup | Docker Flags |
|-------|--------------|
| Recommended (fuse-overlayfs) | `--device /dev/fuse --security-opt seccomp=unconfined` |
| Kernel overlayfs | `--cap-add=SYS_ADMIN --security-opt seccomp=unconfined` |
| Simple (full access) | `--privileged` |

Example docker-compose:

```yaml
services:
  alfred:
    image: alfred:latest
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/fuse
    cap_add:
      - SYS_ADMIN  # Only if not using fuse-overlayfs
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCH_USE_POOF=1` | Enable poof isolation for agent waves | Disabled |
| `ORCH_POOF_PROFILE` | Default resource profile | `standard` |
| `POOF_BIN` | Override poof binary path | Search PATH |

### Resource Profiles

ALFRED provides predefined resource profiles:

| Profile | Memory | PIDs | Timeout | Use Case |
|---------|--------|------|---------|----------|
| `minimal` | 256M | 20 | 60s | Simple file operations |
| `standard` | 1G | 100 | 300s | Build/test tasks |
| `intensive` | 4G | 500 | 600s | Large builds, ML inference |

## Usage

### Enable Poof Isolation

Set the environment variable before starting the orchestrator:

```bash
ORCH_USE_POOF=1 bun run dev
```

### Programmatic Usage

```typescript
import { WorkspaceFactory } from "@alfred/agent/environment/factory";

// Create a poof-isolated workspace
const workspace = await WorkspaceFactory.create(
  "poof",
  "agent-1",
  "run-123",
  "/path/to/repo",
  {
    poofProfile: "standard",
    poofMode: "run",
  }
);

await workspace.initialize();

// Execute commands in isolation
const result = await workspace.exec("npm test");

// Review changes before applying
const changes = await workspace.getChanges();
console.log(workspace.formatChanges(changes));

// Apply or discard
if (approved) {
  await workspace.applyChanges();
} else {
  await workspace.discardChanges();
}

await workspace.cleanup();
```

### Wave Handoff

For synthesis agents to review changes from prior waves:

```typescript
import { createWaveHandoff } from "@alfred/agent/spawn";

const handoff = createWaveHandoff("/path/to/repo");

// Record completed wave
handoff.recordWave("wave_0", [
  { agentId: "agent-1", upperDir: "/tmp/upper-1", exitCode: 0, timedOut: false, durationMs: 1000 },
  { agentId: "agent-2", upperDir: "/tmp/upper-2", exitCode: 0, timedOut: false, durationMs: 1500 },
], startTime, endTime);

// Synthesis agent reviews all changes
const report = await handoff.generateSynthesisReport();

// Detect conflicts (files modified by multiple agents)
const conflicts = await handoff.detectConflicts();

// Apply changes from specific agent
await handoff.applyAgentChanges("agent-1");
```

## What Poof Isolates

| Isolated | Not Isolated |
|----------|--------------|
| Filesystem writes | Network access |
| Filesystem deletes | Environment variables |
| Process tree (PID namespace) | GPU/hardware access |
| Hostname (UTS namespace) | System time |
| System V IPC | User credentials |

**Important**: Poof does NOT isolate network access. Agents can still make HTTP requests and access external services.

## Limitations

1. **Linux only**: Uses kernel-specific features unavailable on macOS/Windows
2. **Overlay depth limit**: Maximum 2 levels of overlay stacking (kernel limit)
3. **Container nesting**: Inside Docker, you get 1 poof level with kernel overlayfs; use fuse-overlayfs for more
4. **No network isolation**: Commands can access the network

## Troubleshooting

### Poof Not Available

If poof is not found, ALFRED falls back to worktree isolation. Check:

```bash
# Verify poof is installed
which poof
poof --version

# Check if running on Linux
uname -s  # Should output "Linux"
```

### Permission Denied

Running poof as non-root requires:

1. `fuse-overlayfs` installed
2. User namespaces enabled: `sudo sysctl kernel.unprivileged_userns_clone=1`

### Docker Issues

Verify Docker has the required permissions:

```bash
# Test poof inside container
docker run --device /dev/fuse --security-opt seccomp=unconfined ubuntu:22.04 bash -c "
  apt-get update && apt-get install -y curl fuse-overlayfs
  curl -L https://github.com/jarred-sumner/poof/releases/latest/download/poof-linux-x86_64-musl -o /usr/local/bin/poof
  chmod +x /usr/local/bin/poof
  poof exec echo 'Poof works!'
"
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Agent Command                 │
├─────────────────────────────────────────┤
│         Overlay Filesystem              │
│  ┌─────────────┐    ┌────────────────┐  │
│  │ Upper Layer │ +  │  Lower Layer   │  │
│  │  (changes)  │    │ (host root /)  │  │
│  └─────────────┘    └────────────────┘  │
├─────────────────────────────────────────┤
│   PID / UTS / IPC / Mount Namespaces    │
├─────────────────────────────────────────┤
│              Host System                │
└─────────────────────────────────────────┘
```

## Related Documentation

- [Agent Waves Orchestration](./agent-waves-orchestration.md)
- [Workflow Orchestration](./workflow-orchestration.md)
- [Security and Autonomy](./security-and-autonomy.md)
