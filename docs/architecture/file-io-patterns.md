# File I/O Patterns

**Owner:** runtime  
**Last Updated:** 2025-01-27

## Overview

ALFRED uses Bun's native file I/O APIs (`Bun.file`, `Bun.write`) for all file operations, with Node.js `fs` reserved only for directory and metadata operations where Bun lacks native alternatives.

## Core Principle

Bun's file APIs are optimized with platform-specific system calls (Linux: `copy_file_range`, `sendfile`; macOS: `clonefile`, `fcopyfile`) and provide `Blob`-compatible interfaces. They outperform Node.js compatibility layers by 2-3x for file operations.

## When to Use Bun vs Node.js fs

### Use Bun APIs For

- **Reading files:** `await Bun.file(path).text()`
- **Writing files:** `await Bun.write(path, content)`
- **Checking existence:** `await Bun.file(path).exists()`
- **Reading JSON:** `await Bun.file(path).json()`
- **Binary data:** `await Bun.file(path).arrayBuffer()` or `.bytes()`
- **Streaming:** `Bun.file(path).stream()`

### Use Node.js fs For

- **Directory operations:** `mkdir`, `readdir`, `rmdir` (Bun recommends `node:fs` per docs)
- **File metadata:** `statSync`, `lstatSync`, `realpathSync` (no Bun native APIs)
- **Security validation:** Low-level synchronous operations requiring `realpathSync.native()`

## Migration Patterns

### Pattern 1: Synchronous File Read

```typescript
// ❌ Before (Node.js)
import { readFileSync } from "node:fs";
const content = readFileSync(filePath, "utf-8");

// ✅ After (Bun)
const content = await Bun.file(filePath).text();
```

**Note:** Function must be `async` when using Bun APIs.

### Pattern 2: Synchronous File Write

```typescript
// ❌ Before (Node.js)
import { writeFileSync } from "node:fs";
writeFileSync(filePath, content, "utf-8");

// ✅ After (Bun)
await Bun.write(filePath, content);
```

### Pattern 3: File Existence Check

```typescript
// ❌ Before (Node.js)
import { existsSync } from "node:fs";
if (existsSync(filePath)) {
  // ...
}

// ✅ After (Bun)
const file = Bun.file(filePath);
if (await file.exists()) {
  // ...
}
```

### Pattern 4: JSON File Read

```typescript
// ❌ Before (Node.js)
import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile(filePath, "utf-8"));

// ✅ After (Bun)
const data = await Bun.file(filePath).json();
```

### Pattern 5: Async File Read (Promises API)

```typescript
// ❌ Before (Node.js)
import { readFile } from "node:fs/promises";
const content = await readFile(filePath, "utf8");

// ✅ After (Bun)
const content = await Bun.file(filePath).text();
```

### Pattern 6: Conditional File Read

```typescript
// ❌ Before (Node.js)
import { existsSync, readFileSync } from "node:fs";
let content = "";
if (existsSync(filePath)) {
  content = readFileSync(filePath, "utf-8");
}

// ✅ After (Bun)
const file = Bun.file(filePath);
let content = "";
if (await file.exists()) {
  content = await file.text();
}
```

### Pattern 7: Error Handling

```typescript
// ❌ Before (Node.js)
import { readFile } from "node:fs/promises";
try {
  const content = await readFile(filePath, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    // handle not found
  }
}

// ✅ After (Bun)
const file = Bun.file(filePath);
if (await file.exists()) {
  const content = await file.text();
} else {
  // handle not found
}
```

## Directory Operations

Bun documentation explicitly states: "Bun's implementation of `node:fs` is fast, and we haven't implemented a Bun-specific API for reading directories just yet. For now, you should use `node:fs` for working with directories in Bun."

```typescript
// ✅ Correct: Use Node.js fs for directories
import { mkdir } from "node:fs/promises";
await mkdir(path.dirname(filePath), { recursive: true });
await Bun.write(filePath, content); // Then use Bun for file write
```

## Security Considerations

Security validation requires low-level synchronous operations that Bun doesn't provide natively:

```typescript
// ✅ Correct: Use Node.js fs for security validation
import { realpathSync, statSync, lstatSync } from "node:fs";

// Resolve symlinks securely
const realPath = realpathSync.native(resolvedPath);

// Validate file type
const stats = statSync(filePath);
if (!stats.isFile()) {
  throw new Error("Not a file");
}

// Detect symlink attacks
if (lstatSync(resolvedPath).isSymbolicLink()) {
  throw new Error("Refusing to write through symlink");
}
```

## Performance Benefits

### System Call Optimizations

Bun uses platform-specific optimizations:

- **Linux:** `copy_file_range`, `sendfile`, `splice`
- **macOS:** `clonefile`, `fcopyfile`

### Lazy Loading

`Bun.file()` creates a lazy file reference without immediate disk I/O:

```typescript
const file = Bun.file("large.txt"); // No I/O yet
const size = file.size; // Synchronous property access
const content = await file.text(); // I/O happens here
```

### Blob Compatibility

`BunFile` extends `Blob`, enabling seamless Web API integration:

```typescript
const file = Bun.file("data.json");
const response = new Response(file, {
  headers: { "Content-Type": file.type },
});
```

## Common Mistakes

### Mistake 1: Forgetting `await`

```typescript
// ❌ Wrong: Bun APIs are async
const content = Bun.file(path).text(); // Returns Promise<string>

// ✅ Correct
const content = await Bun.file(path).text();
```

### Mistake 2: Using Node.js fs for simple file ops

```typescript
// ❌ Wrong: Unnecessary Node.js dependency
import { readFile } from "node:fs/promises";
const content = await readFile(path, "utf8");

// ✅ Correct: Use Bun
const content = await Bun.file(path).text();
```

### Mistake 3: Mixing sync and async patterns

```typescript
// ❌ Wrong: Inconsistent
if (existsSync(path)) {
  const content = await Bun.file(path).text();
}

// ✅ Correct: All async
const file = Bun.file(path);
if (await file.exists()) {
  const content = await file.text();
}
```

## Examples from ALFRED

### API Router (`packages/api/src/routers/fs.ts`)

```typescript
.query(async ({ input }) => {
  const resolvedPath = resolveWithinProjectRoot(input.path);
  const file = Bun.file(resolvedPath);

  if (!(await file.exists())) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const content = await Bun.file(filePath).text();
  return { content };
})
```

### Runtime ExecPlan (`packages/runtime/src/orchestrator/execplan.ts`)

```typescript
export async function mutateExecPlanFile(
  filePath: string,
  mutate: (markdown: string) => string
): Promise<void> {
  let current = "";
  const file = Bun.file(filePath);
  if (await file.exists()) {
    current = await file.text();
  }

  const updated = mutate(current);
  if (updated !== current) {
    await Bun.write(filePath, updated);
  }
}
```

### Agent Tool (`packages/agent/src/orchestrator/tool/reflect.ts`)

```typescript
async function appendRule(filePath: string, rules: string[]) {
  let content = "";
  const file = Bun.file(filePath);
  if (await file.exists()) {
    content = await file.text();
  } else {
    content = "# Learned Rules\n\n";
  }
  
  // ... mutate content ...
  
  await Bun.write(filePath, content);
}
```

## References

- [Bun File I/O Documentation](https://bun.com/docs/runtime/file-io)
- [Bun Runtime Standards](../.ruler/22-bun-runtime.md)
- [ALFRED File I/O Audit](../audit-bun-file-io.md)
