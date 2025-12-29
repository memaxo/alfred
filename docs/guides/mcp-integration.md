# MCP Integration Guide

## Overview

ALFRED supports the Model Context Protocol (MCP) for AI agent authentication. This enables tools like Cursor IDE, Claude Desktop, and custom MCP clients to securely access ALFRED's APIs.

## How It Works

1. **OAuth 2.1 + PKCE**: All MCP clients authenticate via OAuth 2.1 with Proof Key for Code Exchange (PKCE)
2. **OIDC Provider**: ALFRED acts as an OpenID Connect provider via Better Auth
3. **Scoped Access**: Clients request specific scopes to limit their access
4. **Device Authorization**: CLI and input-constrained devices use RFC 8628 device flow

## Registering a Client

### Environment Variables

Add your MCP client credentials to `.env`:

```bash
# Cursor IDE
CURSOR_CLIENT_ID=cursor-mcp-client
CURSOR_CLIENT_SECRET=your-secret-here

# Claude Desktop
CLAUDE_CLIENT_ID=claude-mcp-client
CLAUDE_CLIENT_SECRET=your-secret-here

# Custom client
MCP_CLIENT_ID=my-custom-client
MCP_CLIENT_SECRET=your-secret-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Trusted vs Untrusted Clients

- **Trusted**: Skip consent screen, used for first-party integrations
- **Untrusted**: Show consent screen, used for third-party apps

Clients with both `CLIENT_ID` and `CLIENT_SECRET` in env are automatically trusted.

## Discovery Endpoints

MCP clients discover ALFRED's OAuth configuration via well-known endpoints:

| Endpoint | RFC | Purpose |
|----------|-----|---------|
| `/.well-known/oauth-authorization-server` | RFC 8414 | Authorization server metadata |
| `/.well-known/oauth-protected-resource` | RFC 9728 | Protected resource metadata |

### Authorization Server Metadata

```json
{
  "issuer": "https://alfred.local",
  "authorization_endpoint": "/api/auth/oauth2/authorize",
  "token_endpoint": "/api/auth/oauth2/token",
  "device_authorization_endpoint": "/api/auth/device",
  "introspection_endpoint": "/api/auth/oauth2/introspect",
  "revocation_endpoint": "/api/auth/oauth2/revoke",
  "scopes_supported": ["openid", "profile", "read:*", "write:*", "admin:*"],
  "code_challenge_methods_supported": ["S256"]
}
```

## Available Scopes

### OIDC Standard Scopes

| Scope | Description |
|-------|-------------|
| `openid` | Required for OIDC flows |
| `profile` | User profile information |
| `email` | User email address |
| `offline_access` | Refresh tokens |

### Read Scopes

| Scope | Description |
|-------|-------------|
| `read:*` | All read operations |
| `read:todos` | View todos |
| `read:notes` | View notes |
| `read:reminders` | View reminders |
| `read:knowledge` | View knowledge graph |
| `read:cognitive` | View cognitive state |
| `read:workflows` | View workflow runs |
| `read:timers` | View timers |
| `read:bookmarks` | View bookmarks |

### Write Scopes

| Scope | Description |
|-------|-------------|
| `write:*` | All write operations |
| `write:todos` | Create/update/delete todos |
| `write:notes` | Create/update/delete notes |
| `write:reminders` | Create/update/delete reminders |
| `write:knowledge` | Create/update/delete knowledge |
| `write:workflows` | Create/start/cancel workflows |
| `write:timers` | Create/update/delete timers |
| `write:bookmarks` | Create/update/delete bookmarks |

### Admin Scopes

Admin scopes require biometric verification:

| Scope | Description |
|-------|-------------|
| `admin:*` | All admin operations |
| `admin:voice` | Voice pipeline control |
| `admin:workflow` | Workflow system admin |
| `admin:deploy` | Deploy operations |
| `admin:system` | System administration |

## Authentication Flows

### Authorization Code + PKCE (Web Apps)

1. Generate `code_verifier` and `code_challenge`
2. Redirect to `/api/auth/oauth2/authorize` with challenge
3. User authenticates and consents
4. Exchange authorization code for tokens

```typescript
// Generate PKCE values
const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
const codeChallenge = await sha256(codeVerifier);

// Authorization URL
const authUrl = new URL("https://alfred.local/api/auth/oauth2/authorize");
authUrl.searchParams.set("client_id", "my-client");
authUrl.searchParams.set("redirect_uri", "https://my-app.com/callback");
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "openid profile read:todos write:todos");
authUrl.searchParams.set("code_challenge", codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");

// Token exchange
const tokenResponse = await fetch("https://alfred.local/api/auth/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    redirect_uri: "https://my-app.com/callback",
    client_id: "my-client",
    code_verifier: codeVerifier,
  }),
});
```

### Device Authorization (CLI/TUI)

1. Request device code
2. Show user code and verification URL
3. Poll for token completion

```typescript
// Request device code
const deviceResponse = await fetch("https://alfred.local/api/auth/device", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: "alfred-cli",
    scope: "openid profile read:* write:*",
  }),
});

const { device_code, user_code, verification_uri, interval } = await deviceResponse.json();

console.log(`Open ${verification_uri} and enter: ${user_code}`);

// Poll for completion
let token = null;
while (!token) {
  await sleep(interval * 1000);
  
  const pollResponse = await fetch("https://alfred.local/api/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
      client_id: "alfred-cli",
    }),
  });
  
  const result = await pollResponse.json();
  if (result.access_token) {
    token = result;
  } else if (result.error === "authorization_pending") {
    continue; // Keep polling
  } else {
    throw new Error(result.error_description);
  }
}
```

## Token Validation

### JWT Validation (Recommended)

ALFRED uses JWT tokens signed with keys available at the JWKS endpoint. Validate tokens locally:

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://alfred.local/api/auth/.well-known/jwks.json")
);

async function validateToken(accessToken: string) {
  const { payload } = await jwtVerify(accessToken, JWKS, {
    issuer: "https://alfred.local",
  });
  
  return {
    userId: payload.sub,
    scopes: payload.scope?.split(" ") ?? [],
    expiresAt: payload.exp,
  };
}
```

### Introspection (RFC 7662)

> **Note**: Token introspection is not currently implemented in Better Auth's OIDC Provider.
> Use JWT validation via the JWKS endpoint instead.

### Revocation (RFC 7009)

> **Note**: Token revocation is not currently implemented in Better Auth's OIDC Provider.
> Use session management endpoints instead:

```typescript
// Sign out current session
await fetch("https://alfred.local/api/auth/sign-out", {
  method: "POST",
  credentials: "include",
});

// Or revoke a specific session (requires auth)
await fetch("https://alfred.local/api/auth/revoke-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionToken }),
  credentials: "include",
});
```

## Cursor Integration

### Setup

1. Open Cursor Settings → MCP
2. Add ALFRED as an MCP server:
   ```json
   {
     "name": "alfred",
     "url": "https://alfred.local",
     "auth": {
       "type": "oauth",
       "client_id": "cursor-mcp-client"
     }
   }
   ```
3. Authenticate when prompted

### Available Tools

Once authenticated, Cursor can access ALFRED tools:

- `alfred.todo.list` - List todos
- `alfred.todo.create` - Create a todo
- `alfred.note.list` - List notes
- `alfred.workflow.start` - Start a workflow

## Claude Desktop Integration

### Setup

1. Open Claude Desktop Settings
2. Navigate to MCP Configuration
3. Add ALFRED:
   ```json
   {
     "servers": {
       "alfred": {
         "url": "https://alfred.local",
         "oauth": {
           "client_id": "claude-mcp-client"
         }
       }
     }
   }
   ```

## Testing

Verify your MCP auth setup:

```bash
bun scripts/verify-mcp-auth.ts --base-url http://localhost:3000
```

Expected output:
```
🔐 MCP OAuth Authentication Verification
   Base URL: http://localhost:3000

✅ Authorization Server Metadata: All required fields present
✅ Protected Resource Metadata: Protected resource metadata valid
✅ Device Authorization Endpoint: Device authorization flow working
✅ Token Introspection Endpoint: Introspection endpoint working
✅ Token Revocation Endpoint: Revocation endpoint exists
✅ Scope Configuration: All required scopes configured

──────────────────────────────────────────────────
Summary: 6 passed, 0 failed

✅ MCP Auth verification passed. ALFRED is ready for MCP clients.
```

## Troubleshooting

### "client_id not found"

The client is not registered. Add credentials to `.env`:
```bash
MCP_CLIENT_ID=your-client-id
MCP_CLIENT_SECRET=your-secret
```

### "scope_required" error

The token doesn't have the required scope. Request additional scopes during authorization:
```
scope=openid profile read:todos write:todos
```

### "admin_scope_requires_biometric"

Admin operations require recent biometric verification. Trigger a passkey authentication first.

### "Token expired"

Use the refresh token to get a new access token:
```typescript
const refreshResponse = await fetch("https://alfred.local/api/auth/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  }),
});
```

## Security Considerations

1. **Never commit secrets**: Store `CLIENT_SECRET` in `.env` only
2. **Use HTTPS**: Always use HTTPS in production
3. **Rotate secrets**: Periodically rotate client secrets
4. **Minimal scopes**: Request only the scopes your client needs
5. **Token storage**: Store tokens securely (keychain, encrypted storage)
6. **Short TTL**: Access tokens are short-lived; use refresh tokens

## See Also

- [MCP Specification](https://spec.modelcontextprotocol.io)
- [OAuth 2.1 RFC](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12)
- [RFC 8628 Device Authorization](https://datatracker.ietf.org/doc/html/rfc8628)
- [RFC 9728 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [Better Auth OIDC Provider](https://www.better-auth.com/docs/plugins/oidc-provider)
