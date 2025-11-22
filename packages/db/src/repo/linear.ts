/**
 * ALFRED Linear Repository
 * Linear OAuth installation management
 */

import { eq } from "drizzle-orm";
import { db } from "../client";
import { linearInstallations } from "../schema/linear";

export type LinearInstallation = typeof linearInstallations.$inferSelect;

export async function upsertLinear(input: {
  oauthClient: string;
  appUser: string;
  space: string;
  token: string;
  refresh?: string | null;
  scope: string;
  expires?: Date | null;
  metadata?: unknown;
}): Promise<LinearInstallation> {
  const {
    oauthClient,
    appUser,
    space,
    token,
    refresh,
    scope,
    expires,
    metadata,
  } = input;
  const now = new Date();

  const [row] = await db
    .insert(linearInstallations)
    .values({
      oauthClient,
      appUser,
      space,
      token,
      refresh: refresh ?? null,
      scope,
      expires: expires ?? null,
      created: now,
      updated: now,
      metadata: metadata ?? null,
    })
    .onConflictDoUpdate({
      target: linearInstallations.space,
      set: {
        oauthClient,
        appUser,
        token,
        refresh: refresh ?? null,
        scope,
        expires: expires ?? null,
        updated: now,
        metadata: metadata ?? null,
      },
    })
    .returning();
  return row!;
}

export async function getLinearByWorkspace(space: string): Promise<LinearInstallation | null> {
  const rows = await db
    .select()
    .from(linearInstallations)
    .where(eq(linearInstallations.space, space))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLinearByOAuth(oauthClient: string): Promise<LinearInstallation | null> {
  const rows = await db
    .select()
    .from(linearInstallations)
    .where(eq(linearInstallations.oauthClient, oauthClient))
    .limit(1);

  return rows[0] ?? null;
}
