import { and, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { projectContainers } from "../schema/container";

export type ProjectContainerInsert = typeof projectContainers.$inferInsert;
export type ProjectContainerRow = typeof projectContainers.$inferSelect;

export async function upsertProjectContainer(input: {
  projectId: string;
  kind: string;
  name: string;
  containerId?: string | null;
  status?: string;
  metadata?: unknown;
}): Promise<ProjectContainerRow> {
  const values: ProjectContainerInsert = {
    projectId: input.projectId,
    kind: input.kind,
    name: input.name,
    containerId: input.containerId ?? null,
    status: input.status ?? "active",
    metadata: input.metadata ?? null,
    updatedAt: sql`NOW()` as unknown as Date,
    lastUsedAt: sql`NOW()` as unknown as Date,
  };

  const [row] = await db
    .insert(projectContainers)
    .values(values)
    .onConflictDoUpdate({
      target: [
        projectContainers.projectId,
        projectContainers.kind,
        projectContainers.name,
      ],
      set: {
        containerId: sql`excluded.container_id`,
        status: sql`excluded.status`,
        metadata: sql`excluded.metadata`,
        updatedAt: sql`NOW()`,
        lastUsedAt: sql`NOW()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("project_container_upsert_failed");
  }

  return row;
}

export async function touchProjectContainer(args: {
  projectId: string;
  kind: string;
  name: string;
}): Promise<number> {
  const rows = await db
    .update(projectContainers)
    .set({
      lastUsedAt: sql`NOW()` as unknown as Date,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(
      and(
        eq(projectContainers.projectId, args.projectId),
        eq(projectContainers.kind, args.kind),
        eq(projectContainers.name, args.name)
      )
    )
    .returning({ id: projectContainers.id });

  return rows.length;
}
