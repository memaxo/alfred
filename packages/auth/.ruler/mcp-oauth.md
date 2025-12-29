# MCP OAuth Integration

## Core Principle

Model Context Protocol uses OAuth 2.1 with PKCE. Better Auth's OIDC Provider enables ALFRED as an authorization server. Trusted clients skip consent.

## Rules

1. **OIDC Provider setup.** Configure `oidcProvider()` plugin with `loginPage`, `consentPage`, `trustedClients`, and `metadata.scopes_supported`.

2. **Trusted client registration.** Add client IDs to `trustedClients` array from environment variables. Check both `*_CLIENT_ID` and `*_CLIENT_SECRET` exist before adding.

3. **Environment variables.** Use `CURSOR_CLIENT_ID/SECRET`, `CLAUDE_CLIENT_ID/SECRET`, `MCP_CLIENT_ID/SECRET` for MCP client credentials. Document in `config/env.example`.

4. **Scopes supported.** Expose OIDC scopes (`openid`, `profile`, `email`, `offline_access`) and resource scopes (`read:*`, `write:*`, `admin:*`).

5. **Well-known endpoints.** Better Auth exposes `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`. Create `/.well-known/oauth-protected-resource` manually for RFC 9728.

6. **Device Authorization flow.** Better Auth supports RFC 8628 for CLI/TUI authentication. Use `deviceAuthorization()` plugin.

7. **Token introspection.** Better Auth OIDC does not implement RFC 7662 introspection. Implement manually via `/api/auth/introspect` if needed, or validate tokens via JWT/JWKS.

8. **Token revocation.** Better Auth OIDC does not implement RFC 7009 revocation. Implement manually via `/api/auth/revoke` by deleting from `oauthAccessToken` table.

9. **Client secrets.** Generate with `openssl rand -base64 32`. Store in environment variables, never in code.

10. **Consent page.** Create at path specified in `consentPage`. Display requested scopes. For trusted clients, consent is auto-granted.

## See Also

- `docs/research/mcp-oauth-integration.md` for detailed research
- `docs/guides/mcp-integration.md` for client registration guide
