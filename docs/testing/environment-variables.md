# Testing Environment Variables

## Overview

When running integration tests, several environment variables control behavior for bypassing security requirements and adjusting test configuration.

## Required Variables

### DATABASE_URL

Controls which database backend is used:

```bash
# SQLite in-memory (fast, default)
DATABASE_URL="sqlite::memory:"

# PostgreSQL (full feature support)
DATABASE_URL="postgresql://alfred:alfred@localhost:5432/alfred"
```

**Impact:**
- SQLite: Fast, in-memory, but missing `approvals` table and Postgres-specific features
- PostgreSQL: Full schema support, but requires Docker container

### RUN_DB_TESTS

Enables PostgreSQL-backed database tests:

```bash
# Skip Postgres-specific tests (default)
RUN_DB_TESTS=""

# Enable Postgres-specific tests
RUN_DB_TESTS="1"
```

**Impact:**
- Phase 3 tests (`schema-validation`, `transaction-wrappers`, `cross-schema-joins`) require this
- Without it, 25 tests are skipped

## Optional Bypass Variables

### BIO_AUTH_BYPASS

Bypasses biometric authentication requirements in tests:

```bash
# Enable biometric bypass
BIO_AUTH_BYPASS="true"

# Disable biometric bypass (production behavior)
BIO_AUTH_BYPASS="false"
```

**Why needed:**
- Ed25519 private keys for token signing are not available in test environment
- Tests cannot generate valid biometric JWT signatures
- Allows testing token flow without requiring actual biometric hardware

**Tests that use this:**
- `auth-full-integration.test.ts` - All token lifecycle tests
- `obligation-handling.integration.test.ts` - Biometric obligation tests
- `policy-full-integration.test.ts` - Policy enforcement tests

**Usage in tests:**
```typescript
beforeAll(() => {
  process.env.BIO_AUTH_BYPASS = "true";
});

afterAll(() => {
  process.env.BIO_AUTH_BYPASS = "false"; // cleanup
});
```

## Metrics Variables

### DISABLE_TRPC_METRICS

Disables tRPC metrics collection in tests:

```bash
DISABLE_TRPC_METRICS="1"
```

**Impact:**
- Tests don't increment Prometheus counters
- Faster test execution
- No metric side effects between tests

### DISABLE_METRICS_HOOKS

Disables automatic metrics hooks:

```bash
DISABLE_METRICS_HOOKS="1"
```

**Impact:**
- No automatic metric flushing
- Tests run without monitoring overhead

### MEMORY_DECAY_ENABLED

Controls memory decay in learning worker:

```bash
# Enable memory decay (production)
MEMORY_DECAY_ENABLED="true"

# Disable memory decay (faster tests)
MEMORY_DECAY_ENABLED="false"
```

**Impact:**
- Phase 2 decay scheduler tests depend on this
- Faster tests when disabled

### MEMORY_DECAY_FACTOR

Controls how much confidence decays per interval:

```bash
# Decay by 5% each interval (default)
MEMORY_DECAY_FACTOR="0.95"
```

### MEMORY_DECAY_INTERVAL_MS

Controls how often decay runs:

```bash
# Run decay every hour (default)
MEMORY_DECAY_INTERVAL_MS="3600000"

# Run decay every 10 minutes
MEMORY_DECAY_INTERVAL_MS="600000"
```

## Running Tests with Different Configurations

### Quick Development (SQLite, fast)

```bash
bun test packages/api/test/integration/auth-full-integration.test.ts
```

### Full Test Suite (SQLite)

```bash
bun test packages/api/test/integration/
```

### Full Test Suite (PostgreSQL)

```bash
RUN_DB_TESTS=1 \
DATABASE_URL="postgresql://alfred:alfred@localhost:5432/alfred" \
bun test packages/api/test/integration/
```

### Specific Test File with Postgres

```bash
RUN_DB_TESTS=1 \
DATABASE_URL="postgresql://alfred:alfred@localhost:5432/alfred" \
bun test packages/api/test/integration/schema-validation.integration.test.ts
```

## Docker PostgreSQL Container

The project uses a PostgreSQL container for full schema testing:

**Container details:**
- Name: `alfred-postgres`
- Image: `pgvector/pgvector:pg16`
- Host: `localhost`
- Port: `5432`
- User: `alfred`
- Password: `alfred`
- Database: `alfred`

**Start container:**
```bash
bun run db:start
```

**Connection string:**
```
postgresql://alfred:alfred@localhost:5432/alfred
```

## Test Timeout Configuration

Tests use timeouts via environment variables:

```bash
# Per-test timeout
bun test --timeout 120000

# Process-level watchdog
ALFRED_TEST_WATCHDOG_MS=120000

# File-level timeout
ALFRED_TEST_FILE_TIMEOUT_MS=300000

# Runner timeout
ALFRED_TEST_RUNNER_TIMEOUT_MS=600000
```

## Summary Table

| Variable | Purpose | Recommended Value for Local Tests |
|----------|---------|------------------------------------|
| `DATABASE_URL` | Database backend | `sqlite::memory:` |
| `RUN_DB_TESTS` | Enable Postgres tests | (unset) |
| `BIO_AUTH_BYPASS` | Bypass biometric auth | `true` |
| `DISABLE_TRPC_METRICS` | Disable metrics | `1` |
| `DISABLE_METRICS_HOOKS` | Disable hooks | `1` |
| `MEMORY_DECAY_ENABLED` | Enable decay | (unset) |
| `MEMORY_DECAY_FACTOR` | Decay rate | `0.95` |
| `MEMORY_DECAY_INTERVAL_MS` | Decay interval | `3600000` |
