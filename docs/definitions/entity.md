# Entity

An entity is a discrete, identifiable object in ALFRED's domain. Entities are the nouns of ALFRED's vocabulary—the things that tools operate on and artifacts describe.

## Examples

| Entity | Description | Schema Location |
|--------|-------------|-----------------|
| Note | User-created text content | `packages/db/src/schema/note.ts` |
| Reminder | Time-triggered alert | `packages/db/src/schema/remind.ts` |
| Timer | Duration tracker | `packages/db/src/schema/timer.ts` |
| Book | Library item | `packages/db/src/schema/book.ts` |
| Fact | Knowledge graph node | `packages/knowledge/` |
| Preference | User setting | `packages/db/src/schema/preference.ts` |

## Structure

Every entity has:

**Unique identifier.** Typically a UUID, sometimes a human-readable slug. The identifier is stable across the entity's lifetime.

**Canonical schema.** Defined in `packages/db/src/schema/` using Drizzle ORM. The schema is the source of truth for entity structure.

**Repository.** Database operations in `packages/db/src/repo/`. Repositories encapsulate queries and mutations.

**Optionally, tools.** Agent-facing capabilities in `packages/agent/`. Not all entities have dedicated tools—some are accessed through broader tools (e.g., knowledge facts via `knowledge_query`).

## Entity vs Artifact

Entities are the underlying data model. Artifacts are file representations of tool outputs.

- A note is an **entity** stored in Postgres
- Calling `note_list` produces an **artifact** at `.agent/tools/note/list.json`
- The artifact contains a snapshot of entity data formatted for agent consumption

Artifacts may reference entities by ID. Agents reading artifacts can follow up with tools to mutate the underlying entities.

## Naming Convention

Entity names are single lowercase words following ALFRED's naming convention (`.ruler/01-naming-conventions.md`). This carries through to:
- Table names (`note`, `remind`, `timer`)
- Schema files (`note.ts`, `remind.ts`)
- Repository functions (`noteRepo.list()`)
- Tool names (`note_create`, `remind_set`)

Multi-word concepts use domain prefixes: `knowledge_fact`, `cognitive_state`.

## Entity Lifecycle

1. **Creation.** Tool call or direct API creates entity in database
2. **Mutation.** Tools modify entity state
3. **Query.** Tools read entity data, produce artifacts
4. **Deletion.** Tool or API removes entity

Entities persist until explicitly deleted. ALFRED is a single-user system, so there's no multi-tenancy complexity—entities belong to the user.

## Related Concepts

- **tool** — Capabilities that operate on entities
- **artifact** — File representations of entity data
- **ontology** — How entities relate to each other
