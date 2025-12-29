# Event Versioning & Compatibility

1. **Additive Changes.** Prefer adding optional fields to existing event schemas. Additive changes do not require a version increment if they don't break existing consumers.

2. **Breaking Changes.** Any change that removes, renames, or changes the type of an existing field MUST increment the `v` field in `EventEnvelope`.

3. **Migration Registry.** Every version increment MUST be accompanied by a migration function in `packages/type/src/versioning.ts` that transforms the previous version to the new one.

4. **Historical Replay.** Never remove migration functions from the registry. The system must always be able to reconstruct the latest state from any historical event version.

5. **Serialization.** Always use `stableStringify` for event data to ensure deterministic content-addressable IDs (when enabled) and consistent migration inputs.
