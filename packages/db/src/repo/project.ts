// packages/db/src/repo/project.ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { type NewProject, type Project, projects } from "../schema/project";

/**
 * Find project by user and workspace path
 */
export async function getProjectByWorkspace(
  userId: string,
  workspace: string
): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.workspace, workspace)))
    .limit(1);

  return row ?? null;
}

/**
 * Create a new project
 */
export async function createProject(data: NewProject): Promise<Project> {
  const [row] = await db.insert(projects).values(data).returning();
  if (!row) {
    throw new Error("project_creation_failed");
  }
  return row;
}

/**
 * Update project last active timestamp
 */
export async function updateProjectLastActive(id: string): Promise<void> {
  await db
    .update(projects)
    .set({ lastActiveAt: sql`NOW()` as unknown as Date })
    .where(eq(projects.id, id));
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Update project conventions
 */
export async function updateProjectConventions(
  id: string,
  conventions: unknown[]
): Promise<void> {
  await db
    .update(projects)
    .set({
      conventions,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(projects.id, id));
}

/**
 * Get all projects for a user
 */
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(projects.name);
}

/**
 * Update project
 */
export async function updateProject(
  id: string,
  data: Partial<Omit<Project, "id" | "userId" | "createdAt">>
): Promise<Project> {
  const [row] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(projects.id, id))
    .returning();

  if (!row) {
    throw new Error("project_update_failed");
  }
  return row;
}

/**
 * Update project config
 */
export async function updateProjectConfig(
  id: string,
  config: Record<string, unknown>
): Promise<void> {
  await db
    .update(projects)
    .set({
      config,
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(projects.id, id));
}
