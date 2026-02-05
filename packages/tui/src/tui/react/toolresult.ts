const MAX_TOOL_RESULT = 600;

export function truncateToolResult(
  value: string,
  max = MAX_TOOL_RESULT
): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function formatToolResult(params: {
  toolName: string;
  content?: string | null;
  isError?: boolean;
}): string {
  const content = params.content?.trim() ?? "";
  const truncated = content.length > 0 ? truncateToolResult(content) : "";
  const status = params.isError ? "failed" : "completed";
  const icon = params.isError ? "✗" : "✓";
  if (truncated.length === 0) {
    return `\n> ${icon} ${params.toolName} ${status}`;
  }
  return `\n> ${icon} ${params.toolName} ${status}: ${truncated}`;
}
