# MCP OAuth 2.1 Integration Research

**Date**: 2025-12-28  
**Purpose**: Research findings for Phase 6 of TUI Package Implementation  
**Status**: Research Complete ✅

---

## Executive Summary

ALFRED already has the foundation for MCP OAuth integration:
- ✅ OIDC Provider plugin configured (`packages/auth/src/index.ts`)
- ✅ Device Authorization flow implemented
- ✅ Well-known endpoints exist (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`)
- ✅ Consent page exists (`apps/web/src/routes/consent.tsx`)
- ✅ Basic scopes defined (`openid`, `profile`, `email`, `read:*`, `write:*`, `admin:*`)

Phase 6 focuses on:
1. Defining granular MCP-specific scopes
2. Registering trusted AI clients (Cursor, Claude)
3. Testing the complete authentication flow
4. Adding introspection/revocation endpoints

---

## MCP Authorization Specification (2025-06-18)

### Key Requirements

The MCP specification mandates OAuth 2.1 with the following requirements:

1. **OAuth 2.1 Compliance**
   - PKCE (Proof Key for Code Exchange) is **mandatory** for all clients
   - No implicit flow (removed in OAuth 2.1)
   - Authorization code flow only

2. **RFC 9728: OAuth 2.0 Protected Resource Metadata**
   - MCP servers expose `/.well-known/oauth-protected-resource` ✅ (Already implemented)
   - Contains `resource`, `authorization_servers`, `scopes_supported`

3. **RFC 8414: Authorization Server Metadata**
   - Expose `/.well-known/oauth-authorization-server` ✅ (Already implemented)
   - Contains endpoints, grant types, scopes

4. **Dynamic Client Registration (Optional)**
   - RFC 7591: Allows AI agents to register programmatically
   - Better Auth supports this via OIDC Provider

### MCP Client Types

| Client Type | Description | Auth Method |
|-------------|-------------|-------------|
| **Public** | CLI tools, desktop apps | PKCE, no secret |
| **Confidential** | Server-side integrations | client_secret + PKCE |
| **Trusted** | First-party tools (Cursor, Claude) | Pre-registered, skipConsent |

---

## Better Auth OIDC Provider Configuration

### Current Configuration (packages/auth/src/index.ts)

```typescript
oidcProvider({
  loginPage: "/sign-in",
  consentPage: "/consent",
  trustedClients: [], // ← Empty, needs MCP clients
  metadata: {
    issuer: origin,
    scopes_supported: [
      "openid",
      "profile",
      "email",
      "read:*",
      "write:*",
      "admin:*",
    ],
  },
})
```

### Recommended MCP Client Registration

```typescript
oidcProvider({
  loginPage: "/sign-in",
  consentPage: "/consent",
  trustedClients: [
    {
      clientId: "cursor-ide",
      clientSecret: process.env.CURSOR_CLIENT_SECRET,
      name: "Cursor IDE",
      type: "confidential",
      redirectURLs: [
        "http://localhost:*/callback",
        "cursor://callback",
      ],
      skipConsent: true, // Trust Cursor
      metadata: { provider: "cursor" },
    },
    {
      clientId: "claude-desktop",
      clientSecret: process.env.CLAUDE_CLIENT_SECRET,
      name: "Claude Desktop",
      type: "confidential",
      redirectURLs: [
        "http://localhost:*/callback",
        "claude://callback",
      ],
      skipConsent: true, // Trust Claude
      metadata: { provider: "anthropic" },
    },
    {
      clientId: "mcp-generic",
      // No secret - public client
      name: "Generic MCP Client",
      type: "native", // Public client
      redirectURLs: ["http://localhost:*/*"],
      skipConsent: false, // Require consent for unknown clients
      metadata: {},
    },
  ],
  metadata: {
    issuer: origin,
    scopes_supported: [
      // OIDC standard
      "openid",
      "profile",
      "email",
      "offline_access",
      // ALFRED-specific
      "read:todos",
      "read:notes",
      "read:reminders",
      "read:knowledge",
      "read:cognitive",
      "write:todos",
      "write:notes",
      "write:reminders",
      "write:knowledge",
      "admin:voice",
      "admin:workflow",
      "admin:deploy",
    ],
  },
})
```

---

## Scope Definitions

### Scope Hierarchy

```
read:*          → All read operations
├── read:todos
├── read:notes
├── read:reminders
├── read:knowledge
├── read:cognitive
└── read:workflows

write:*         → All write operations
├── write:todos
├── write:notes
├── write:reminders
├── write:knowledge
└── write:workflows

admin:*         → Administrative operations (require biometric)
├── admin:voice
├── admin:workflow
├── admin:deploy
└── admin:system
```

### Scope-to-Router Mapping

| Scope | Router | Procedures |
|-------|--------|------------|
| `read:todos` | `todo` | `list`, `get` |
| `write:todos` | `todo` | `create`, `update`, `delete`, `complete` |
| `read:notes` | `note` | `list`, `get` |
| `write:notes` | `note` | `create`, `update`, `delete` |
| `read:knowledge` | `knowledge` | `visualize`, `stats` |
| `write:knowledge` | `knowledge` | `ingest`, `create` |
| `read:cognitive` | `cognitive` | `state`, `history` |
| `admin:voice` | `admin` | `getVoiceStats`, `restartVoicePool` |
| `admin:workflow` | `workflow` | `cancel`, `restart` |

---

## Implementation Checklist

### Phase 6.1: Scope Definition (Day 1)

- [ ] Create `packages/type/src/scopes.ts` with scope constants
- [ ] Define scope hierarchy with wildcard resolution
- [ ] Add `requireScopes` middleware to tRPC
- [ ] Update router procedures with scope requirements

### Phase 6.2: Trusted Client Registration (Day 2)

- [ ] Add `CURSOR_CLIENT_SECRET` and `CLAUDE_CLIENT_SECRET` to env.example
- [ ] Configure trusted clients in OIDC Provider
- [ ] Add dynamic client registration endpoint
- [ ] Create client management UI (optional)

### Phase 6.3: Resource Server Endpoints (Day 3)

Better Auth handles these automatically, but verify:
- [ ] `/api/auth/oauth2/introspect` - Token introspection (RFC 7662)
- [ ] `/api/auth/oauth2/revoke` - Token revocation (RFC 7009)
- [ ] Test introspection response format

### Phase 6.4: Integration Testing (Day 4-5)

- [ ] Create `scripts/verify-mcp-auth.ts` test script
- [ ] Test Device Authorization flow end-to-end
- [ ] Test Authorization Code + PKCE flow
- [ ] Test token refresh
- [ ] Test scope enforcement
- [ ] Test trusted client consent bypass

### Phase 6.5: Documentation (Day 5)

- [ ] Document MCP client registration process
- [ ] Add examples for Cursor integration
- [ ] Add examples for Claude Desktop integration
- [ ] Update API documentation with scope requirements

---

## MCP Authentication Flow

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MCP OAuth 2.1 Authorization Flow                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. AI Agent discovers ALFRED's OAuth metadata                                │
│     GET /.well-known/oauth-protected-resource                                │
│     Response: { authorization_servers: ["https://alfred.local"], ... }       │
│                                                                               │
│  2. AI Agent fetches authorization server metadata                           │
│     GET /.well-known/oauth-authorization-server                              │
│     Response: { authorization_endpoint, token_endpoint, ... }                │
│                                                                               │
│  3. AI Agent initiates authorization                                          │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │ Option A: Authorization Code + PKCE (for apps with browser)         │  │
│     │   GET /api/auth/oauth2/authorize                                    │  │
│     │     ?client_id=cursor-ide                                           │  │
│     │     &redirect_uri=cursor://callback                                 │  │
│     │     &response_type=code                                             │  │
│     │     &scope=openid read:todos write:notes                            │  │
│     │     &code_challenge=<sha256(verifier)>                              │  │
│     │     &code_challenge_method=S256                                     │  │
│     │                                                                     │  │
│     │ Option B: Device Authorization (for CLI/headless)                   │  │
│     │   POST /api/auth/oauth2/device/code                                 │  │
│     │     client_id=cursor-ide                                            │  │
│     │     scope=openid read:todos write:notes                             │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  4. User authenticates (passkey/password)                                     │
│     ├─ Trusted client: Skip consent → redirect with code                     │
│     └─ Unknown client: Show consent page → redirect with code                │
│                                                                               │
│  5. AI Agent exchanges code for tokens                                        │
│     POST /api/auth/oauth2/token                                              │
│       grant_type=authorization_code                                          │
│       code=<authorization_code>                                              │
│       redirect_uri=cursor://callback                                         │
│       code_verifier=<pkce_verifier>                                          │
│       client_id=cursor-ide                                                   │
│       client_secret=<secret>  (confidential clients only)                    │
│                                                                               │
│  6. AI Agent calls ALFRED API with access token                               │
│     Authorization: Bearer <access_token>                                     │
│     → tRPC procedures validate scope before execution                        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### 1. Scope Enforcement

```typescript
// packages/api/src/middleware/scopes.ts
export function requireScopes(...scopes: string[]) {
  return middleware(async ({ ctx, next }) => {
    const tokenScopes = ctx.session?.scopes ?? [];
    
    for (const required of scopes) {
      if (!hasScope(tokenScopes, required)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing required scope: ${required}`,
        });
      }
    }
    
    return next();
  });
}

// Wildcard resolution
function hasScope(granted: string[], required: string): boolean {
  // Direct match
  if (granted.includes(required)) return true;
  
  // Wildcard match (read:* covers read:todos)
  const [action] = required.split(":");
  if (granted.includes(`${action}:*`)) return true;
  
  return false;
}
```

### 2. Admin Scope + Biometric

Admin scopes (`admin:*`) require both:
1. Valid access token with `admin:*` scope
2. Recent biometric verification (`requireRecentBiometric`)

```typescript
// Example: Admin procedure with scope + biometric
adminRouter.procedure
  .use(requireScopes("admin:voice"))
  .use(requireRecentBiometric)
  .mutation("restartVoicePool", ...);
```

### 3. Token Introspection

AI agents can validate tokens via introspection:

```http
POST /api/auth/oauth2/introspect
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

token=<access_token>
```

Response:
```json
{
  "active": true,
  "client_id": "cursor-ide",
  "scope": "openid read:todos write:notes",
  "sub": "user-uuid",
  "exp": 1735430400
}
```

---

## Testing Strategy

### 1. Unit Tests

```typescript
// packages/auth/test/scopes.test.ts
describe("Scope Resolution", () => {
  it("resolves wildcard scopes", () => {
    expect(hasScope(["read:*"], "read:todos")).toBe(true);
    expect(hasScope(["read:todos"], "read:notes")).toBe(false);
  });
});
```

### 2. Integration Tests

```typescript
// scripts/verify-mcp-auth.ts
async function testMCPAuth() {
  // 1. Fetch metadata
  const metadata = await fetch("/.well-known/oauth-protected-resource").json();
  
  // 2. Request device code
  const deviceCode = await auth.oauth2.requestDeviceCode({
    client_id: "test-client",
    scope: "openid read:todos",
  });
  
  // 3. Simulate user approval
  // 4. Exchange for token
  // 5. Call protected endpoint
  // 6. Verify scope enforcement
}
```

### 3. E2E Tests

- Test Cursor IDE OAuth flow
- Test Claude Desktop OAuth flow
- Test TUI Device Authorization flow

---

## References

- [MCP Authorization Spec (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Better Auth OAuth Provider](https://www.better-auth.com/docs/plugins/oauth-provider)
- [Better Auth OIDC Provider](https://www.better-auth.com/docs/plugins/oidc-provider)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [OAuth 2.1 Draft](https://oauth.net/2.1/)

---

## Next Steps

1. **Immediate**: Update `packages/auth/src/index.ts` with trusted clients
2. **Short-term**: Create scope middleware and update routers
3. **Medium-term**: Add introspection/revocation verification
4. **Long-term**: Build client management UI

---

## Appendix: Environment Variables

Add to `config/env.example`:

```bash
# MCP OAuth Clients
CURSOR_CLIENT_SECRET=      # Generate with: openssl rand -hex 32
CLAUDE_CLIENT_SECRET=      # Generate with: openssl rand -hex 32
MCP_DYNAMIC_REGISTRATION=false  # Enable dynamic client registration
```
