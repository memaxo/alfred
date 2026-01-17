import type {
  Bundle,
  Capture,
  CaptureEvidence,
  CapturePayloadKind,
  CaptureStatus,
  Receipt,
  ReceiptCorrection,
  ReceiptDecision,
  ReceiptEvidenceItem,
  ReceiptOutcome,
  WorkingSet,
  WorkingSetItem,
} from "@alfred/type/sense";
import {
  bundleSchema,
  captureEvidenceSchema,
  captureSchema,
  receiptSchema,
  workingSetSchema,
} from "@alfred/type/sense.zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  senseBundles,
  senseCaptures,
  senseReceipts,
  senseWorkingsets,
} from "../schema/sense";

export type InboxRow = {
  capture: Capture;
  bundle: Bundle | null;
  receipt: Receipt | null;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function toEvidenceJson(evidence: CaptureEvidence): Record<string, unknown> {
  return {
    ...evidence,
    capturedAt: toIso(evidence.capturedAt),
  };
}

function toCorrectionJson(
  correction: ReceiptCorrection
): Record<string, unknown> {
  return {
    ...correction,
    correctedAt: toIso(correction.correctedAt),
  };
}

function parseEvidence(raw: unknown, fallback: Date): CaptureEvidence {
  const parsed = captureEvidenceSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return { capturedAt: fallback };
}

function parseBundle(raw: unknown): Bundle | null {
  const parsed = bundleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseReceipt(raw: unknown): Receipt | null {
  const parsed = receiptSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseWorkingSet(raw: unknown): WorkingSet | null {
  const parsed = workingSetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function createCapture({
  userId,
  kind,
  status = "new",
  evidence,
  sourceDevice,
}: {
  userId: string;
  kind: CapturePayloadKind;
  status?: CaptureStatus;
  evidence: CaptureEvidence;
  sourceDevice?: string;
}): Promise<Capture> {
  const now = new Date();
  const [row] = await db
    .insert(senseCaptures)
    .values({
      userId,
      kind,
      status,
      sourceDevice: sourceDevice ?? null,
      evidence: toEvidenceJson(evidence),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("sense_capture_create_failed");
  }

  const capture = captureSchema.parse({
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    status: row.status,
    evidence: parseEvidence(row.evidence, row.createdAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return capture;
}

export async function updateCaptureStatus({
  userId,
  id,
  status,
}: {
  userId: string;
  id: string;
  status: CaptureStatus;
}): Promise<number> {
  const rows = await db
    .update(senseCaptures)
    .set({ status, updatedAt: sql`NOW()` as unknown as Date })
    .where(and(eq(senseCaptures.id, id), eq(senseCaptures.userId, userId)))
    .returning({ id: senseCaptures.id });
  return rows.length;
}

export async function createBundle({
  captureId,
  text,
  entities,
  routeCandidates,
}: {
  captureId: string;
  text: string;
  entities?: unknown;
  routeCandidates?: unknown;
}): Promise<Bundle> {
  const now = new Date();
  const [row] = await db
    .insert(senseBundles)
    .values({
      captureId,
      text,
      entities: entities ?? null,
      routeCandidates: routeCandidates ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("sense_bundle_create_failed");
  }

  const bundle = bundleSchema.parse({
    id: row.id,
    captureId: row.captureId,
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return bundle;
}

export async function getCapture({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<Capture | null> {
  const [row] = await db
    .select()
    .from(senseCaptures)
    .where(and(eq(senseCaptures.id, id), eq(senseCaptures.userId, userId)))
    .limit(1);

  if (!row) {
    return null;
  }

  return captureSchema.parse({
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    status: row.status,
    evidence: parseEvidence(row.evidence, row.createdAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function getBundleByCapture({
  userId,
  captureId,
}: {
  userId: string;
  captureId: string;
}): Promise<Bundle | null> {
  const rows = await db
    .select({
      bundle: senseBundles,
      captureUserId: senseCaptures.userId,
      captureId: senseCaptures.id,
    })
    .from(senseBundles)
    .innerJoin(senseCaptures, eq(senseCaptures.id, senseBundles.captureId))
    .where(
      and(
        eq(senseBundles.captureId, captureId),
        eq(senseCaptures.userId, userId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return bundleSchema.parse({
    id: row.bundle.id,
    captureId: row.bundle.captureId,
    text: row.bundle.text,
    createdAt: row.bundle.createdAt,
    updatedAt: row.bundle.updatedAt,
  });
}

export async function upsertReceipt({
  captureId,
  decision,
  summary,
  evidence,
  outcome,
  alternatives,
  confidence,
  corrections,
}: {
  captureId: string;
  decision: ReceiptDecision;
  summary: string;
  evidence: ReceiptEvidenceItem[];
  outcome: ReceiptOutcome;
  alternatives: ReceiptOutcome[];
  confidence: number;
  corrections: ReceiptCorrection[];
}): Promise<Receipt> {
  const now = new Date();
  const [row] = await db
    .insert(senseReceipts)
    .values({
      captureId,
      decision,
      summary,
      evidence,
      outcome,
      alternatives,
      confidence,
      corrections: corrections.map(toCorrectionJson),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: senseReceipts.captureId,
      set: {
        decision,
        summary,
        evidence,
        outcome,
        alternatives,
        confidence,
        corrections: corrections.map(toCorrectionJson),
        updatedAt: sql`NOW()` as unknown as Date,
      },
    })
    .returning();

  if (!row) {
    throw new Error("sense_receipt_upsert_failed");
  }

  const receipt = receiptSchema.parse({
    id: row.id,
    captureId: row.captureId,
    decision: row.decision,
    summary: row.summary,
    evidence: row.evidence,
    outcome: row.outcome,
    alternatives: row.alternatives,
    confidence: row.confidence,
    corrections: row.corrections,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return receipt;
}

export async function getReceiptByCapture({
  userId,
  captureId,
}: {
  userId: string;
  captureId: string;
}): Promise<Receipt | null> {
  const rows = await db
    .select({
      receipt: senseReceipts,
      captureUserId: senseCaptures.userId,
    })
    .from(senseReceipts)
    .innerJoin(senseCaptures, eq(senseCaptures.id, senseReceipts.captureId))
    .where(
      and(
        eq(senseReceipts.captureId, captureId),
        eq(senseCaptures.userId, userId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const receipt = parseReceipt({
    id: row.receipt.id,
    captureId: row.receipt.captureId,
    decision: row.receipt.decision,
    summary: row.receipt.summary,
    evidence: row.receipt.evidence,
    outcome: row.receipt.outcome,
    alternatives: row.receipt.alternatives,
    confidence: row.receipt.confidence,
    corrections: row.receipt.corrections,
    createdAt: row.receipt.createdAt,
    updatedAt: row.receipt.updatedAt,
  });
  return receipt;
}

export async function listInbox({
  userId,
  limit = 50,
  status,
}: {
  userId: string;
  limit?: number;
  status?: CaptureStatus;
}): Promise<InboxRow[]> {
  const conditions = [eq(senseCaptures.userId, userId)];
  if (status) {
    conditions.push(eq(senseCaptures.status, status));
  }

  const rows = await db
    .select({
      capture: senseCaptures,
      bundle: senseBundles,
      receipt: senseReceipts,
    })
    .from(senseCaptures)
    .leftJoin(senseBundles, eq(senseBundles.captureId, senseCaptures.id))
    .leftJoin(senseReceipts, eq(senseReceipts.captureId, senseCaptures.id))
    .where(and(...conditions))
    .orderBy(desc(senseCaptures.createdAt))
    .limit(limit);

  return rows
    .map((row) => {
      const capture = captureSchema.parse({
        id: row.capture.id,
        userId: row.capture.userId,
        kind: row.capture.kind,
        status: row.capture.status,
        evidence: parseEvidence(row.capture.evidence, row.capture.createdAt),
        createdAt: row.capture.createdAt,
        updatedAt: row.capture.updatedAt,
      });

      const bundle = row.bundle
        ? parseBundle({
            id: row.bundle.id,
            captureId: row.bundle.captureId,
            text: row.bundle.text,
            createdAt: row.bundle.createdAt,
            updatedAt: row.bundle.updatedAt,
          })
        : null;

      const receipt = row.receipt
        ? parseReceipt({
            id: row.receipt.id,
            captureId: row.receipt.captureId,
            decision: row.receipt.decision,
            summary: row.receipt.summary,
            evidence: row.receipt.evidence,
            outcome: row.receipt.outcome,
            alternatives: row.receipt.alternatives,
            confidence: row.receipt.confidence,
            corrections: row.receipt.corrections,
            createdAt: row.receipt.createdAt,
            updatedAt: row.receipt.updatedAt,
          })
        : null;

      return { capture, bundle, receipt } satisfies InboxRow;
    })
    .filter((row): row is InboxRow => Boolean(row));
}

export async function getInboxItem({
  userId,
  captureId,
}: {
  userId: string;
  captureId: string;
}): Promise<InboxRow | null> {
  const rows = await db
    .select({
      capture: senseCaptures,
      bundle: senseBundles,
      receipt: senseReceipts,
    })
    .from(senseCaptures)
    .leftJoin(senseBundles, eq(senseBundles.captureId, senseCaptures.id))
    .leftJoin(senseReceipts, eq(senseReceipts.captureId, senseCaptures.id))
    .where(
      and(eq(senseCaptures.userId, userId), eq(senseCaptures.id, captureId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const capture = captureSchema.parse({
    id: row.capture.id,
    userId: row.capture.userId,
    kind: row.capture.kind,
    status: row.capture.status,
    evidence: parseEvidence(row.capture.evidence, row.capture.createdAt),
    createdAt: row.capture.createdAt,
    updatedAt: row.capture.updatedAt,
  });

  const bundle = row.bundle
    ? parseBundle({
        id: row.bundle.id,
        captureId: row.bundle.captureId,
        text: row.bundle.text,
        createdAt: row.bundle.createdAt,
        updatedAt: row.bundle.updatedAt,
      })
    : null;

  const receipt = row.receipt
    ? parseReceipt({
        id: row.receipt.id,
        captureId: row.receipt.captureId,
        decision: row.receipt.decision,
        summary: row.receipt.summary,
        evidence: row.receipt.evidence,
        outcome: row.receipt.outcome,
        alternatives: row.receipt.alternatives,
        confidence: row.receipt.confidence,
        corrections: row.receipt.corrections,
        createdAt: row.receipt.createdAt,
        updatedAt: row.receipt.updatedAt,
      })
    : null;

  return { capture, bundle, receipt };
}

export async function getWorkingSet(userId: string): Promise<WorkingSet> {
  const [row] = await db
    .select()
    .from(senseWorkingsets)
    .where(eq(senseWorkingsets.userId, userId))
    .limit(1);

  const parsed = row
    ? parseWorkingSet({
        userId: row.userId,
        items: row.items,
        focus: row.focus ?? undefined,
        updatedAt: row.updatedAt,
      })
    : null;

  if (parsed) {
    return parsed;
  }

  return workingSetSchema.parse({
    userId,
    items: [],
    updatedAt: new Date(0),
  });
}

export async function setWorkingSet({
  userId,
  items,
  focus,
}: {
  userId: string;
  items: WorkingSetItem[];
  focus?: WorkingSetItem;
}): Promise<WorkingSet> {
  const now = new Date();
  const payload = workingSetSchema.parse({
    userId,
    items,
    focus,
    updatedAt: now,
  });

  const [row] = await db
    .insert(senseWorkingsets)
    .values({
      userId,
      items: payload.items,
      focus: payload.focus ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: senseWorkingsets.userId,
      set: {
        items: payload.items,
        focus: payload.focus ?? null,
        updatedAt: sql`NOW()` as unknown as Date,
      },
    })
    .returning();

  if (!row) {
    throw new Error("sense_workingset_upsert_failed");
  }

  const parsed = parseWorkingSet({
    userId: row.userId,
    items: row.items,
    focus: row.focus ?? undefined,
    updatedAt: row.updatedAt,
  });

  if (!parsed) {
    throw new Error("sense_workingset_parse_failed");
  }

  return parsed;
}
