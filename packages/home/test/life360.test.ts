import { Life360 } from "../src/presence/life360";

declare const globalThis: typeof globalThis & {
  fetch?: typeof fetch;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe(Life360, () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("accepts envelope circles", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse(200, { circles: [{ id: "c1" }] })
      )) as unknown as typeof fetch;

    const c = new Life360({ baseUrl: "http://x", authToken: "t" });
    const circles = await c.listCircles();
    expect(circles).toHaveLength(1);
  });
});
