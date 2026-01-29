/**
 * AgentFS Signals Persistence
 *
 * Stores LLM-judged friction/delight signals and interventions in AgentFS KV.
 * This mirrors the FailureContext/Handoff patterns in agentfs/enrichment.ts.
 */

import {
  type DelightSignal,
  type FrictionSignal,
  type SignalIntervention,
  delightSignalSchema,
  frictionSignalSchema,
  signalInterventionSchema,
} from "@alfred/type";
import { z } from "zod";

import type { AgentFSInterface } from "./types.js";

import { AGENTFS_KV_KEYS, SIGNALS_PREFIX } from "./keys.js";

function isSignalsEnabled(): boolean {
  return process.env.ALFRED_SIGNALS === "1";
}

export interface PersistSignalsInput {
  readonly taskId: string;
  readonly friction: readonly FrictionSignal[];
  readonly delight: readonly DelightSignal[];
  readonly interventions: readonly SignalIntervention[];
  readonly ts: number;
}

const persistedSignalsSchema = z.object({
  taskId: z.string(),
  friction: z.array(frictionSignalSchema),
  delight: z.array(delightSignalSchema),
  interventions: z.array(signalInterventionSchema),
  ts: z.number().int(),
});

export interface PersistedSignals {
  taskId: string;
  friction: FrictionSignal[];
  delight: DelightSignal[];
  interventions: SignalIntervention[];
  ts: number;
}

export async function persistSignals(
  agent: AgentFSInterface,
  input: PersistSignalsInput
): Promise<void> {
  if (!isSignalsEnabled()) {
    return;
  }

  // Validate signals payload strictly (schemas ensure abstract citations only).
  const parsed = persistedSignalsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("agentfs_signals_invalid_payload");
  }

  await agent.kv.set(AGENTFS_KV_KEYS.signals(input.taskId), parsed.data);
}

export async function getSignals(
  agent: AgentFSInterface,
  taskId: string
): Promise<PersistedSignals | undefined> {
  if (!isSignalsEnabled()) {
    return undefined;
  }
  const raw = await agent.kv.get<unknown>(AGENTFS_KV_KEYS.signals(taskId));
  const parsed = persistedSignalsSchema.safeParse(raw);
  return parsed.success ? (parsed.data as PersistedSignals) : undefined;
}

export async function listSignals(
  agent: AgentFSInterface
): Promise<PersistedSignals[]> {
  if (!isSignalsEnabled()) {
    return [];
  }
  const entries = await agent.kv.list(SIGNALS_PREFIX);
  return entries
    .map((e) => {
      const parsed = persistedSignalsSchema.safeParse(e.value);
      return parsed.success ? (parsed.data as PersistedSignals) : null;
    })
    .filter((s): s is PersistedSignals => Boolean(s && s.taskId));
}
