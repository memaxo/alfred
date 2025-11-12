# Bun + UV Integration Investigation

## Executive Summary

This document investigates proper integration between Bun (JavaScript runtime) and UV (Python package manager) for managing Python subprocesses in the ALFRED voice system.

## Current State

### Implementation (`packages/voice/src/process/base.ts`)

- Uses `Bun.spawn()` with `python3` (or `PYTHON_PATH` env var)
- Inherits full `process.env`
- No virtual environment awareness
- Assumes Python dependencies are globally installed
- No dependency verification

### Issues Identified

1. **No Virtual Environment Isolation**: 
   - Python dependencies installed globally via `uv pip install`
   - Risk of version conflicts with system Python packages
   - No reproducible environment across machines

2. **No UV Project Integration**:
   - `pyproject.toml` exists but not used for runtime
   - No automatic dependency resolution
   - Manual installation required

3. **PATH Not Configured**:
   - Assumes `python3` is in PATH
   - No virtual environment activation
   - No UV-managed Python executable detection

4. **No Dependency Verification**:
   - No check if dependencies are installed before starting
   - Silent failures if packages missing
   - No version verification

## UV Virtual Environment Options

### Option 1: UV Project with Virtual Environment

UV creates `.venv/` automatically when using project commands:

```bash
cd packages/voice
uv sync  # Creates .venv and installs dependencies
```

**Structure:**
- Python executable: `.venv/bin/python` (Unix) or `.venv/Scripts/python.exe` (Windows)
- Installed packages: `.venv/lib/python3.x/site-packages/`
- Activation script: `.venv/bin/activate`

**Pros:**
- Automatic dependency resolution from `pyproject.toml`
- Isolated environment per project
- Reproducible builds with lock files
- Platform-aware paths

**Cons:**
- Requires resolving `.venv` path
- Need to handle platform differences (Unix vs Windows)

### Option 2: UV Run (No Activation Needed)

UV provides `uv run` which automatically uses the project's virtual environment:

```bash
uv run python scripts/stt_server.py
```

**Behavior:**
- Creates `.venv` if it doesn't exist
- Installs dependencies from `pyproject.toml` if needed
- Runs Python with virtual environment activated
- No manual activation needed

**Pros:**
- Simplest approach - no path resolution
- Automatic environment management
- No PATH manipulation needed
- Works cross-platform
- Handles dependency installation automatically

**Cons:**
- Requires `uv` to be in PATH
- Slightly slower (~50-100ms overhead per invocation)
- Less control over Python executable

### Option 3: Direct Virtual Environment Python Path

Use the virtual environment's Python directly:

```typescript
const pythonPath = process.platform === "win32" 
  ? ".venv/Scripts/python.exe"
  : ".venv/bin/python";
```

**Pros:**
- Fastest execution (~1-5ms overhead)
- Direct Python execution
- Full control over Python version

**Cons:**
- Need to ensure `.venv` exists
- Manual path resolution required
- Platform-specific paths
- No automatic dependency installation

## Recommended Approach: Hybrid Solution

### Strategy: Multi-Tier Fallback

1. **Tier 1**: UV Run (if `uv` available and `.venv` exists or can be created)
2. **Tier 2**: Direct virtual environment Python (if `.venv` exists)
3. **Tier 3**: System Python (fallback)

### Implementation Plan

#### Phase 1: UV Run Integration (Immediate)

Use `uv run` for simplicity and automatic environment management:

```typescript
private async resolvePythonExecutable(): Promise<{
  cmd: string[];
  cwd: string;
}> {
  const voiceDir = join(process.cwd(), "packages/voice");
  const scriptPath = this.config.scriptPath;
  
  // Check if UV is available and should be used
  const useUv = process.env.VOICE_USE_UV !== "false";
  const uvPath = await this.findUvPath();
  
  if (useUv && uvPath) {
    // Use uv run - automatically manages virtual environment
    return {
      cmd: [uvPath, "run", "python", scriptPath],
      cwd: voiceDir,
    };
  }
  
  // Check for virtual environment
  const venvPython = this.findVenvPython(voiceDir);
  if (venvPython) {
    return {
      cmd: [venvPython, scriptPath],
      cwd: voiceDir,
    };
  }
  
  // Fallback to system Python
  const pythonPath = process.env.PYTHON_PATH ?? "python3";
  return {
    cmd: [pythonPath, scriptPath],
    cwd: process.cwd(),
  };
}
```

#### Phase 2: Dependency Verification

Verify dependencies before starting processes:

```typescript
private async verifyDependencies(pythonCmd: string[]): Promise<void> {
  try {
    const proc = Bun.spawn([...pythonCmd, "-c", `
import sys
try:
    import faster_whisper
    import piper
    import silero_vad
    import numpy
    sys.exit(0)
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    sys.exit(1)
    `], {
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Dependencies not installed: ${stderr}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to verify Python dependencies.\n` +
      `Install with: cd packages/voice && ./scripts/install-deps.sh\n` +
      `Or use: cd packages/voice && uv sync\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

#### Phase 3: Installation Script Updates

Update installation script to use `uv sync`:

```bash
#!/usr/bin/env bash
# Use UV sync to create virtual environment and install dependencies
cd packages/voice
uv sync --extra cpu  # or rocm, cu128, etc.
```

## Environment Variables

### New Variables

- `VOICE_USE_UV`: Enable/disable UV usage (default: auto-detect)
- `VOICE_PYTHON_VENV`: Override virtual environment path (auto-detected)
- `PYTHON_PATH`: Override Python executable (fallback only)

### Behavior

1. If `VOICE_USE_UV=false`: Skip UV, use virtual environment or system Python
2. If `VOICE_USE_UV` unset: Auto-detect UV, use if available
3. If UV unavailable: Fallback to virtual environment, then system Python

## Performance Considerations

### Benchmarks (Estimated)

- **UV Run**: ~50-100ms overhead (checks environment, ensures dependencies)
- **Direct Venv Python**: ~1-5ms overhead (direct execution)
- **System Python**: ~1ms overhead (direct execution)

### Recommendation

- **Development**: Use UV Run for automatic dependency management
- **Production**: Use direct venv Python for performance (after ensuring venv exists)

## Security Considerations

1. **PATH Injection**: Always validate paths, use absolute paths when possible
2. **Virtual Environment Isolation**: Prevents dependency conflicts
3. **Dependency Verification**: Prevents runtime errors and security issues
4. **Environment Variable Filtering**: Only pass necessary env vars to subprocesses

## Testing Strategy

1. **Test UV Run Path**: Verify `uv run python` works
2. **Test Virtual Environment Path**: Verify `.venv/bin/python` works
3. **Test Fallback**: Verify system `python3` works when UV unavailable
4. **Test Dependency Verification**: Verify error when dependencies missing
5. **Test Cross-Platform**: Verify Windows and Unix paths work
6. **Test Environment Variables**: Verify `VOICE_USE_UV` flag works

## Migration Path

### Phase 1 (Non-Breaking)
- Add UV support alongside existing Python path
- Auto-detect UV availability
- Keep existing behavior as fallback

### Phase 2 (Optional)
- Make UV default when available
- Keep fallback for systems without UV
- Update documentation

### Phase 3 (Future)
- Require UV for local voice models
- Remove system Python fallback
- Enforce virtual environment usage

## References

- [UV Documentation](https://docs.astral.sh/uv/)
- [UV PyTorch Integration](https://docs.astral.sh/uv/guides/integration/pytorch/)
- [Bun Spawn API](https://bun.sh/docs/api/spawn)
- [Python Virtual Environments](https://docs.python.org/3/library/venv.html)

