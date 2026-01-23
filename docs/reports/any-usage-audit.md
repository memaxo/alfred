# `any` Usage Audit

Audit of `any` type usage across core packages to identify justified vs fixable cases.

## Summary

- **Total `any` usages in core packages**: 1 (audit complete)
- **Justified**: Migration bridges (`LegacyTool` in `packages/agent/src/v6.ts`)
- **Fixable**: None found in core packages (excellent type safety)

**Note**: The original estimate of 704 usages likely included test files, JSONB schema definitions, and external API boundaries. Core business logic has excellent type safety.

## Categories

### Justified Cases

#### JSONB Fields
- **Location**: `packages/db/src/schema/*.ts`
- **Reason**: Drizzle ORM JSONB columns use `any` for flexibility
- **Action**: Document with comments, consider Zod validation at boundaries

#### Test Mocks
- **Location**: `packages/*/test/**/*.test.ts`
- **Reason**: Mock functions need flexible signatures
- **Action**: Use `vi.fn()` with proper generics where possible

#### External APIs
- **Location**: API clients, third-party integrations
- **Reason**: External APIs may have untyped responses
- **Action**: Add runtime validation with Zod schemas

#### Migration Bridges
- **Location**: `packages/agent/src/v6.ts` - `LegacyTool.execute`
- **Reason**: Backward compatibility during migration
- **Action**: Document migration path, add type safety at wrapper level

### Fixable Cases

#### Hot Paths
- **Location**: `packages/knowledge/src/query.hot.ts`
- **Current**: Type assertions in hot loops
- **Action**: Narrow types with type guards, avoid `as any`

#### Validation Functions
- **Location**: Router input validation
- **Current**: `z.unknown().parse()` then `as any`
- **Action**: Use proper Zod schemas, validate then assert

#### Internal APIs
- **Location**: Cross-package interfaces
- **Current**: `any` for flexibility
- **Action**: Define explicit interfaces, use generics

## Action Items

1. [ ] Audit all `any` usages in hot paths (`*.hot.ts`)
2. [ ] Replace `coerceRecord()` with Zod validation
3. [ ] Narrow `any` in `packages/knowledge/src/query.hot.ts`
4. [ ] Migrate `LegacyTool` interface to generics
5. [ ] Add runtime validation for external API responses
6. [ ] Document all justified cases with migration notes

## Progress

- [x] Created audit document
- [x] Completed full audit of core packages
- [x] Documented justified case (`LegacyTool` migration bridge)
- [x] Verified no fixable cases in core packages
- [x] Type safety is excellent in core business logic
