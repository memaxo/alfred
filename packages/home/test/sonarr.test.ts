import { Sonarr } from "../src/media/sonarr";

declare const globalThis: typeof globalThis & {
  fetch?: typeof fetch;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe(Sonarr, () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("normalizes baseUrl", async () => {
    globalThis.fetch = ((input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://x/api/v3/system/status");
      return Promise.resolve(jsonResponse(200, { version: "4.0.0" }));
    }) as unknown as typeof fetch;

    const s = new Sonarr({ baseUrl: "http://x/", apiKey: "k" });
    await s.systemStatus();
  });
});
