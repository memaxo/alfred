# Package Manifests

## Overview

Package manifests enable ALFRED packages to integrate with the CLI and TUI infrastructure automatically. Each package can declare commands, panels, health checks, and dependencies through a standardized `CliManifest` interface.

## Purpose

- **CLI Commands**: Expose package-specific commands via `alfred <package>:<command>` syntax
- **TUI Panels**: Register panels for the dashboard view
- **Health Checks**: Report package health status for observability
- **Dependency Management**: Declare package dependencies for proper load ordering

## Creating a Manifest

### 1. Create `src/manifest.ts`

Add a `manifest.ts` file to your package's `src/` directory:

```typescript
import type { CliManifest } from "@alfred/tui/registry/manifest";
import { z } from "zod";

export const manifest: CliManifest = {
  name: "@alfred/your-package",
  version: "0.1.0",
  description: "Brief description of your package",
  commands: [],           // Optional
  panels: [],             // Optional
  shortcuts: [],          // Optional
  subscriptions: [],      // Optional
  healthCheck: async () => { /* ... */ }, // Optional
  dependencies: [],       // Optional
};
```

### 2. Define Commands

Commands follow a simple structure with Zod schemas for validation:

```typescript
import { z } from "zod";

const myCommand = {
  name: "command-name",
  description: "Brief description of what this command does",
  args: z.object({
    required: z.string().min(1).describe("A required string argument"),
    optional: z.number().int().positive().optional().default(10).describe("Optional number"),
    flag: z.boolean().optional().default(false).describe("Boolean flag"),
  }),
  handler: async (args: { required: string; optional: number; flag: boolean }) => {
    console.log(`Running command with args:`, args);
    // Command implementation
  },
};

export const manifest: CliManifest = {
  // ...
  commands: [myCommand],
};
```

**Usage**: `alfred your-package:command-name --required "value" --optional 20 --flag`

### 3. Register TUI Panels

Panels are loaded lazily via factory functions:

```typescript
export const manifest: CliManifest = {
  // ...
  panels: [
    {
      id: "my-panel",
      name: "My Panel",
      component: async () => {
        const { createMyPanel } = await import("@alfred/tui/panels/my-panel");
        return createMyPanel();
      },
      shortcuts: ["m"], // Optional keyboard shortcuts
    },
  ],
};
```

### 4. Add Health Check

Health checks report package status to the dashboard:

```typescript
export const manifest: CliManifest = {
  // ...
  healthCheck: async () => {
    try {
      const start = performance.now();
      
      // Check your package's health
      const isHealthy = await checkSomething();
      const latency = performance.now() - start;

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        message: isHealthy ? "All systems operational" : "Service degraded",
        latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: (error as Error).message,
      };
    }
  },
};
```

**Status Values**:
- `"healthy"` - Package is fully operational
- `"degraded"` - Partial functionality available
- `"unhealthy"` - Package is not functional

### 5. Declare Dependencies

List other packages this package depends on:

```typescript
export const manifest: CliManifest = {
  // ...
  dependencies: ["@alfred/db", "@alfred/metrics"],
};
```

The registry will load packages in dependency order.

## Complete Example

Here's a complete manifest for a hypothetical analytics package:

```typescript
import { z } from "zod";
import type { CliManifest } from "@alfred/tui/registry/manifest";

// Command definitions
const reportCommand = {
  name: "report",
  description: "Generate an analytics report",
  args: z.object({
    period: z.enum(["day", "week", "month"]).optional().default("day"),
    format: z.enum(["json", "csv"]).optional().default("json"),
  }),
  handler: async (args: { period: string; format: string }) => {
    console.log(`Generating ${args.period} report in ${args.format} format...`);
    // Implementation
  },
};

const clearCommand = {
  name: "clear",
  description: "Clear analytics data",
  args: z.object({
    confirm: z.boolean().optional().default(false).describe("Confirmation flag"),
  }),
  handler: async (args: { confirm: boolean }) => {
    if (!args.confirm) {
      throw new Error("Clear requires --confirm flag");
    }
    console.log("Clearing analytics data...");
    // Implementation
  },
};

export const manifest: CliManifest = {
  name: "@alfred/analytics",
  version: "0.1.0",
  description: "Analytics and reporting for ALFRED",
  
  commands: [reportCommand, clearCommand],
  
  panels: [
    {
      id: "analytics-panel",
      name: "Analytics",
      component: async () => {
        const { createAnalyticsPanel } = await import("@alfred/tui/panels/analytics");
        return createAnalyticsPanel();
      },
      shortcuts: ["a"],
    },
  ],
  
  healthCheck: async () => {
    try {
      const start = performance.now();
      // Check database connection
      const dbOk = await checkDatabase();
      const latency = performance.now() - start;

      return {
        status: dbOk ? "healthy" : "unhealthy",
        message: dbOk ? "Analytics service operational" : "Database connection failed",
        latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: (error as Error).message,
      };
    }
  },
  
  dependencies: ["@alfred/db"],
};
```

## Testing Your Manifest

### 1. Local Testing

Create a test file to validate your manifest:

```typescript
import { describe, expect, test } from "bun:test";
import { manifest } from "../src/manifest";
import { CliManifestSchema } from "@alfred/tui/registry/manifest";

describe("Package Manifest", () => {
  test("manifest is valid", () => {
    const result = CliManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  test("commands have handlers", () => {
    for (const cmd of manifest.commands ?? []) {
      expect(cmd.handler).toBeDefined();
      expect(typeof cmd.handler).toBe("function");
    }
  });

  test("health check works", async () => {
    if (manifest.healthCheck) {
      const status = await manifest.healthCheck();
      expect(status.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    }
  });
});
```

### 2. CLI Testing

Test commands locally:

```bash
# List available commands
alfred --help

# Run your command
alfred your-package:command-name --help
alfred your-package:command-name --required "test"
```

### 3. TUI Testing

Launch the dashboard to see your panel:

```bash
alfred tui
```

Use your panel's keyboard shortcut or navigate with Tab/Shift+Tab.

## Best Practices

### Commands

1. **Use descriptive names**: `migrate`, `seed`, `benchmark` (not `do-thing`)
2. **Add descriptions to all args**: Use `.describe()` for every schema field
3. **Validate inputs**: Use Zod constraints (`.min()`, `.max()`, `.int()`, etc.)
4. **Handle errors gracefully**: Catch errors and provide helpful messages
5. **Use `--confirm` for destructive operations**: Require explicit confirmation flags

### Panels

1. **Lazy load components**: Use async factory functions to avoid import overhead
2. **Keep panels focused**: One concern per panel (don't create mega-panels)
3. **Choose memorable shortcuts**: Single letters that relate to the panel name
4. **Handle null/undefined state**: Show empty state messages gracefully

### Health Checks

1. **Be fast**: Health checks should complete in <100ms
2. **Return latency**: Always include timing information
3. **Be specific**: Provide actionable error messages
4. **Don't throw**: Return `unhealthy` status instead of throwing errors

### Dependencies

1. **Declare only direct dependencies**: Don't include transitive deps
2. **Use full package names**: `@alfred/db`, not `db`
3. **Keep it minimal**: Only declare runtime dependencies

## Registry Behavior

### Auto-Discovery

The package registry automatically discovers manifests at startup:

1. Scans `packages/*/src/manifest.ts`
2. Validates each manifest against the schema
3. Sorts packages by dependency order
4. Registers commands, panels, and health checks

### Command Resolution

Commands can be invoked in two ways:

1. **With package prefix**: `alfred db:migrate` (explicit)
2. **Without prefix**: `alfred migrate` (searches all packages)

The prefix syntax is recommended to avoid collisions.

### Panel Loading

Panels are loaded asynchronously when the dashboard starts:

1. Registry discovers all panel definitions
2. Dashboard calls each panel's `component()` factory
3. Panel instances are registered in the TUI panel registry
4. Failures are logged but don't block other panels

## Troubleshooting

### "Command not found"

- Verify manifest is at `packages/your-package/src/manifest.ts`
- Check that `commands` array includes your command
- Ensure command `name` matches what you're typing

### "Invalid manifest"

- Run `CliManifestSchema.safeParse(manifest)` to see validation errors
- Check that all required fields are present (`name`, `version`, `description`)
- Verify Zod schemas are valid

### Panel not appearing

- Check browser console for loading errors
- Verify `component` is an async function returning a BasePanel
- Ensure panel factory function is exported from its module

### Health check fails

- Test health check independently: `await manifest.healthCheck()`
- Add error handling to catch and report failures
- Keep checks simple and fast (<100ms)

## Reference

### CliManifest Interface

```typescript
interface CliManifest {
  name: string;                    // Package name (e.g., "@alfred/db")
  version: string;                 // Semantic version
  description: string;             // Brief package description
  router?: AnyRouter;              // Optional tRPC router
  commands?: CommandDef[];         // CLI commands
  panels?: TuiPanelDef[];          // TUI panels
  shortcuts?: ShortcutDef[];       // Global keyboard shortcuts
  subscriptions?: SubscriptionDef[]; // tRPC subscriptions
  healthCheck?: () => Promise<HealthStatus>; // Health check function
  dependencies?: string[];         // Package dependencies
}
```

### CommandDef

```typescript
interface CommandDef {
  name: string;                    // Command name (no spaces)
  description: string;             // Brief description
  args?: ZodSchema;                // Zod schema for arguments
  handler: (args: any) => Promise<void>; // Async handler function
}
```

### TuiPanelDef

```typescript
interface TuiPanelDef {
  id: string;                      // Unique panel identifier
  name: string;                    // Display name
  component: () => Promise<BasePanel>; // Lazy factory function
  shortcuts?: string[];            // Keyboard shortcuts
}
```

### HealthStatus

```typescript
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;                // Optional status message
  latency?: number;                // Check latency in milliseconds
}
```

## See Also

- [TUI Architecture](../architecture/tui-architecture.md)
- [Registry Implementation](../../packages/tui/src/registry/)
- [Example Manifests](../../packages/voice/src/manifest.ts)
