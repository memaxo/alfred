# Voice Preference Patterns

## Preference Module Structure

1. **Centralized preference file.** Domain features with user settings create `src/<domain>/preferences.ts` containing: key constants, type definitions, defaults object, and async loader function.

2. **Key constants object.** Export `const DOMAIN_KEYS = { ... } as const` mapping setting names to preference key strings. Keys follow `domain.<subdomain>.<setting>` format.

3. **Type definitions.** Define union types for enum settings (e.g., `"brief" | "standard" | "detailed"`). Export all types for use in handlers and UI.

4. **Defaults object.** Export `const DOMAIN_DEFAULTS: DomainPreferences = { ... }` with all settings. Defaults must be sensible for single-user context.

5. **Loader function.** Export `async function getDomainPreferences(userId: string): Promise<DomainPreferences>` that reads from `userRepo.getPreferences()`, parses values, and falls back to defaults.

6. **Parse helpers.** Create private `parse*` functions for each setting type. Handle string/number/boolean coercion gracefully. Always return default on parse failure.

## Handler Integration

7. **Load preferences early.** Handlers should `const prefs = await getDomainPreferences(userId)` before main logic, not inline in conditionals.

8. **Pass preferences to pipelines.** When preferences affect execution (e.g., learning mode), pass them to constructors/factories rather than reading inside.

9. **Log preference load failures.** Use `logger.warn("domain_preferences_load_failed", { userId, error })` and return defaults on failure. Never throw.

## Context Expiration Pattern

10. **Deadline field.** When context has time-based expiration, add optional `deadline?: Date` field to context type.

11. **Calculate helper.** Provide `calculateDeadline(timeoutMinutes: number): Date | undefined` that returns undefined for 0/disabled.

12. **Expiration check.** Provide `isExpired(context): boolean` that checks phase and deadline.

13. **Auto-handle expiration.** Create `getContextWithExpiryCheck()` wrapper that auto-handles expired contexts (cleanup, logging) before returning.

## Notification Pattern

14. **In-memory subscriber registry.** Use `Map<userId, Set<callback>>` for real-time notifications. No persistence needed.

15. **Subscribe returns unsubscribe.** `subscribeToNotifications(userId, callback): () => void` pattern.

16. **Check preferences before emitting.** Always load user preferences to respect notification mode (voice/sound/silent).

17. **Graceful TTS failure.** When synthesizing audio for notifications, catch TTS errors and emit notification without audio rather than failing.
