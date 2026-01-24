# Debugging Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-01-27

## Overview

ALFRED uses Bun's built-in debugger, which supports the WebKit Inspector Protocol. This guide covers debugging workflows for development, testing, and production issues.

## Quick Start

### VS Code Debugging

**Note:** VS Code debugging requires the [Bun VS Code Extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode). Without it, use the web-based debugger or Chrome DevTools (see below).

1. **Install Bun VS Code Extension**
   - Search for "Bun" in VS Code extensions marketplace
   - Install the official extension by Oven

2. **Use Launch Configurations**
   - Press `F5` or go to Run & Debug panel
   - Select a configuration:
     - **Debug Web App** - Debug the web application
     - **Debug API Server** - Debug API endpoints
     - **Debug Current Test File** - Debug the active test file
     - **Debug Script** - Debug the currently open script
     - **Attach to Bun** - Attach to an already-running Bun process (port 6499)

3. **Set Breakpoints**
   - Click in the gutter next to line numbers
   - Breakpoints work in TypeScript, JavaScript, and JSX files
   - Source maps are automatically handled by Bun

**Alternative: Chrome DevTools**
If VS Code debugging doesn't work, use Chrome DevTools:

1. Start app with `bun --inspect`
2. Open `chrome://inspect` in Chrome
3. Click "Open dedicated DevTools for Node"

### Command Line Debugging

**Start dev server with debugger:**

```bash
bun run dev:debug          # All workspaces
bun run dev:debug:web     # Web app only
bun run dev:debug:api     # API only
```

**Debug a test file:**

```bash
bun run debug:test packages/api/test/router.test.ts
```

**Debug a script:**

```bash
bun run debug:script scripts/migrate.ts
```

**Manual inspect flags:**

```bash
# Start with inspector (code runs immediately)
bun --inspect server.ts

# Start with breakpoint at first line
bun --inspect-brk server.ts

# Wait for debugger to attach before running
bun --inspect-wait server.ts

# Specify port
bun --inspect=4000 server.ts
```

## Web-Based Debugger

Bun provides a web-based debugger at [debug.bun.sh](https://debug.bun.sh/).

1. **Start your app with `--inspect`:**

   ```bash
   bun --inspect server.ts
   ```

2. **Copy the WebSocket URL** from the output:

   ```
   ------------------ Bun Inspector ------------------
   Listening at:
     ws://localhost:6499/0tqxs9exrgrm

   Inspect in browser:
     https://debug.bun.sh/#localhost:6499/0tqxs9exrgrm
   ------------------ Bun Inspector ------------------
   ```

3. **Open the URL** in your browser to access the debugger interface

## Network Request Debugging

Bun can automatically log network requests made with `fetch()` or `node:http`.

**Print requests as curl commands:**

```bash
BUN_CONFIG_VERBOSE_FETCH=curl bun run dev
```

**Print request/response details:**

```bash
BUN_CONFIG_VERBOSE_FETCH=true bun run dev
```

**Disable verbose fetch (default):**

```bash
BUN_CONFIG_VERBOSE_FETCH=false bun run dev
```

## Debugging Patterns

### Debugging Server-Side Code

1. **Set breakpoints** in route handlers, server functions, or API routers
2. **Start with `dev:debug:api`** or attach to running process
3. **Trigger the endpoint** via HTTP request or UI interaction
4. **Inspect variables** in the debugger's scope panel

### Debugging Tests

1. **Open the test file** in VS Code
2. **Set breakpoints** in test code or code under test
3. **Select "Debug Current Test File"** from launch configurations
4. **Step through** test execution

### Debugging Scripts

1. **Open the script** file
2. **Set breakpoints** where needed
3. **Select "Debug Script"** from launch configurations
4. **Or use command line:** `bun run debug:script scripts/your-script.ts`

### Attaching to Running Process

1. **Start your app** with `--inspect`:

   ```bash
   bun --inspect run dev
   ```

2. **Note the port** from the output (default: 6499)

3. **Attach debugger:**
   - VS Code: Select "Attach to Bun" configuration
   - Or use Chrome DevTools: `chrome://inspect`

## Source Maps

Bun automatically generates and serves source maps for TypeScript, JSX, and other transpiled files. Stack traces point to original source code, not transpiled output.

**View source code in stack traces:**

- Click file paths in console output
- Bun opens the original source file

**Syntax-highlighted error preview:**
Bun automatically prints source code previews for unhandled exceptions:

```typescript
const err = new Error("Something went wrong");
console.log(Bun.inspect(err, { colors: true }));
```

## Common Issues

### Debugger Not Connecting

- **Check port availability:** Ensure the inspector port (default 6499) isn't in use
- **Specify custom port:** `bun --inspect=4000 server.ts`
- **Verify Bun version:** Requires Bun 1.0+ for inspector support

### Breakpoints Not Hitting

- **Verify source maps:** Ensure TypeScript/JSX files are being transpiled correctly
- **Check file paths:** Breakpoints must match the actual file being executed
- **Restart debugger:** Sometimes a fresh start resolves mapping issues

### VS Code Not Attaching

- **Install Bun extension:** Provides better VS Code integration
- **Check launch.json:** Verify configuration matches your setup
- **Use attach configuration:** If launch fails, try "Attach to Bun" instead

## Performance Considerations

- **Debug builds are slower:** Debugging adds overhead; use for development only
- **Source maps add size:** Production builds should minimize source map size
- **Breakpoints pause execution:** Be careful when debugging production-like workloads

## Related Documentation

- [Bun Debugger Docs](https://bun.com/docs/runtime/debugger)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
- [WebKit Inspector Protocol](https://github.com/oven-sh/bun/blob/main/packages/bun-inspector-protocol/src/protocol/jsc/index.d.ts)
