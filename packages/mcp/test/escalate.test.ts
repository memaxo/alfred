import { issueMcpSessionToken } from "@alfred/auth/token";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "bun:test";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { RuntimeMcpServer } from "../src";

describe("RuntimeMcpServer (runtime MCP)", () => {
  let server: RuntimeMcpServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("blocking: returns a receipt and invokes abort callback", async () => {
    server = new RuntimeMcpServer({
      bindHost: "127.0.0.1",
      port: 0,
      path: "/mcp",
    });

    const { url } = await server.start();

    if (
      !(
        process.env.AGENT_ED25519_PRIVATE &&
        process.env.AGENT_ED25519_PUBLIC_PEM
      )
    ) {
      const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
        extractable: true,
      });
      process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
      process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
    }

    let abortCalls = 0;
    const token = await issueMcpSessionToken("user-test", ["mcp.escalate"]);
    server.registerSession(
      {
        runId: "run-test",
        agentId: "agent-test",
        abort: () => {
          abortCalls += 1;
        },
      },
      { token }
    );

    const client = new Client({ name: "alfred-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    });

    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain("escalate");

    const res = await client.callTool(
      {
        name: "escalate",
        arguments: {
          reason: "missing_dependency",
          details:
            "Need dependency X installed to proceed. Attempted: checked PATH; confirmed missing.",
          severity: "blocking",
          suggestions: ["Install X", "Provide PATH to X"],
        },
      },
      CallToolResultSchema
    );

    const first = res.content.at(0);
    expect(first?.type).toBe("text");
    expect(typeof first?.text).toBe("string");

    expect(res.structuredContent).toBeTruthy();

    const receipt = JSON.parse(first?.text ?? "") as {
      ok: boolean;
      receiptId: string;
      receivedAt: number;
      action: string;
    };

    expect(receipt.ok).toBe(true);
    expect(receipt.action).toBe("abort");
    expect(typeof receipt.receiptId).toBe("string");
    expect(receipt.receiptId.length).toBeGreaterThan(10);
    expect(typeof receipt.receivedAt).toBe("number");
    expect(abortCalls).toBe(1);

    await client.close();
  });

  it("warning: returns a receipt and does not invoke abort callback", async () => {
    server = new RuntimeMcpServer({
      bindHost: "127.0.0.1",
      port: 0,
      path: "/mcp",
    });

    const { url } = await server.start();

    if (
      !(
        process.env.AGENT_ED25519_PRIVATE &&
        process.env.AGENT_ED25519_PUBLIC_PEM
      )
    ) {
      const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
        extractable: true,
      });
      process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
      process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
    }

    let abortCalls = 0;
    const token = await issueMcpSessionToken("user-test", ["mcp.escalate"]);
    server.registerSession(
      {
        runId: "run-test",
        agentId: "agent-test",
        abort: () => {
          abortCalls += 1;
        },
      },
      { token }
    );

    const client = new Client({ name: "alfred-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    });

    await client.connect(transport);
    const res = await client.callTool(
      {
        name: "escalate",
        arguments: {
          reason: "other",
          details:
            "This is a warning escalation for visibility; no abort should be requested.",
          severity: "warning",
          suggestions: ["Continue and surface this in UI"],
        },
      },
      CallToolResultSchema
    );

    const first = res.content.at(0);
    expect(first?.type).toBe("text");
    expect(typeof first?.text).toBe("string");
    expect(res.structuredContent).toBeTruthy();

    const receipt = JSON.parse(first?.text ?? "") as {
      ok: boolean;
      receiptId: string;
      receivedAt: number;
      action: string;
    };

    expect(receipt.ok).toBe(true);
    expect(receipt.action).toBe("continue");
    expect(typeof receipt.receiptId).toBe("string");
    expect(receipt.receiptId.length).toBeGreaterThan(10);
    expect(typeof receipt.receivedAt).toBe("number");
    expect(abortCalls).toBe(0);

    await client.close();
  });
});
