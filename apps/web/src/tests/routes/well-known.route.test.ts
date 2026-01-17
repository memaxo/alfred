import { describe, expect, it } from "bun:test";
import { Route as AuthzRoute } from "@/routes/[.]well-known/oauth-authorization-server";
import { Route as ResourceRoute } from "@/routes/[.]well-known/oauth-protected-resource";

describe("well-known routes", () => {
  it("are present in routeTree.gen.ts", async () => {
    const text = await Bun.file(
      new URL("../../routeTree.gen.ts", import.meta.url)
    ).text();

    expect(text.includes("'/.well-known/oauth-authorization-server'")).toBe(
      true
    );
    expect(text.includes("'/.well-known/oauth-protected-resource'")).toBe(true);
  });

  it("serves oauth-authorization-server metadata with cache headers", async () => {
    const res = await AuthzRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request(
          "http://localhost/.well-known/oauth-authorization-server"
        ),
      } as any
    );

    expect(res).toBeTruthy();
    expect(res?.status).toBe(200);
    expect(res?.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(res?.headers.get("Content-Type")).toBe("application/json");
  });

  it("serves oauth-protected-resource metadata with cache headers", async () => {
    const res = await ResourceRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        request: new Request(
          "http://localhost/.well-known/oauth-protected-resource"
        ),
      } as any
    );

    expect(res).toBeTruthy();
    expect(res?.status).toBe(200);
    expect(res?.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(res?.headers.get("Content-Type")).toBe("application/json");
  });
});
