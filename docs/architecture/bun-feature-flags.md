# Bun Compile-Time Feature Flags

## Purpose

Use Bun's compile-time feature flags to conditionally include/exclude code paths at build time. This enables:
- Deprecating code while keeping it testable
- Reducing production bundle size via dead code elimination
- Platform-specific code paths (e.g., Linux-only features)

## Type Declaration

Create a declaration file in the package that uses feature flags:

```typescript
// packages/<pkg>/src/env.d.ts
declare module "bun:bundle" {
  interface Registry {
    features: "FEATURE_A" | "FEATURE_B" | "DEBUG";
  }
  export function feature(name: Registry["features"]): boolean;
}
```

## Usage Pattern

### Basic Guard

```typescript
import { feature } from "bun:bundle";

if (feature("LEGACY_FEATURE")) {
  // This code is tree-shaken in production builds
  const { LegacyModule } = await import("./legacy.js");
  return new LegacyModule();
}

// Default path (always included)
return new ModernModule();
```

### Dynamic Import with Sync Functions

When you need to use feature-flagged modules inside synchronous functions, capture the import at initialization:

```typescript
import { feature } from "bun:bundle";

// Capture at initialization (async context)
let legacyHelper: typeof import("./legacy.js").helper | undefined;

if (feature("LEGACY_FEATURE")) {
  const module = await import("./legacy.js");
  legacyHelper = module.helper;
}

// Use in sync function
function process() {
  if (feature("LEGACY_FEATURE") && legacyHelper) {
    return legacyHelper(); // No await needed
  }
  return modernHelper();
}
```

## Build Commands

```bash
# Production (features disabled - dead code eliminated)
bun build ./src/index.ts --outdir ./dist

# Development (features enabled - legacy code included)
bun build --feature=FEATURE_A --feature=FEATURE_B ./src/index.ts --outdir ./dist
```

## Package.json Scripts

```json
{
  "scripts": {
    "build:bundle": "bun build ./src/index.ts --outdir ./dist/bundle --target=bun",
    "build:bundle:dev": "bun build --feature=LEGACY_A --feature=LEGACY_B ./src/index.ts --outdir ./dist/bundle-dev --target=bun"
  }
}
```

## How It Works

1. `feature("FLAG")` calls are replaced with `true` or `false` at build time
2. When `false`, the guarded code becomes dead code
3. Bun's bundler eliminates dead code during tree-shaking
4. Dynamic imports are still resolved but their code paths may be eliminated

## Naming Convention

- `LEGACY_*` - Deprecated features kept for backward compatibility
- `DEBUG` - Debug-only code (logging, assertions)
- Platform-specific flags should use explicit names (e.g., `LINUX_FUSE`, `MACOS_KEYCHAIN`)

## When to Use

1. **Deprecating features** - Keep code available for testing/development
2. **Platform-specific code** - Linux-only, macOS-only features
3. **Debug code** - Verbose logging, assertions
4. **Experimental features** - New code not ready for production

## When NOT to Use

1. **Runtime configuration** - Use environment variables instead
2. **User preferences** - Use database/config instead
3. **A/B testing** - Feature flags are compile-time, not runtime
