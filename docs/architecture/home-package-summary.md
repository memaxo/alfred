# Home Package Taxonomy Summary

**Owner:** architecture, agent  
**Status:** Taxonomy defined, implementation pending  
**Related:** [`docs/definitions/home.md`](../definitions/home.md)

## Quick Reference

### Scope

**In Scope:**

- Provider abstraction (Home Assistant, Matter, Zigbee)
- Entity discovery and state queries
- Control operations (lights, climate, switches)
- Policy integration (`home.read`, `home.control` scopes)
- Knowledge graph integration (preference learning)

**Out of Scope:**

- Device discovery (provider handles)
- Automation rules (provider-level)
- Scene management (future extension)
- Security systems (separate domain)
- Media control (separate domain)

### Package Structure

Following canonical `type → domain → DB → API → apps` pattern:

```
packages/type/src/home.ts          # Types and Zod schemas
packages/home/src/                 # Domain package (NEW)
  ├── index.ts                    # Provider abstraction
  └── providers/
      ├── homeassistant.ts        # Home Assistant client
      ├── matter.ts               # Matter provider (future)
      └── zigbee.ts               # Zigbee provider (future)
packages/db/src/schema/home.ts    # Entity and preference tables (NEW)
packages/db/src/repo/home.ts      # Repository functions (NEW)
packages/api/src/routers/home.ts  # tRPC router (EXISTS, refactor)
packages/agent/assistant/src/tool/home.ts  # Agent tool (EXISTS, refactor)
packages/ui/src/pane/home.tsx     # UI component (EXISTS)
```

### Current State vs Target State

**Current (Scattered):**

- Tool: `packages/agent/assistant/src/tool/home.ts`
- Router: `packages/api/src/routers/home.ts`
- Client: `packages/agent/src/lib/homeassistant.ts`
- UI: `packages/ui/src/pane/home.tsx`

**Target (Domain Package):**

- Domain: `packages/home/` (NEW)
- Types: `packages/type/src/home.ts` (NEW)
- Schema: `packages/db/src/schema/home.ts` (NEW)
- Repo: `packages/db/src/repo/home.ts` (NEW)
- Router: Refactor to use domain package
- Tool: Refactor to delegate to domain package

### Key Concepts

**Entity:** A smart device (light, switch, climate, sensor) with:

- Provider-specific ID (`light.living_room`)
- Domain type (`light`, `switch`, `climate`)
- Current state (on/off, temperature, brightness)
- Attributes (provider-specific metadata)

**Provider:** Home automation system integration:

- `homeassistant` - Home Assistant REST API
- `matter` - Matter protocol (future)
- `zigbee` - Zigbee coordinator (future)

**Control Operation:** Request to change entity state:

- Requires `home.control` scope
- Autonomy level: 0.6 (medium, requires confirmation if autonomy < 0.6)
- Policy checks before execution

### Integration Points

**Knowledge Graph:**

- Learn user preferences from control operations
- Example: "User dims lights to 50% at 9pm" → suggest automation

**Cognitive System:**

- Autonomy constraints: read (0.2) vs control (0.6)
- Escalation when autonomy insufficient

**Policy System:**

- Scopes: `home.read`, `home.control`
- Resource: `{ kind: "home", id: entityId }`

### Performance Budgets

- Entity listing: < 100ms
- State query: < 50ms
- Control operation: < 200ms
- Provider ping: < 100ms

### Migration Checklist

- [ ] Create `packages/home/` domain package
- [ ] Move `homeassistant.ts` → `packages/home/src/providers/`
- [ ] Extract provider abstraction interface
- [ ] Add types to `packages/type/src/home.ts`
- [ ] Add schema to `packages/db/src/schema/home.ts`
- [ ] Add repo to `packages/db/src/repo/home.ts`
- [ ] Refactor router to use domain package
- [ ] Refactor tool to delegate to domain package
- [ ] Update UI to use new types
- [ ] Add boundary tests (no DB/API imports in domain package)
- [ ] Add integration tests

### Related Documents

- [`docs/definitions/home.md`](../definitions/home.md) - Full taxonomy definition
- [`docs/definitions/ontology.md`](../definitions/ontology.md) - Domain ontology
- [`docs/architecture/sense-mvp-wiring.md`](./sense-mvp-wiring.md) - Wiring pattern reference
