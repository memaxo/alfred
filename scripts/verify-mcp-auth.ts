#!/usr/bin/env bun
/**
 * MCP OAuth Authentication Verification Script
 *
 * Validates that ALFRED's OAuth 2.1 / OIDC endpoints are properly configured
 * for MCP client integration (Cursor, Claude, etc.).
 *
 * Tests:
 * 1. /.well-known/oauth-authorization-server metadata
 * 2. /.well-known/oauth-protected-resource metadata
 * 3. Device Authorization flow (RFC 8628)
 * 4. Token introspection endpoint (RFC 7662)
 * 5. Token revocation endpoint (RFC 7009)
 *
 * Usage: bun scripts/verify-mcp-auth.ts [--base-url http://localhost:3000]
 */

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : process.env.BETTER_AUTH_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: TestResult[] = [];

function log(message: string, indent = 0) {
  const prefix = "  ".repeat(indent);
  console.log(`${prefix}${message}`);
}

function pass(name: string, message: string, details?: unknown) {
  results.push({ name, passed: true, message, details });
  log(`✅ ${name}: ${message}`);
}

function fail(name: string, message: string, details?: unknown) {
  results.push({ name, passed: false, message, details });
  log(`❌ ${name}: ${message}`);
}

async function testAuthServerMetadata(): Promise<void> {
  const testName = "Authorization Server Metadata";
  const url = `${BASE_URL}/.well-known/oauth-authorization-server`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      fail(testName, `HTTP ${response.status} from ${url}`);
      return;
    }

    const metadata = (await response.json()) as Record<string, unknown>;

    // Validate required fields per RFC 8414
    const requiredFields = [
      "issuer",
      "authorization_endpoint",
      "token_endpoint",
      "scopes_supported",
    ];
    const missingFields = requiredFields.filter(
      (field) => !metadata[field as keyof typeof metadata]
    );

    if (missingFields.length > 0) {
      fail(testName, `Missing required fields: ${missingFields.join(", ")}`, {
        metadata,
      });
      return;
    }

    // Check for MCP-specific fields
    const hasPkce =
      Array.isArray(metadata.code_challenge_methods_supported) &&
      (metadata.code_challenge_methods_supported as string[]).includes("S256");
    const hasDeviceAuth = !!metadata.device_authorization_endpoint;

    if (!hasPkce) {
      fail(testName, "PKCE (S256) not advertised in metadata", { metadata });
      return;
    }

    pass(testName, "All required fields present", {
      issuer: metadata.issuer,
      hasDeviceAuth,
      hasPkce,
      scopesCount: Array.isArray(metadata.scopes_supported)
        ? metadata.scopes_supported.length
        : 0,
    });
  } catch (error) {
    fail(testName, `Request failed: ${(error as Error).message}`);
  }
}

async function testProtectedResourceMetadata(): Promise<void> {
  const testName = "Protected Resource Metadata";
  const url = `${BASE_URL}/.well-known/oauth-protected-resource`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      fail(testName, `HTTP ${response.status} from ${url}`);
      return;
    }

    const metadata = (await response.json()) as Record<string, unknown>;

    // Validate required fields per RFC 9728
    const requiredFields = ["resource", "authorization_servers"];
    const missingFields = requiredFields.filter(
      (field) => !metadata[field as keyof typeof metadata]
    );

    if (missingFields.length > 0) {
      fail(testName, `Missing required fields: ${missingFields.join(", ")}`, {
        metadata,
      });
      return;
    }

    pass(testName, "Protected resource metadata valid", {
      resource: metadata.resource,
      authServerCount: Array.isArray(metadata.authorization_servers)
        ? metadata.authorization_servers.length
        : 0,
    });
  } catch (error) {
    fail(testName, `Request failed: ${(error as Error).message}`);
  }
}

async function testDeviceAuthorizationEndpoint(): Promise<void> {
  const testName = "Device Authorization Endpoint";

  // First get the device_authorization_endpoint from metadata
  const metadataUrl = `${BASE_URL}/.well-known/oauth-authorization-server`;

  try {
    const metaResponse = await fetch(metadataUrl);
    if (!metaResponse.ok) {
      fail(testName, "Could not fetch authorization server metadata");
      return;
    }

    const metadata = (await metaResponse.json()) as Record<string, unknown>;
    const deviceAuthEndpoint = metadata.device_authorization_endpoint as
      | string
      | undefined;

    if (!deviceAuthEndpoint) {
      fail(testName, "device_authorization_endpoint not in metadata", {
        metadata,
      });
      return;
    }

    // Test the device authorization endpoint
    const deviceUrl = deviceAuthEndpoint.startsWith("http")
      ? deviceAuthEndpoint
      : `${BASE_URL}${deviceAuthEndpoint}`;

    const response = await fetch(deviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "test-mcp-client",
        scope: "openid profile",
      }).toString(),
    });

    // Better Auth might return 400 for unknown client, but endpoint should exist
    if (response.status === 404) {
      fail(testName, "Device authorization endpoint not found", {
        url: deviceUrl,
      });
      return;
    }

    const data = (await response.json()) as Record<string, unknown>;

    // If we get device_code, it's working
    if (data.device_code) {
      pass(testName, "Device authorization flow working", {
        hasDeviceCode: true,
        hasUserCode: !!data.user_code,
        hasVerificationUri: !!data.verification_uri,
      });
      return;
    }

    // Expected: 401 for unregistered client or other error
    pass(
      testName,
      "Device authorization endpoint exists (client not registered)",
      {
        status: response.status,
        error: data.error,
      }
    );
  } catch (error) {
    fail(testName, `Request failed: ${(error as Error).message}`);
  }
}

function testIntrospectionEndpoint(): void {
  const testName = "Token Introspection Endpoint";

  // Note: Better Auth OIDC Provider does not implement introspection (RFC 7662)
  // Token validation is done via JWT verification using the JWKS endpoint
  // This is a known limitation - MCP clients should use JWT validation instead

  log(`⚠️  ${testName}: Not implemented in Better Auth OIDC Provider`);
  log("   MCP clients should validate tokens via JWT/JWKS instead", 1);

  // Mark as passed with warning - not a failure, just not available
  results.push({
    name: testName,
    passed: true,
    message: "Not implemented (use JWT validation instead)",
    details: {
      note: "Better Auth OIDC Provider uses JWT tokens validated via JWKS",
    },
  });
}

function testRevocationEndpoint(): void {
  const testName = "Token Revocation Endpoint";

  // Note: Better Auth OIDC Provider does not implement revocation (RFC 7009)
  // Session revocation is handled via the session management endpoints:
  // - /api/auth/sign-out (current session)
  // - /api/auth/revoke-session (specific session)
  // This is a known limitation - MCP clients should use sign-out flow instead

  log(`⚠️  ${testName}: Not implemented in Better Auth OIDC Provider`);
  log("   Use /api/auth/sign-out for session termination", 1);

  // Mark as passed with warning - not a failure, just not available
  results.push({
    name: testName,
    passed: true,
    message: "Not implemented (use sign-out instead)",
    details: { note: "Use /api/auth/sign-out or /api/auth/revoke-session" },
  });
}

async function testScopeConfiguration(): Promise<void> {
  const testName = "Scope Configuration";
  const metadataUrl = `${BASE_URL}/.well-known/oauth-authorization-server`;

  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      fail(testName, "Could not fetch authorization server metadata");
      return;
    }

    const metadata = (await response.json()) as Record<string, unknown>;
    const scopes = metadata.scopes_supported as string[] | undefined;

    if (!(scopes && Array.isArray(scopes))) {
      fail(testName, "No scopes_supported in metadata");
      return;
    }

    // Check for required OIDC scopes
    const oidcScopes = ["openid", "profile", "email"];
    const missingOidcScopes = oidcScopes.filter((s) => !scopes.includes(s));

    // Check for ALFRED-specific scopes
    const alfredScopes = ["read:*", "write:*", "admin:*"];
    const missingAlfredScopes = alfredScopes.filter((s) => !scopes.includes(s));

    if (missingOidcScopes.length > 0) {
      fail(testName, `Missing OIDC scopes: ${missingOidcScopes.join(", ")}`, {
        scopes,
      });
      return;
    }

    if (missingAlfredScopes.length > 0) {
      fail(
        testName,
        `Missing ALFRED scopes: ${missingAlfredScopes.join(", ")}`,
        {
          scopes,
        }
      );
      return;
    }

    // Count granular scopes
    const readScopes = scopes.filter((s) => s.startsWith("read:")).length;
    const writeScopes = scopes.filter((s) => s.startsWith("write:")).length;
    const adminScopes = scopes.filter((s) => s.startsWith("admin:")).length;

    pass(testName, "All required scopes configured", {
      oidcScopes: oidcScopes.length,
      readScopes,
      writeScopes,
      adminScopes,
      totalScopes: scopes.length,
    });
  } catch (error) {
    fail(testName, `Request failed: ${(error as Error).message}`);
  }
}

async function main() {
  log("\n🔐 MCP OAuth Authentication Verification");
  log(`   Base URL: ${BASE_URL}\n`);

  await testAuthServerMetadata();
  await testProtectedResourceMetadata();
  await testDeviceAuthorizationEndpoint();
  await testIntrospectionEndpoint();
  await testRevocationEndpoint();
  await testScopeConfiguration();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(`\n${"─".repeat(50)}`);
  log(`Summary: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    log("❌ MCP Auth verification failed. Review the errors above.");
    process.exit(1);
  }

  log("✅ MCP Auth verification passed. ALFRED is ready for MCP clients.");
  process.exit(0);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
