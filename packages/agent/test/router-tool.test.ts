import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock policy enforcement
const mockRequireToolScopesAndPolicy = mock(() =>
  Promise.resolve({ claims: {}, decision: { obligations: [] } })
);

mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: mockRequireToolScopesAndPolicy,
}));

// Mock fetch for Caddy API
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

import { toolRouter } from "../src/orchestrator/tool/router";

describe("router tool", () => {
  beforeEach(() => {
    mockRequireToolScopesAndPolicy.mockClear();
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    );
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("input schema validation", () => {
    it("requires action and host", () => {
      const result = toolRouter.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid register action", () => {
      const result = toolRouter.inputSchema.safeParse({
        action: "register",
        host: "app.example.com",
        upstream: "http://localhost:3000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid update action", () => {
      const result = toolRouter.inputSchema.safeParse({
        action: "update",
        host: "app.example.com",
        upstream: "http://localhost:4000",
        tls: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid remove action without upstream", () => {
      const result = toolRouter.inputSchema.safeParse({
        action: "remove",
        host: "app.example.com",
      });
      expect(result.success).toBe(true);
    });

    it("validates upstream is a URL", () => {
      const result = toolRouter.inputSchema.safeParse({
        action: "register",
        host: "app.example.com",
        upstream: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("requires non-empty host", () => {
      const result = toolRouter.inputSchema.safeParse({
        action: "register",
        host: "",
        upstream: "http://localhost:3000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("execute", () => {
    describe("register action", () => {
      it("registers route with Caddy", async () => {
        const result = await toolRouter.execute({
          input: {
            action: "register",
            host: "app.example.com",
            upstream: "http://localhost:3000",
          },
        });

        expect(result.ok).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, options] = mockFetch.mock.calls[0];
        expect(url.toString()).toContain(
          "/config/apps/http/servers/srv0/routes/"
        );
        expect(url.toString()).toContain("alfred-route-app.example.com");
        expect(options.method).toBe("PUT");
        expect(options.headers["content-type"]).toBe("application/json");

        const body = JSON.parse(options.body);
        expect(body["@id"]).toBe("alfred-route-app.example.com");
        expect(body.match[0].host).toEqual(["app.example.com"]);
        expect(body.handle[0].handler).toBe("reverse_proxy");
        expect(body.handle[0].upstreams[0].dial).toBe("localhost:3000");
      });

      it("requires upstream for register", async () => {
        await expect(
          toolRouter.execute({
            input: {
              action: "register",
              host: "app.example.com",
            },
          })
        ).rejects.toThrow("router_upstream_required");
      });

      it("handles upstream without port", async () => {
        await toolRouter.execute({
          input: {
            action: "register",
            host: "app.example.com",
            upstream: "http://backend",
          },
        });

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.handle[0].upstreams[0].dial).toBe("backend");
      });

      it("sanitizes host for route ID", async () => {
        await toolRouter.execute({
          input: {
            action: "register",
            host: "app_test!special@chars.com",
            upstream: "http://localhost:3000",
          },
        });

        const [url] = mockFetch.mock.calls[0];
        expect(url.toString()).toContain(
          "alfred-route-app-test-special-chars.com"
        );
      });
    });

    describe("update action", () => {
      it("updates existing route", async () => {
        const result = await toolRouter.execute({
          input: {
            action: "update",
            host: "app.example.com",
            upstream: "http://localhost:4000",
          },
        });

        expect(result.ok).toBe(true);
        const [, options] = mockFetch.mock.calls[0];
        expect(options.method).toBe("PUT");

        const body = JSON.parse(options.body);
        expect(body.handle[0].upstreams[0].dial).toBe("localhost:4000");
      });

      it("requires upstream for update", async () => {
        await expect(
          toolRouter.execute({
            input: {
              action: "update",
              host: "app.example.com",
            },
          })
        ).rejects.toThrow("router_upstream_required");
      });
    });

    describe("remove action", () => {
      it("removes route from Caddy", async () => {
        const result = await toolRouter.execute({
          input: {
            action: "remove",
            host: "app.example.com",
          },
        });

        expect(result.ok).toBe(true);
        const [url, options] = mockFetch.mock.calls[0];
        expect(options.method).toBe("DELETE");
        expect(url.toString()).toContain("alfred-route-app.example.com");
      });

      it("ignores 404 on remove", async () => {
        mockFetch.mockImplementationOnce(() =>
          Promise.resolve(new Response("not found", { status: 404 }))
        );

        const result = await toolRouter.execute({
          input: {
            action: "remove",
            host: "nonexistent.example.com",
          },
        });

        expect(result.ok).toBe(true);
      });

      it("does not require upstream for remove", async () => {
        const result = await toolRouter.execute({
          input: {
            action: "remove",
            host: "app.example.com",
          },
        });

        expect(result.ok).toBe(true);
      });
    });

    describe("policy enforcement", () => {
      it("enforces deploy.write scope", async () => {
        await toolRouter.execute({
          input: {
            action: "register",
            host: "app.example.com",
            upstream: "http://localhost:3000",
          },
        });

        expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
          undefined,
          ["deploy.write"],
          expect.objectContaining({
            action: "router.register",
            resource: {
              kind: "route",
              id: "app.example.com",
            },
          })
        );
      });

      it("includes authz token when provided", async () => {
        await toolRouter.execute({
          input: {
            action: "register",
            host: "app.example.com",
            upstream: "http://localhost:3000",
            authz: "token-123",
          },
        });

        expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
          "token-123",
          ["deploy.write"],
          expect.any(Object)
        );
      });
    });

    describe("error handling", () => {
      it("throws on Caddy API error", async () => {
        mockFetch.mockImplementationOnce(() =>
          Promise.resolve(new Response("internal error", { status: 500 }))
        );

        await expect(
          toolRouter.execute({
            input: {
              action: "register",
              host: "app.example.com",
              upstream: "http://localhost:3000",
            },
          })
        ).rejects.toThrow("router_caddy_error:500");
      });

      it("throws on unsupported action", async () => {
        await expect(
          toolRouter.execute({
            input: {
              action: "unsupported" as any,
              host: "app.example.com",
            },
          })
        ).rejects.toThrow("router_action_not_supported");
      });
    });
  });

  describe("output schema", () => {
    it("validates successful output", () => {
      const result = toolRouter.outputSchema.safeParse({ ok: true });
      expect(result.success).toBe(true);
    });

    it("requires ok field", () => {
      const result = toolRouter.outputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
