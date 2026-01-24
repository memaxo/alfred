// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Install shared mocks
installAuthTokenMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

// Save original env
const originalEnv = { ...process.env };

// Mock the metrics
mock.module("../src/metrics", () => ({
  recordAssistantToolCall: mock(),
}));

// Mock Home Assistant client
const mockGetStates = mock();
const mockGetState = mock();
const mockListEntities = mock();
const mockControlEntity = mock();
const mockCreateHomeAssistantClient = mock();

mock.module("../src/lib/homeassistant", () => ({
  createHomeAssistantClient: mockCreateHomeAssistantClient,
  HomeAssistant: class MockHomeAssistant {
    getStates = mockGetStates;
    getState = mockGetState;
    listEntities = mockListEntities;
    controlEntity = mockControlEntity;
  },
}));

// Import tool after mocking
const { toolHome } = await import("../assistant/src/tool/home");

describe("Home Tool", () => {
  beforeEach(() => {
    // Reset all mocks
    resetAuthTokenMocks();
    mockGetStates.mockReset();
    mockGetState.mockReset();
    mockListEntities.mockReset();
    mockControlEntity.mockReset();
    mockCreateHomeAssistantClient.mockReset();

    // Default policy check pass
    mockRequireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["home.read", "home.write"],
        elevated: true,
        mfa: "passkey",
      },
    });

    // Set up mock client factory
    mockCreateHomeAssistantClient.mockReturnValue({
      getStates: mockGetStates,
      getState: mockGetState,
      listEntities: mockListEntities,
      controlEntity: mockControlEntity,
    });

    // Configure environment
    process.env.HOME_PROVIDER = "homeassistant";
    process.env.HOME_BASE_URL = "http://homeassistant.local:8123";
    process.env.HOME_TOKEN = "test-token";
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("tool metadata", () => {
    it("has correct name and description", () => {
      expect(toolHome.name).toBe("home");
      expect(toolHome.description).toContain("home automation");
    });
  });

  describe("status action", () => {
    it("returns single entity status when entity is specified", async () => {
      mockGetState.mockResolvedValue({
        entity_id: "light.living_room",
        state: "on",
        attributes: { friendly_name: "Living Room", brightness: 255 },
      });

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "status",
          entity: "light.living_room",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        action: "status",
        entities: [
          {
            id: "light.living_room",
            name: "Living Room",
            state: "on",
          },
        ],
      });
      expect(mockGetState).toHaveBeenCalledWith("light.living_room");
    });

    it("returns all entities when no entity specified", async () => {
      mockListEntities.mockResolvedValue([
        {
          id: "light.living_room",
          name: "Living Room",
          domain: "light",
          state: "on",
          attributes: {},
        },
        {
          id: "climate.thermostat",
          name: "Thermostat",
          domain: "climate",
          state: "heat",
          attributes: {},
        },
      ]);

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "status",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        action: "status",
      });
      expect((result as { entities: unknown[] }).entities).toHaveLength(2);
    });

    it("filters by domain when specified", async () => {
      mockListEntities.mockResolvedValue([
        {
          id: "light.living_room",
          name: "Living Room",
          domain: "light",
          state: "on",
          attributes: {},
        },
      ]);

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "status",
          domain: "light",
          authz: "Bearer token",
        },
      });

      expect(mockListEntities).toHaveBeenCalledWith("light");
      expect((result as { entities: unknown[] }).entities).toHaveLength(1);
    });

    it("enforces home.read policy", async () => {
      mockListEntities.mockResolvedValue([]);

      await toolHome.execute({
        input: {
          userId: "user-123",
          action: "status",
          authz: "Bearer token",
        },
      });

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["home.read"],
        expect.objectContaining({
          action: "home.read",
          resource: { kind: "home", id: "all" },
        })
      );
    });
  });

  describe("control action", () => {
    it("controls entity with service call", async () => {
      mockControlEntity.mockResolvedValue({
        success: true,
        entityId: "light.living_room",
        state: "on",
      });

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "control",
          entity: "light.living_room",
          service: "turn_on",
          data: { brightness: 128 },
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        action: "control",
        success: true,
        entityId: "light.living_room",
        state: "on",
      });
      expect(mockControlEntity).toHaveBeenCalledWith(
        "light.living_room",
        "turn_on",
        { brightness: 128 }
      );
    });

    it("returns error when entity is missing", async () => {
      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "control",
          service: "turn_on",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_entity_required",
      });
    });

    it("returns error when service is missing", async () => {
      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "control",
          entity: "light.living_room",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_service_required",
      });
    });

    it("enforces home.write policy for control", async () => {
      mockControlEntity.mockResolvedValue({
        success: true,
        entityId: "light.living_room",
        state: "on",
      });

      await toolHome.execute({
        input: {
          userId: "user-123",
          action: "control",
          entity: "light.living_room",
          service: "turn_on",
          authz: "Bearer token",
        },
      });

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["home.write"],
        expect.objectContaining({
          action: "home.control",
          resource: { kind: "home", id: "light.living_room" },
        })
      );
    });
  });

  describe("list action", () => {
    it("returns list of entities", async () => {
      mockListEntities.mockResolvedValue([
        {
          id: "light.living_room",
          name: "Living Room",
          domain: "light",
          state: "on",
          attributes: {},
        },
        {
          id: "switch.fan",
          name: "Ceiling Fan",
          domain: "switch",
          state: "off",
          attributes: {},
        },
      ]);

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        action: "list",
        entities: [
          { id: "light.living_room", name: "Living Room", domain: "light" },
          { id: "switch.fan", name: "Ceiling Fan", domain: "switch" },
        ],
      });
    });

    it("filters by domain when specified", async () => {
      mockListEntities.mockResolvedValue([
        {
          id: "light.living_room",
          name: "Living Room",
          domain: "light",
          state: "on",
          attributes: {},
        },
      ]);

      await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          domain: "light",
          authz: "Bearer token",
        },
      });

      expect(mockListEntities).toHaveBeenCalledWith("light");
    });
  });

  describe("provider configuration", () => {
    it("returns error when provider not configured", async () => {
      process.env.HOME_PROVIDER = "fake";

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_not_configured",
      });
    });

    it("returns error when HOME_PROVIDER is not set", async () => {
      process.env.HOME_PROVIDER = undefined;

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_not_configured",
      });
    });

    it("returns error when HOME_BASE_URL is missing", async () => {
      process.env.HOME_PROVIDER = "homeassistant";
      process.env.HOME_BASE_URL = undefined;

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_not_configured",
      });
    });

    it("returns error when HOME_TOKEN is missing", async () => {
      process.env.HOME_PROVIDER = "homeassistant";
      process.env.HOME_TOKEN = undefined;

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_not_configured",
      });
    });
  });

  describe("error handling", () => {
    it("handles Home Assistant errors gracefully", async () => {
      mockListEntities.mockRejectedValue({
        kind: "auth",
        status: 401,
        message: "Unauthorized",
        endpoint: "/api/states",
      });

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_auth",
        message: "Unauthorized",
      });
    });

    it("handles network errors gracefully", async () => {
      mockListEntities.mockRejectedValue({
        kind: "network",
        message: "Connection refused",
        endpoint: "/api/states",
      });

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_network",
        message: "Connection refused",
      });
    });

    it("handles timeout errors gracefully", async () => {
      mockListEntities.mockRejectedValue({
        kind: "timeout",
        message: "Request timeout",
        endpoint: "/api/states",
      });

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_timeout",
        message: "Request timeout",
      });
    });

    it("handles generic errors", async () => {
      mockListEntities.mockRejectedValue(new Error("Something went wrong"));

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_error",
        message: "Something went wrong",
      });
    });

    it("handles policy check failures", async () => {
      mockRequireToolScopesAndPolicy.mockRejectedValue(
        new Error("Policy check failed")
      );

      const result = await toolHome.execute({
        input: {
          userId: "user-123",
          action: "list",
          authz: "Bearer token",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        code: "home_error",
        message: "Policy check failed",
      });
    });
  });

  describe("input validation", () => {
    it("validates action enum", () => {
      const validResult = toolHome.inputSchema.safeParse({
        userId: "user-123",
        action: "status",
      });
      expect(validResult.success).toBe(true);

      const invalidResult = toolHome.inputSchema.safeParse({
        userId: "user-123",
        action: "invalid",
      });
      expect(invalidResult.success).toBe(false);
    });

    it("requires userId", () => {
      const result = toolHome.inputSchema.safeParse({
        action: "list",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional fields", () => {
      const result = toolHome.inputSchema.safeParse({
        userId: "user-123",
        action: "control",
        entity: "light.living_room",
        service: "turn_on",
        data: { brightness: 128 },
        domain: "light",
        authz: "Bearer token",
      });
      expect(result.success).toBe(true);
    });
  });
});
