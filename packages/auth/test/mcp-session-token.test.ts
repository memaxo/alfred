import { describe, expect, it } from "bun:test";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { issueMcpSessionToken, verifyMcpSessionToken } from "../src/token";

describe("MCP session tokens", () => {
  it("can be verified multiple times without replay errors", async () => {
    if (
      !(
        process.env.AGENT_ED25519_PRIVATE &&
        process.env.AGENT_ED25519_PUBLIC_PEM
      )
    ) {
      const { privateKey, publicKey } = await generateKeyPair("EdDSA");
      process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
      process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
    }

    const token = await issueMcpSessionToken("user-test", ["mcp.escalate"]);
    const a = await verifyMcpSessionToken(token, ["mcp.escalate"]);
    const b = await verifyMcpSessionToken(token, ["mcp.escalate"]);

    expect(a.sub).toBe("user-test");
    expect(b.sub).toBe("user-test");
  });
});
