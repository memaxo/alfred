/**
 * Tool Result GenUI Auto-Enrichment
 *
 * Automatically enriches tool results with GenUI data-ui parts when the result
 * contains visualizable data. Uses SchemaGenerator to select and generate
 * appropriate UIComponent schemas.
 */

import type { SchemaContext } from "@alfred/type/genui";
import { isGenUIToolResult } from "@alfred/type/genui";
import type { UIMessage } from "@alfred/type/stream";
import type { ToolResultShape } from "./normalize";
import { logger } from "@alfred/logger";
import { randomUUID } from "node:crypto";
import { SchemaGenerator } from "../services/schema";

type MessagePart = UIMessage["parts"][number];

// Tools that should skip GenUI auto-enrichment
// TODO: Replace with proper tool annotation system (genui: "skip")
const SKIP_GENUI_TOOLS = new Set([
  "runtime_status",
  "session_create",
  "router",
  // Add more tools that return non-visualizable data
]);

/**
 * Enrich a tool result with GenUI data-ui part if applicable.
 *
 * @param toolResult - The tool result to enrich
 * @param ctx - Schema context (userId, surface, mode, etc.). If not provided, uses defaults.
 * @returns Array of message parts: [tool-result, data-ui?] or [tool-result] if no GenUI
 */
export async function enrich(
  toolResult: ToolResultShape,
  ctx?: Partial<SchemaContext>
): Promise<MessagePart[]> {
  const startedAt = performance.now();
  const toolName = inferToolName(toolResult);
  const output = getToolOutput(toolResult);

  const recordMetrics = async (outcome: string): Promise<void> => {
    const durationMs = performance.now() - startedAt;
    try {
      const {
        genuiAutoEnrichmentDurationSeconds,
        genuiAutoEnrichmentTotal,
      } = await import("@alfred/metrics/genui");
      genuiAutoEnrichmentTotal.inc({
        outcome,
        tool_name: toolName,
      });
      genuiAutoEnrichmentDurationSeconds.observe(
        { outcome, tool_name: toolName },
        durationMs / 1000
      );
    } catch {
      // Metrics are best-effort.
    }
  };

  // Skip enrichment for tools in opt-out list
  if (SKIP_GENUI_TOOLS.has(toolName)) {
    await recordMetrics("opt_out");
    return [createToolResultPart(toolResult)];
  }

  // Skip if already a GenUIToolResult (tool already provides GenUI)
  if (isGenUIToolResult(output)) {
    await recordMetrics("already_genui");
    return [createToolResultPart(toolResult)];
  }

  // Skip if output is not visualizable (null, undefined, plain string)
  if (output === null || output === undefined) {
    await recordMetrics("no_data");
    return [createToolResultPart(toolResult)];
  }

  if (typeof output === "string" && output.length < 100) {
    // Short strings are likely text responses, not data
    await recordMetrics("text_only");
    return [createToolResultPart(toolResult)];
  }

  // Use SchemaGenerator to create data-ui part
  // Default context: web surface, assistant mode (can be overridden)
  const schemaCtx: SchemaContext = {
    surface: ctx?.surface ?? "web",
    mode: ctx?.mode ?? "assistant",
    userId: ctx?.userId,
    projectId: ctx?.projectId,
    viewport: ctx?.viewport,
    preference: ctx?.preference,
  };

  try {
    const schemaGenerator = new SchemaGenerator({ role: "classify" });
    const dataUiPart = await schemaGenerator.toDataUiPart({
      uiData: output,
      data: output,
      ctx: schemaCtx,
      preferredComponent: null,
    });

    if (dataUiPart) {
      await recordMetrics("success");
      // Ensure data-ui part has required data field
      const dataUiPartWithData: MessagePart = {
        ...dataUiPart,
        data: dataUiPart.data ?? output,
      } as MessagePart;
      // Return both tool-result (for compatibility) and data-ui (for visualization)
      return [
        createToolResultPart(toolResult),
        dataUiPartWithData,
      ];
    }

    await recordMetrics("no_component");
  } catch (error) {
    // If schema generation fails, fall back to tool-result only
    // Log error but don't throw (enrichment is best-effort)
    await recordMetrics("error");
    if (error instanceof Error) {
      logger.warn("genui_enrichment_failed", { error: error.message });
    }
  }

  return [createToolResultPart(toolResult)];
}

function getToolOutput(shape: ToolResultShape): unknown {
  if (shape.result !== undefined) {
    return shape.result;
  }
  if (shape.output !== undefined) {
    return shape.output;
  }
  return undefined;
}

function createToolResultPart(result: ToolResultShape): MessagePart {
  return {
    type: "tool-result",
    toolName: inferToolName(result),
    toolCallId: inferToolCallId(result),
    output: getToolOutput(result),
  } as unknown as MessagePart;
}

function inferToolCallId(data: { toolCallId?: string; id?: string }): string {
  if (typeof data.toolCallId === "string" && data.toolCallId.length > 0) {
    return data.toolCallId;
  }
  if (typeof data.id === "string" && data.id.length > 0) {
    return data.id;
  }
  return randomUUID();
}

function inferToolName(data: { toolName?: string; name?: string }): string {
  if (typeof data.toolName === "string" && data.toolName.length > 0) {
    return data.toolName;
  }
  if (typeof data.name === "string" && data.name.length > 0) {
    return data.name;
  }
  return "tool";
}
