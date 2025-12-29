# Credential Storage Patterns

## Core Principle

CLI credentials use OS keychain via `Bun.secrets` with file fallback. Encryption uses AES-256-GCM with machine-specific keys. Auto-migrate from plaintext.

## Rules

1. **Primary storage.** Use `Bun.secrets.get/set/delete()` with `service: "com.alfred.cli"` and `name: "session"`. Falls back gracefully when unavailable.

2. **File fallback.** Store at `~/.alfred/credentials.json` with mode `0600`. Create directory with mode `0700`.

3. **Auto-migration.** When loading from file and `Bun.secrets` available, auto-migrate to secure storage.

4. **Encryption fallback.** When `Bun.secrets` unavailable, encrypt file contents with `encryptCredentials()` before writing.

5. **Machine-specific key.** Derive encryption key from hostname, username, uid. Use PBKDF2-like derivation with 10,000 rounds.

6. **AES-256-GCM format.** Encrypted data contains: `salt` (16 bytes), `iv` (12 bytes), `tag` (16 bytes), `data`, `version: 1`.

7. **Credential structure.** Store `{ accessToken, refreshToken, expiresAt, sessionId, user, session, isLocal? }`.

8. **Token refresh.** Check `expiresAt - Date.now() > REFRESH_THRESHOLD` (5 minutes). Refresh via Better Auth OAuth2 client.

9. **Clear both storages.** `clearCredentials()` must delete from both `Bun.secrets` and file to handle migrations.

10. **Graceful errors.** Return `null` on load failures. Swallow errors on clear. Never throw in credential operations.

## See Also

- `packages/tui/src/cli/credentials.ts` for implementation
- `.ruler/03-security.md` in `packages/auth` for security expectations
