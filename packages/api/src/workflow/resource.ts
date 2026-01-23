export function mapWorkflowResourceLocal(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof input.projectId === "string" && input.projectId.length > 0
      ? input.projectId
      : "default";
  return { kind: "workflow" as const, id, attrs: { scope: "self" } };
}

export function mapWorkflowRunResourceLocal(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof input.runId === "string" && input.runId.length > 0
      ? input.runId
      : "unknown";
  return { kind: "workflow.run" as const, id, attrs: { scope: "self" } };
}
