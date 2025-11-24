import { expect, test } from "@playwright/test";

test.describe("Cognitive feedback API bridge", () => {
  test("submits normalized feedback from the browser context", async ({
    page,
  }) => {
    await page.goto("about:blank");

    let capturedInput: unknown;
    const endpoint = "http://cognitive.test/api/trpc/cognitive.feedback";

    await page.route("**://cognitive.test/api/trpc/cognitive.feedback*", async (route) => {
      const url = new URL(route.request().url());
      const inputParam = url.searchParams.get("input");
      capturedInput = inputParam ? JSON.parse(inputParam) : null;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                state: {
                  _: "reflecting",
                  outcome: { _: "success", result: null, duration: 0 },
                  expected: "Focus summary",
                  actual: "Focus summary",
                  error: 0,
                  physiology: { energy: 1, boredom: 0, frustration: 0 },
                },
                obligations: [],
              },
            },
          },
        ]),
      });
    });

    const payload = {
      streamId: `playwright-${Date.now()}`,
      expected: "Focus summary",
      actual: "Focus summary",
    };

    const response = await page.evaluate(async ({ body, endpointUrl }) => {
      const input = encodeURIComponent(JSON.stringify({ 0: { json: body } }));
      const res = await fetch(`${endpointUrl}?input=${input}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "[]",
      });
      return res.json();
    }, { body: payload, endpointUrl: endpoint });

    expect(response?.[0]?.result?.data?.state?.error).toBe(0);
    expect(capturedInput).toMatchObject({ 0: { json: payload } });
  });
});
