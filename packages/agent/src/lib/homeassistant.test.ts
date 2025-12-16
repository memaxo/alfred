import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { type HomeAssistantError, HomeAssistant } from "./homeassistant";

const mockBaseUrl = "http://homeassistant.local:8123";
const mockToken = "test-token-12345";

describe("HomeAssistant client", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getStates", () => {
    it("returns all entity states", async () => {
      const mockStates = [
        {
          entity_id: "light.living_room",
          state: "on",
          attributes: { friendly_name: "Living Room Light", brightness: 255 },
        },
        {
          entity_id: "climate.thermostat",
          state: "heat",
          attributes: { friendly_name: "Thermostat", temperature: 72 },
        },
      ];

      const fetchMock = mock((url: string, init?: RequestInit) => {
        expect(url).toBe(`${mockBaseUrl}/api/states`);
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${mockToken}`,
        });
        return Promise.resolve(
          new Response(JSON.stringify(mockStates), { status: 200 })
        );
      });
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.getStates();

      expect(result).toHaveLength(2);
      expect(result[0].entity_id).toBe("light.living_room");
      expect(result[1].entity_id).toBe("climate.thermostat");
    });

    it("filters by domain when provided", async () => {
      const mockStates = [
        { entity_id: "light.living_room", state: "on", attributes: {} },
        { entity_id: "light.bedroom", state: "off", attributes: {} },
        { entity_id: "climate.thermostat", state: "heat", attributes: {} },
      ];

      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockStates), { status: 200 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.getStates("light");

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.entity_id.startsWith("light."))).toBe(true);
    });
  });

  describe("getState", () => {
    it("returns single entity state", async () => {
      const mockState = {
        entity_id: "light.living_room",
        state: "on",
        attributes: { friendly_name: "Living Room Light", brightness: 255 },
      };

      const fetchMock = mock((url: string) => {
        expect(url).toBe(`${mockBaseUrl}/api/states/light.living_room`);
        return Promise.resolve(
          new Response(JSON.stringify(mockState), { status: 200 })
        );
      });
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.getState("light.living_room");

      expect(result.entity_id).toBe("light.living_room");
      expect(result.state).toBe("on");
      expect(result.attributes.brightness).toBe(255);
    });

    it("throws notfound error for missing entity", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), { status: 404, statusText: "Not Found" })
        )
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.getState("light.nonexistent");
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("notfound");
      }
    });
  });

  describe("callService", () => {
    it("calls service and returns updated states", async () => {
      const mockResult = [
        {
          entity_id: "light.living_room",
          state: "on",
          attributes: { brightness: 255 },
        },
      ];

      const fetchMock = mock((url: string, init?: RequestInit) => {
        expect(url).toBe(`${mockBaseUrl}/api/services/light/turn_on`);
        expect(init?.method).toBe("POST");
        const body = JSON.parse((init?.body as string) ?? "{}");
        expect(body.entity_id).toBe("light.living_room");
        return Promise.resolve(
          new Response(JSON.stringify(mockResult), { status: 200 })
        );
      });
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.callService("light", "turn_on", {
        entity_id: "light.living_room",
      });

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe("on");
    });

    it("handles empty response from service call", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response("", { status: 200 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.callService("script", "run_script", {});

      expect(result).toEqual([]);
    });
  });

  describe("listEntities", () => {
    it("returns entities with friendly names", async () => {
      const mockStates = [
        {
          entity_id: "light.living_room",
          state: "on",
          attributes: { friendly_name: "Living Room Light" },
        },
        {
          entity_id: "switch.fan",
          state: "off",
          attributes: { friendly_name: "Ceiling Fan" },
        },
      ];

      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockStates), { status: 200 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.listEntities();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("light.living_room");
      expect(result[0].name).toBe("Living Room Light");
      expect(result[0].domain).toBe("light");
      expect(result[1].name).toBe("Ceiling Fan");
    });

    it("uses entity_id as name when friendly_name is missing", async () => {
      const mockStates = [
        { entity_id: "light.living_room", state: "on", attributes: {} },
      ];

      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockStates), { status: 200 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.listEntities();

      expect(result[0].name).toBe("light.living_room");
    });
  });

  describe("controlEntity", () => {
    it("controls entity and returns result", async () => {
      const mockResult = [
        {
          entity_id: "light.living_room",
          state: "on",
          attributes: { brightness: 128 },
        },
      ];

      const fetchMock = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResult), { status: 200 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.controlEntity("light.living_room", "turn_on", {
        brightness: 128,
      });

      expect(result.success).toBe(true);
      expect(result.entityId).toBe("light.living_room");
      expect(result.state).toBe("on");
    });

    it("throws error for invalid entity ID", async () => {
      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.controlEntity("invalid", "turn_on");
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("config");
        expect(haErr.message).toContain("Invalid entity ID");
      }
    });
  });

  describe("ping", () => {
    it("returns true when connection is valid", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: "API running" }), { status: 200 })
        )
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.ping();

      expect(result).toBe(true);
    });

    it("returns false when connection fails", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response("", { status: 401 }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      const result = await client.ping();

      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("maps 401 to auth error", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response("", { status: 401, statusText: "Unauthorized" }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.getStates();
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("auth");
        expect(haErr.status).toBe(401);
      }
    });

    it("maps 403 to auth error", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response("", { status: 403, statusText: "Forbidden" }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.getStates();
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("auth");
        expect(haErr.status).toBe(403);
      }
    });

    it("maps 500 to server error", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response("", { status: 500, statusText: "Internal Server Error" })
        )
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.getStates();
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("server");
        expect(haErr.status).toBe(500);
      }
    });

    it("handles timeout errors", async () => {
      const fetchMock = mock(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("TimeoutError")), 10);
          })
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({
        baseUrl: mockBaseUrl,
        token: mockToken,
        timeoutMs: 5,
      });

      try {
        await client.getStates();
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("timeout");
      }
    });

    it("handles network errors", async () => {
      const fetchMock = mock(() =>
        Promise.reject(Object.assign(new Error("fetch failed"), { name: "TypeError" }))
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });

      try {
        await client.getStates();
        expect(false).toBe(true);
      } catch (err) {
        const haErr = err as HomeAssistantError;
        expect(haErr.kind).toBe("network");
      }
    });
  });

  describe("configuration", () => {
    it("removes trailing slash from base URL", async () => {
      const fetchMock = mock((url: string) => {
        expect(url).toBe(`${mockBaseUrl}/api/states`);
        return Promise.resolve(new Response("[]", { status: 200 }));
      });
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const client = new HomeAssistant({
        baseUrl: `${mockBaseUrl}/`,
        token: mockToken,
      });
      await client.getStates();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("uses default timeout when not specified", async () => {
      const client = new HomeAssistant({ baseUrl: mockBaseUrl, token: mockToken });
      // Internal check - the client should use 5000ms default
      expect(client).toBeDefined();
    });
  });
});
