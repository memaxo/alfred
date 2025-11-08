# Proxmox Library Research Prompt

## Context: ALFRED Project Tech Stack

ALFRED is a TypeScript monorepo built on the following stack:

**Runtime & Package Manager:**
- Bun 1.2.18 (primary runtime, not Node.js)
- ESM modules (`"type": "module"`)
- Workspace monorepo structure (Turborepo)

**Core Dependencies:**
- TypeScript 5.7.2 (strict mode)
- Zod 4.0.2 (schema validation)
- tRPC 11.6.0 (type-safe API layer)
- AI SDK v6 tool runtime
- Drizzle ORM 0.44.2 (database layer)
- Better Auth 1.3.13 (authentication)

**AI/ML Stack:**
- Vercel AI SDK 6.0-beta.94
- @ai-sdk/google, @ai-sdk/openai, @ai-sdk/cohere
- Laminar AI (@lmnr-ai/lmnr) for tracing

**Code Quality:**
- Biome 2.2.5 (formatter/linter)
- Ultracite 5.6.1 (strict linting rules)
- Zero tolerance for `any` types
- Performance-first mindset (nanosecond budgets)

## Use Case: Proxmox LXC/VM Management Tool

We need a TypeScript library to interact with Proxmox VE API for:

**Required Operations:**
- Create LXC containers from templates
- Start/stop/destroy LXC containers
- Create snapshots and rollback
- Query VM/LXC status and metadata
- Power operations (start/stop/reboot)

**Integration Requirements:**
1. **Bun Compatibility**: Must work with Bun runtime (not just Node.js)
2. **ESM Support**: Pure ESM imports (no CommonJS)
3. **TypeScript**: Full type definitions (no `@types/*` needed)
4. **Zod Integration**: Prefer libraries that use Zod or can be wrapped with Zod schemas
5. **Authentication**: Support Proxmox API tokens (user@realm!tokenid=secret)
6. **Error Handling**: Structured error types (not just strings)
7. **Performance**: Low overhead (operations should complete in <100ms for simple queries)
8. **Zero Dependencies**: Prefer minimal dependencies (or at least no heavy transitive deps)

**Code Style Constraints:**
- Single-word naming convention (files, functions, exports)
- No `any` types allowed
- Pure functions preferred (side effects isolated)
- Timeout handling required
- Input validation via Zod schemas

**Example Tool Pattern:**
```typescript
import { z } from "zod";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";

export const toolProxmoxLxc = {
  name: "proxmoxLxc",
  description: "Provision and manage LXC containers in Proxmox",
  inputSchema: z.object({
    action: z.enum(["create","start","stop","destroy","snapshot","rollback"]),
    node: z.string(),
    vmid: z.number().optional(),
    // ... more fields
    authz: z.string().optional(),
  }),
  outputSchema: z.any(), // Will be refined
  execute: async ({ input }) => {
    await requireToolScopesAndPolicy(input.authz, ["proxmox.admin"]);
    // Library call here
  },
};
```

## Research Questions

1. **What npm packages exist for Proxmox API interaction?**
   - List all available options with GitHub stars, maintenance status, last updated date
   - Identify which ones are actively maintained (updated in last 6 months)

2. **Bun Runtime Compatibility:**
   - Which libraries work with Bun? (test compatibility if possible)
   - Any known issues or workarounds needed?

3. **TypeScript Support:**
   - Which libraries ship with TypeScript definitions?
   - Quality of types (strict vs loose, any usage)

4. **API Coverage:**
   - Which libraries support LXC operations (not just VMs)?
   - Do they support snapshots, templates, cloning?

5. **Architecture Analysis:**
   - REST client vs wrapper library vs SDK?
   - Dependencies (axios, node-fetch, native fetch, etc.)
   - Bundle size impact

6. **Authentication Methods:**
   - Support for API tokens (user@realm!tokenid=secret)?
   - Password-based auth fallback?
   - Certificate-based auth?

7. **Error Handling:**
   - Structured error types?
   - HTTP status code mapping?
   - Retry logic built-in?

8. **Performance:**
   - Request/response overhead?
   - Connection pooling?
   - Streaming support for large operations?

9. **Alternative Approaches:**
   - Should we use native `fetch` with Proxmox REST API directly?
   - Any official Proxmox SDKs (Python, Go, etc.) we could wrap?
   - Is there a better approach than a third-party library?

## Decision Criteria (Priority Order)

1. **Bun compatibility** (critical - runtime requirement)
2. **TypeScript quality** (critical - no `any` types)
3. **ESM support** (critical - module system)
4. **LXC support** (critical - use case requirement)
5. **Maintenance status** (high - active development)
6. **Dependency count** (medium - prefer minimal)
7. **API completeness** (medium - need core operations)
8. **Error handling** (medium - structured errors)
9. **Performance** (low - can optimize later)

## Expected Deliverable

Provide:
1. **Top 3 recommendations** with pros/cons
2. **Code examples** showing how each would integrate with our tool pattern
3. **Migration complexity** assessment (if switching later)
4. **Risk assessment** (abandonment, breaking changes, etc.)
5. **Recommendation** with justification

If no suitable library exists, recommend:
- Using native `fetch` with Proxmox REST API
- Creating a minimal wrapper ourselves
- Alternative approaches (e.g., wrapping official Python SDK via subprocess)
