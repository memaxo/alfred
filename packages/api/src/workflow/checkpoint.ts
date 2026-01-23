import type { CheckpointStorage, PipelineSnapshot } from "@alfred/pipeline";
import { InMemoryCheckpointStorage } from "@alfred/pipeline/observers";
import {
  isSerializable,
  type SerializableValue,
} from "@alfred/pipeline/snapshot";
import type { PipelineSnapshot as TypedPipelineSnapshot } from "@alfred/pipeline";
import { z } from "zod";

let memCheckpointStorage: InMemoryCheckpointStorage | null = null;

export function getTestCheckpointStorage(): InMemoryCheckpointStorage {
  memCheckpointStorage ??= new InMemoryCheckpointStorage();
  return memCheckpointStorage;
}

export class WorkflowCheckpointStorage implements CheckpointStorage {
  private readonly stageNameSchema = z.enum([
    "init",
    "context",
    "plan",
    "schedule",
    "execute",
    "review",
    "learn",
    "summarize",
  ] as const);

  private readonly snapshotSchema = z.object({
    runId: z.string().min(1),
    status: z.enum(["idle", "running", "suspended", "completed", "failed"]),
    requirement: z.string(),
    lastCompletedStage: z
      .enum([
        "init",
        "context",
        "plan",
        "schedule",
        "execute",
        "review",
        "learn",
        "summarize",
      ])
      .nullable(),
    lastCompletedStageIndex: z.number(),
    contextEntries: z.array(z.tuple([z.string(), z.unknown()])).optional(),
    stageResults: z
      .array(
        z.object({
          name: this.stageNameSchema,
          durationMs: z.number(),
          status: z.enum(["success", "failure", "skipped"]),
        })
      )
      .optional(),
    startedAt: z.number(),
    lastEventAt: z.number(),
    lastEventId: z.string().nullable(),
    error: z.string().nullable(),
  });

  constructor(
    private readonly inner: {
      save(runId: string, snapshot: unknown): Promise<void>;
      load(runId: string): Promise<unknown | null>;
      delete?(runId: string): Promise<void>;
    }
  ) {}

  async save(runId: string, snapshot: PipelineSnapshot): Promise<void> {
    await this.inner.save(runId, snapshot);
  }

  async load(runId: string): Promise<TypedPipelineSnapshot | null> {
    const raw = await this.inner.load(runId);
    if (!raw) {
      return null;
    }
    const parsed = this.snapshotSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("checkpoint_snapshot_invalid");
    }
    const contextEntries = parsed.data.contextEntries ?? [];
    const typedEntries: [string, SerializableValue][] = [];
    for (const [key, value] of contextEntries) {
      if (!isSerializable(value)) {
        throw new Error(`checkpoint_snapshot_nonserializable:${key}`);
      }
      typedEntries.push([key, value]);
    }
    return {
      ...(parsed.data as Omit<TypedPipelineSnapshot, "contextEntries" | "stageResults">),
      contextEntries: typedEntries,
      stageResults: parsed.data.stageResults ?? [],
    };
  }

  async delete(runId: string): Promise<void> {
    if (this.inner.delete) {
      await this.inner.delete(runId);
    }
  }
}

