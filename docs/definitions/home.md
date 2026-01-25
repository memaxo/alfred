# Home Domain Taxonomy

Owner: architecture, agent

The home domain encapsulates home automation capabilities—controlling and monitoring physical devices in the user's living space through standardized provider integrations.

## Purpose

The home domain enables ALFRED to interact with smart home devices (lights, climate, switches, sensors) through provider abstractions (Home Assistant, Matter, Zigbee). It provides entity discovery, state queries, control operations, and preference learning while maintaining security boundaries and autonomy constraints.

## Scope

### In Scope

**Core Responsibilities:**

1. **Provider Abstraction** - Unified interface for multiple home automation providers (Home Assistant, Matter, Zigbee, etc.)
2. **Entity Management** - Discovery, enumeration, and metadata for home devices (lights, switches, climate, sensors)
3. **State Queries** - Read current state of entities (on/off, temperature, brightness, etc.)
4. **Control Operations** - Execute service calls to change entity state (turn_on, set_temperature, etc.)
5. **Provider Configuration** - Environment-based provider selection and credential management
6. **Error Handling** - Provider-specific error translation to domain errors
7. **Policy Integration** - Autonomy-aware control decisions (read-only vs. control operations)

**Integration Points:**

- **Knowledge Graph** - Learn user preferences (e.g., "lights dim at 9pm", "thermostat at 72°F")
- **Cognitive System** - Autonomy constraints for control operations (0.6 autonomy for control, 0.2 for read)
- **Policy System** - Security checks (`home.read`, `home.control` scopes)
- **Agent Tools** - Expose `home` tool to assistant for natural language control

### Out of Scope

**Not Included:**

1. **Device Discovery** - Provider handles device discovery; home package consumes discovered entities
2. **Automation Rules** - Provider-level automations (Home Assistant automations) remain in provider
3. **Scene Management** - Multi-entity scenes belong to provider or higher-level orchestration
4. **Media Control** - Audio/video devices belong to separate domain (e.g., `media`)
5. **Security Systems** - Alarm systems, locks, cameras belong to separate `security` domain
6. **Energy Management** - Power monitoring and optimization belong to separate `energy` domain

## Domain Entities

### Entity

A physical or logical device in the home automation system.

**Properties:**

- `id` - Provider-specific entity identifier (e.g., `light.living_room`)
- `name` - Human-readable friendly name
- `domain` - Entity type category (`light`, `switch`, `climate`, `sensor`, `binary_sensor`, etc.)
- `state` - Current state value (string, number, or boolean)
- `attributes` - Provider-specific metadata (brightness, color, temperature, etc.)
- `provider` - Provider identifier (`homeassistant`, `matter`, `zigbee`)

**Lifecycle:**

- Entities are discovered from provider, not created by ALFRED
- State is read-only from ALFRED's perspective (provider is source of truth)
- Control operations update state via provider API

### Provider

A home automation system integration (Home Assistant, Matter, Zigbee).

**Properties:**

- `id` - Provider identifier (`homeassistant`, `matter`, `zigbee`)
- `baseUrl` - API endpoint URL
- `configured` - Whether provider is properly configured (credentials, URL)
- `capabilities` - Supported operations (`read`, `control`, `discover`)

**Configuration:**

- Provider selection via `HOME_PROVIDER` environment variable
- Credentials via provider-specific env vars (`HOME_BASE_URL`, `HOME_TOKEN`)
- Provider abstraction allows switching without code changes

### Control Operation

A request to change entity state via provider service call.

**Properties:**

- `entityId` - Target entity identifier
- `service` - Service name (`turn_on`, `turn_off`, `set_temperature`, etc.)
- `data` - Service-specific parameters (brightness, temperature, color, etc.)
- `autonomyLevel` - Required autonomy for operation (0.6 for control, 0.2 for read)
- `policyAction` - Policy action (`home.control` or `home.read`)

**Constraints:**

- Control operations require `home.control` scope
- Read operations require `home.read` scope
- Autonomy level determines if operation requires user confirmation

## Package Structure

Following the canonical `type → domain → DB → API → apps` pattern:

### 1. Types (`@alfred/type`)

**File:** `packages/type/src/home.ts`

```typescript
export type HomeProvider = "homeassistant" | "matter" | "zigbee" | "none";

export type HomeDomain =
  | "light"
  | "switch"
  | "climate"
  | "sensor"
  | "binary_sensor"
  | "cover"
  | "fan"
  | "lock"
  | "media_player"
  | "camera";

export interface HomeEntity {
  id: string;
  name: string;
  domain: HomeDomain;
  state: string | number | boolean;
  attributes: Record<string, unknown>;
  provider: HomeProvider;
  updatedAt: Date;
}

export interface HomeControlRequest {
  entityId: string;
  service: string;
  data?: Record<string, unknown>;
}

export interface HomeControlResult {
  success: boolean;
  entityId: string;
  state?: string | number | boolean;
  error?: string;
}
```

**File:** `packages/type/src/home.zod.ts`

```typescript
export const homeEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.enum(["light", "switch", "climate", ...]),
  state: z.union([z.string(), z.number(), z.boolean()]),
  attributes: z.record(z.unknown()),
  provider: z.enum(["homeassistant", "matter", "zigbee", "none"]),
  updatedAt: z.date(),
});
```

### 2. Domain Package (`@alfred/home`)

**File:** `packages/home/src/index.ts`

```typescript
// Provider abstraction
export interface HomeProviderClient {
  listEntities(domain?: string): Promise<HomeEntity[]>;
  getEntity(entityId: string): Promise<HomeEntity>;
  controlEntity(
    entityId: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<HomeControlResult>;
  ping(): Promise<boolean>;
}

// Provider factory
export function createProviderClient(
  provider: HomeProvider
): HomeProviderClient;

// Entity utilities
export function normalizeEntityState(entity: HomeEntity): HomeEntity;
export function validateEntityId(entityId: string): boolean;
export function extractDomain(entityId: string): HomeDomain | null;
```

**Responsibilities:**

- Provider abstraction layer (Home Assistant, Matter, Zigbee)
- Entity normalization and validation
- Error translation (provider errors → domain errors)
- Pure transformations (no DB, no API imports)

**Dependencies:** `@alfred/type` only

### 3. Database Schema (`@alfred/db`)

**File:** `packages/db/src/schema/home.ts`

```typescript
export const homeEntities = pgTable("home_entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  entityId: text("entity_id").notNull(), // Provider entity ID
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  provider: text("provider").notNull(),
  lastState: jsonb("last_state"),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const homePreferences = pgTable("home_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  entityId: text("entity_id").notNull(),
  preference: jsonb("preference").notNull(), // e.g., { "default_brightness": 80, "schedule": [...] }
  learnedAt: timestamp("learned_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**File:** `packages/db/src/repo/home.ts`

```typescript
export async function upsertEntity(
  db: DbClient,
  entity: HomeEntity,
  userId: string
): Promise<void>;
export async function getEntity(
  db: DbClient,
  entityId: string,
  userId: string
): Promise<HomeEntity | null>;
export async function listEntities(
  db: DbClient,
  userId: string,
  domain?: string
): Promise<HomeEntity[]>;
export async function savePreference(
  db: DbClient,
  userId: string,
  entityId: string,
  preference: unknown
): Promise<void>;
```

**Purpose:**

- Cache entity metadata and last-known state
- Store user preferences learned from usage patterns
- Enable offline entity discovery (if provider unavailable)

### 4. API Router (`@alfred/api`)

**File:** `packages/api/src/routers/home.ts` (already exists, refactor to use domain package)

```typescript
export const homeRouter = router({
  list: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(z.object({ domain: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const client = createProviderClient(readProvider());
      const entities = await client.listEntities(input.domain);
      // Cache in DB via repo
      return entities;
    }),

  status: authedProcedure
    .use(requirePolicy("home.read", mapResource))
    .input(z.object({ entity: z.string() }))
    .query(async ({ input, ctx }) => {
      const client = createProviderClient(readProvider());
      return await client.getEntity(input.entity);
    }),

  control: authedProcedure
    .use(requirePolicy("home.control", mapResource))
    .input(
      z.object({
        entity: z.string(),
        service: z.string(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const client = createProviderClient(readProvider());
      return await client.controlEntity(
        input.entity,
        input.service,
        input.data
      );
    }),
});
```

**Responsibilities:**

- Policy enforcement (`home.read`, `home.control`)
- Provider client instantiation
- Entity caching via DB repo
- Error handling and translation

### 5. Agent Tool (`@alfred/agent`)

**File:** `packages/agent/assistant/src/tool/home.ts` (already exists, refactor to delegate to domain package)

```typescript
export const toolHome = {
  name: "home",
  description: "Interact with home automation systems...",
  inputSchema: homeInputSchema,
  outputSchema: homeOutputSchema,
  execute: async ({ input, runtimeContext }) => {
    // Policy check
    await requireToolScopesAndPolicy(...);

    // Delegate to domain package
    const client = createProviderClient(readProvider());

    switch (input.action) {
      case "status":
        return { action: "status", entities: await client.listEntities(input.domain) };
      case "control":
        return await client.controlEntity(input.entity, input.service, input.data);
      case "list":
        return { action: "list", entities: await client.listEntities(input.domain) };
    }
  },
};
```

**Responsibilities:**

- Tool schema definition (AI SDK v6)
- Policy enforcement (scopes, autonomy)
- Delegation to domain package
- Error translation for tool output

### 6. UI Component (`@alfred/ui`)

**File:** `packages/ui/src/pane/home.tsx` (already exists)

**Responsibilities:**

- Display entity list with state
- Control UI (toggle buttons, sliders)
- Real-time state updates via tRPC subscriptions
- Error display

## Integration Patterns

### Knowledge Graph Integration

**Pattern:** Learn user preferences from control operations

```typescript
// After successful control operation
await knowledgeGraph.addFact({
  subject: `home:${entityId}`,
  predicate: "user_preference",
  object: JSON.stringify({ service, data }),
  confidence: 0.7,
  source: "home_control",
});
```

**Use Cases:**

- "User always dims lights to 50% at 9pm" → suggest automation
- "User sets thermostat to 72°F in winter" → default suggestion
- "User turns on living room lights every evening" → proactive control

### Cognitive System Integration

**Pattern:** Autonomy constraints for control operations

```typescript
// Control operations require higher autonomy
const autonomyLevel = action === "control" ? 0.6 : 0.2;

// Cognitive system checks autonomy before allowing control
if (autonomyLevel > currentAutonomy) {
  return { requiresConfirmation: true, autonomyLevel };
}
```

**Use Cases:**

- Read operations: low autonomy (0.2) - always allowed
- Control operations: medium autonomy (0.6) - requires user confirmation if autonomy < 0.6
- Critical operations (locks, alarms): high autonomy (0.9) - always requires confirmation

### Policy System Integration

**Pattern:** Scope-based access control

```typescript
// Policy checks before operations
await requirePolicy("home.read", { kind: "home", id: entityId });
await requirePolicy("home.control", { kind: "home", id: entityId });
```

**Scopes:**

- `home.read` - Query entity state, list entities
- `home.control` - Execute control operations

## Provider Abstraction

### Home Assistant Provider

**Implementation:** `packages/home/src/providers/homeassistant.ts`

- REST API client (`/api/states`, `/api/services`)
- Long-lived token authentication
- Entity state polling
- Service call execution

### Matter Provider (Future)

**Implementation:** `packages/home/src/providers/matter.ts`

- Matter protocol integration
- Local device discovery
- Direct device control

### Zigbee Provider (Future)

**Implementation:** `packages/home/src/providers/zigbee.ts`

- Zigbee coordinator integration
- Device pairing and control
- Mesh network management

## Error Handling

**Domain Errors:**

```typescript
export type HomeError =
  | { kind: "not_configured"; message: string }
  | { kind: "entity_not_found"; entityId: string }
  | { kind: "service_not_supported"; entityId: string; service: string }
  | { kind: "provider_error"; provider: HomeProvider; message: string }
  | { kind: "timeout"; entityId: string }
  | { kind: "unauthorized"; message: string };
```

**Provider Error Translation:**

- Home Assistant 401/403 → `unauthorized`
- Home Assistant 404 → `entity_not_found`
- Timeout → `timeout`
- Network errors → `provider_error`

## Performance Budgets

Following ALFRED's performance standards:

- **Entity listing:** < 100ms (provider API call)
- **State query:** < 50ms (provider API call)
- **Control operation:** < 200ms (provider API call + state update)
- **Provider ping:** < 100ms (health check)

## Testing Strategy

**Unit Tests (`packages/home/test/`):**

- Provider abstraction tests (mock provider responses)
- Entity normalization tests
- Error translation tests
- Boundary tests (no DB/API imports)

**Integration Tests (`packages/api/test/home.router.test.ts`):**

- Provider client integration (Home Assistant mock)
- Policy enforcement tests
- Error handling tests

**E2E Tests:**

- Real Home Assistant instance (optional, gated by env var)
- Control operation verification
- State synchronization checks

## Migration Path

**Current State:**

- Tool: `packages/agent/assistant/src/tool/home.ts`
- Router: `packages/api/src/routers/home.ts`
- Client: `packages/agent/src/lib/homeassistant.ts`
- UI: `packages/ui/src/pane/home.tsx`

**Target State:**

1. Create `packages/home/` domain package
2. Move `homeassistant.ts` → `packages/home/src/providers/homeassistant.ts`
3. Extract provider abstraction interface
4. Add types to `packages/type/src/home.ts`
5. Add schema to `packages/db/src/schema/home.ts`
6. Add repo to `packages/db/src/repo/home.ts`
7. Refactor router to use domain package
8. Refactor tool to delegate to domain package
9. Update UI to use new types

## Related Domains

- **`sense`** - Capture domain (may capture home automation requests)
- **`knowledge`** - Preference learning and pattern recognition
- **`cognitive`** - Autonomy constraints for control operations
- **`policy`** - Security and access control
- **`agent`** - Tool exposure for natural language control

## Anti-Patterns

**Avoid:**

1. **Direct provider coupling** - Always use provider abstraction
2. **State caching without invalidation** - Provider is source of truth
3. **Control operations without policy checks** - Always enforce scopes
4. **Hardcoded provider logic** - Use factory pattern for provider selection
5. **DB-first entity management** - Entities come from provider, DB is cache

## Future Extensions

**Potential Additions:**

1. **Scene Management** - Multi-entity scene control
2. **Automation Rules** - ALFRED-managed automations (beyond provider)
3. **Energy Monitoring** - Power consumption tracking
4. **Security Integration** - Lock and alarm control (separate domain)
5. **Voice Control** - Direct voice-to-device control (bypass provider)
