import type {
  ReasoningEdgeRecord,
  ReasoningNodeRecord,
} from "@alfred/knowledge/query";

import * as workflowRepo from "@alfred/db/repo/workflow";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePolicy } from "../../gate";
import { authedProcedure } from "../../trpc";
import { parseWorkflowInputData } from "../../workflow/input";
import { mapWorkflowRunResourceLocal } from "../../workflow/resource";

export const workflowReasoningProcedure = authedProcedure
  .use(
    requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
  )
  .input(
    z.object({
      runId: z.string().min(1),
      limit: z.number().int().min(1).max(2000).optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const { session } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const run = await workflowRepo.getRun(input.runId);
    if (!run) {
      throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
    }

    if (run.userId !== session.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "access_denied" });
    }

    const inputData = parseWorkflowInputData(run.inputData);
    const resource =
      typeof inputData.cw === "string" && inputData.cw.length > 0
        ? inputData.cw
        : (typeof inputData.workspace === "string" &&
            inputData.workspace.length > 0
          ? inputData.workspace
          : process.cwd());

    const executionId =
      typeof inputData.executionId === "string" &&
      inputData.executionId.length > 0
        ? inputData.executionId
        : run.id;

    const since =
      typeof inputData.reasoningSince === "number"
        ? inputData.reasoningSince
        : (run.created instanceof Date
          ? run.created.getTime()
          : undefined);

    const graphRepoPkg = "@alfred/db/repo/graph";
    const { getReasoningChain } = await import(graphRepoPkg);
    const knowledgeQueryPkg = "@alfred/knowledge/query";
    const { reconstructReasoningChain } = await import(knowledgeQueryPkg);
    const graphSchemaPkg = "@alfred/db/schema/graph";
    const { memoryNodes } = await import(graphSchemaPkg);
    const dbPkg = "@alfred/db";
    const { db } = await import(dbPkg);

    const { limit } = input;
    const initialArgs = {
      resource,
      executionId,
      since,
      limit,
    } as const;

    let { nodes, edges } = await getReasoningChain(initialArgs);

    if (nodes.length === 0 && executionId) {
      ({ nodes, edges } = await getReasoningChain({
        resource,
        since,
        limit,
      }));
    }

    const nodeRecords: ReasoningNodeRecord[] = nodes.map(
      (node: (typeof nodes)[number]) => ({
        id: node.id,
        hash: node.hash,
        label: node.label,
        properties: (node.properties as Record<string, unknown> | null) ?? null,
      })
    );

    const edgeRecords: ReasoningEdgeRecord[] = edges.map(
      (edge: (typeof edges)[number]) => ({
        fromId: edge.fromId,
        toId: edge.toId,
        kind: edge.kind,
        metadata: (edge.metadata as Record<string, unknown> | null) ?? null,
      })
    );

    const chain = reconstructReasoningChain(nodeRecords, edgeRecords);

    const docIds = new Set<string>();
    for (const node of nodes) {
      const props = (node.properties ?? null) as Record<string, unknown> | null;
      const ids = Array.isArray(props?.ragDocumentIds)
        ? (props.ragDocumentIds as unknown[])
        : [];
      for (const raw of ids) {
        if (typeof raw === "string" && raw.length > 0) {
          docIds.add(raw);
        }
      }
    }

    let documents: { documentId: string; label: string }[] = [];
    if (docIds.size > 0) {
      const wanted = [...docIds];
      const documentIdExpr = sql<string>`${memoryNodes.properties} ->> 'documentId'`;

      const rows = await db
        .select({
          label: memoryNodes.label,
          documentId: documentIdExpr,
        })
        .from(memoryNodes)
        .where(
          and(
            eq(memoryNodes.kind, "rag_document"),
            eq(memoryNodes.resource, "user"),
            inArray(documentIdExpr, wanted)
          )
        );

      documents = rows
        .filter(
          (
            row: (typeof rows)[number]
          ): row is { label: string; documentId: string } =>
            typeof row.documentId === "string" && row.documentId.length > 0
        )
        .map((row: { label: string; documentId: string }) => ({
          documentId: row.documentId,
          label: row.label,
        }));
    }

    return {
      runId: run.id,
      resource,
      executionId,
      chain,
      provenance: {
        ragDocuments: documents,
      },
    };
  });
