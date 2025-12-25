// packages/plan/src/project/types.ts
export type { NewProject, Project } from "@alfred/db/schema/project";

export type ProjectFramework =
  | "react"
  | "nextjs"
  | "tanstack"
  | "expo"
  | "express"
  | "hono"
  | "fastify"
  | "unknown";

export type PackageManager = "bun" | "npm" | "yarn" | "pnpm";

export type ProjectConfig = {
  framework?: ProjectFramework;
  packageManager?: PackageManager;
  isMonorepo?: boolean;
  hasTypeScript?: boolean;
  [key: string]: unknown;
};
