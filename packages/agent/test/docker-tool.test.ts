import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Local schema definition for testing (mirrors the actual schema)
const MIN_TIMEOUT_SEC = 10;
const MAX_TIMEOUT_SEC = 7200;

const dockerInputSchema = z.object({
  action: z.enum([
    "build",
    "run",
    "start",
    "stop",
    "rm",
    "inspect",
    "logs",
    "wait",
    "exec.probe",
    "exec",
  ]),
  cw: z.string().optional(),
  context: z.string().optional(),
  dockerfile: z.string().optional(),
  tag: z.string().optional(),
  name: z.string().optional(),
  containerPort: z.number().int().min(1).max(65_535).optional(),
  hostPort: z.number().int().min(1).max(65_535).optional(),
  env: z.record(z.string(), z.string()).optional(),
  network: z.string().optional(),
  volumes: z.array(z.string()).optional(),
  resources: z
    .object({
      cpus: z.number().min(0.1).max(16).optional(),
      memory: z.string().optional(),
    })
    .optional(),
  authz: z.string().optional(),
  follow: z.boolean().optional(),
  tail: z.number().int().min(0).max(5000).optional(),
  url: z.string().url().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  cmd: z.string().optional(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
});

const dockerOutputSchema = z.object({
  ok: z.boolean(),
  details: z
    .object({
      name: z.string().optional(),
      containerId: z.string().optional(),
      running: z.boolean().optional(),
      containerPort: z.number().optional(),
      hostPort: z.number().nullable().optional(),
      ports: z
        .array(z.object({ host: z.number(), container: z.number() }))
        .optional(),
      exitCode: z.number().optional(),
      text: z.string().optional(),
      error: z.string().optional(),
      truncated: z.boolean().optional(),
      status: z.number().optional(),
      body: z.string().optional(),
    })
    .optional(),
});

describe("docker tool schema validation", () => {
  describe("input schema", () => {
    it("requires action field", () => {
      const result = dockerInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid build action", () => {
      const result = dockerInputSchema.safeParse({
        action: "build",
        context: "./",
        tag: "myapp:latest",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid run action with port mapping", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp:latest",
        name: "myapp-container",
        containerPort: 3000,
        hostPort: 8080,
      });
      expect(result.success).toBe(true);
    });

    it("validates port range - too high", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp:latest",
        name: "test",
        containerPort: 70_000,
      });
      expect(result.success).toBe(false);
    });

    it("validates port range - too low", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp:latest",
        name: "test",
        containerPort: 0,
      });
      expect(result.success).toBe(false);
    });

    it("accepts resource limits", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp:latest",
        name: "test",
        resources: {
          cpus: 2,
          memory: "512m",
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts volume mounts", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp:latest",
        name: "test",
        volumes: ["/host/path:/container/path"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts exec action with command", () => {
      const result = dockerInputSchema.safeParse({
        action: "exec",
        name: "mycontainer",
        cmd: "ls",
        args: ["-la"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts exec.probe action with url", () => {
      const result = dockerInputSchema.safeParse({
        action: "exec.probe",
        url: "http://localhost:3000/health",
      });
      expect(result.success).toBe(true);
    });

    it("accepts start action", () => {
      const result = dockerInputSchema.safeParse({
        action: "start",
        name: "mycontainer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts stop action", () => {
      const result = dockerInputSchema.safeParse({
        action: "stop",
        name: "mycontainer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts rm action", () => {
      const result = dockerInputSchema.safeParse({
        action: "rm",
        name: "mycontainer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts inspect action", () => {
      const result = dockerInputSchema.safeParse({
        action: "inspect",
        name: "mycontainer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts logs action with options", () => {
      const result = dockerInputSchema.safeParse({
        action: "logs",
        name: "mycontainer",
        follow: true,
        tail: 100,
      });
      expect(result.success).toBe(true);
    });

    it("accepts wait action", () => {
      const result = dockerInputSchema.safeParse({
        action: "wait",
        name: "mycontainer",
      });
      expect(result.success).toBe(true);
    });

    it("validates timeout range - too short", () => {
      const result = dockerInputSchema.safeParse({
        action: "build",
        context: "./",
        tag: "test",
        timeoutSec: 5,
      });
      expect(result.success).toBe(false);
    });

    it("validates timeout range - too long", () => {
      const result = dockerInputSchema.safeParse({
        action: "build",
        context: "./",
        tag: "test",
        timeoutSec: 10_000,
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid timeout", () => {
      const result = dockerInputSchema.safeParse({
        action: "build",
        context: "./",
        tag: "test",
        timeoutSec: 300,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid action", () => {
      const result = dockerInputSchema.safeParse({
        action: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional env variables", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp",
        name: "test",
        env: {
          NODE_ENV: "production",
          PORT: "3000",
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional network", () => {
      const result = dockerInputSchema.safeParse({
        action: "run",
        tag: "myapp",
        name: "test",
        network: "my-network",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("output schema", () => {
    it("validates successful output structure", () => {
      const result = dockerOutputSchema.safeParse({
        ok: true,
        details: {
          name: "mycontainer",
          containerId: "abc123",
          running: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it("validates port mapping in output", () => {
      const result = dockerOutputSchema.safeParse({
        ok: true,
        details: {
          ports: [
            { host: 8080, container: 3000 },
            { host: 8081, container: 3001 },
          ],
        },
      });
      expect(result.success).toBe(true);
    });

    it("validates output without details", () => {
      const result = dockerOutputSchema.safeParse({
        ok: true,
      });
      expect(result.success).toBe(true);
    });

    it("requires ok field", () => {
      const result = dockerOutputSchema.safeParse({
        details: {},
      });
      expect(result.success).toBe(false);
    });

    it("validates logs output", () => {
      const result = dockerOutputSchema.safeParse({
        ok: true,
        details: {
          name: "mycontainer",
          exitCode: 0,
          text: "log output here",
          truncated: false,
        },
      });
      expect(result.success).toBe(true);
    });

    it("validates probe output", () => {
      const result = dockerOutputSchema.safeParse({
        ok: true,
        details: {
          status: 200,
          body: '{"status":"healthy"}',
          truncated: false,
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
