# context fixture

This fixture is meant to require local code reading.

- The “source of truth” string lives in `src/config.ts`.
- The failing test asserts `greet()` equals `expected()`, which derives from `EXPECTED_GREETING`.

