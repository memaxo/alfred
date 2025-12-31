import { z } from "zod";
import { db } from "./client";

// Inline manifest types to avoid tsconfig rootDir issues
type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type CommandDef = {
  name: string;
  description: string;
  args?: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<void>;
  category?: string;
};

type CliManifest = {
  name: string;
  version: string;
  description: string;
  commands?: CommandDef[];
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
};

// Database management commands
const migrateCommand = {
  name: "migrate",
  description: "Apply pending database migrations",
  args: z.object({
    plan: z
      .boolean()
      .optional()
      .default(false)
      .describe("Plan mode: show pending migrations without applying"),
  }),
  handler: async (args: unknown) => {
    const _parsed = z.object({ plan: z.boolean() }).parse(args);
  },
};

const seedCommand = {
  name: "seed",
  description: "Seed database with sample data",
  args: z.object({
    dataset: z
      .enum(["minimal", "standard", "full"])
      .optional()
      .default("standard")
      .describe("Amount of seed data to generate"),
  }),
  handler: async (args: unknown) => {
    const _parsed = z
      .object({ dataset: z.enum(["minimal", "standard", "full"]) })
      .parse(args);
    // Seed logic would go here
    await new Promise((resolve) => setTimeout(resolve, 1000));
  },
};

const resetCommand = {
  name: "reset",
  description: "Reset database (drop all tables and re-run migrations)",
  args: z.object({
    confirm: z
      .boolean()
      .optional()
      .default(false)
      .describe("Confirmation flag (required)"),
  }),
  handler: async (args: unknown) => {
    const parsed = z.object({ confirm: z.boolean() }).parse(args);
    if (!parsed.confirm) {
      throw new Error("Database reset requires --confirm flag");
    }
    // Reset logic would go here
    await new Promise((resolve) => setTimeout(resolve, 1500));
  },
};

export const manifest: CliManifest = {
  name: "@alfred/db",
  version: "0.1.0",
  description: "Database layer with Drizzle ORM, migrations, and repositories",
  commands: [migrateCommand, seedCommand, resetCommand],
  healthCheck: async () => {
    try {
      const start = performance.now();
      await db.execute("SELECT 1");
      const latency = performance.now() - start;

      return {
        status: "healthy",
        message: `Database connection healthy (${latency.toFixed(2)}ms)`,
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Database connection failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: [],
};
