/**
 * Unified Tool Execution Context
 *
 * Standardizes execute signatures across all orchestrator tools.
 * Follows ALFRED's "pure by default" principle - context enables,
 * not mandates, side effects.
 */

/**
 * Writer interface for streaming tool output.
 * Includes undefined to support optional writer patterns where
 * callers may not provide a writer at all.
 */
export type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

/**
 * Universal execution context for all tools
 * @template TInput The tool's validated input type
 */
export type ToolExecuteContext<TInput> = {
  /** Validated input from tool schema */
  input: TInput;

  /** Optional stream writer for real-time output */
  writer?: ToolWriter;

  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
};

/**
 * Helper type for tools with simpler signatures
 * Equivalent to Pick<ToolExecuteContext<TInput>, 'input'>
 */
export type ToolExecuteArgs<TInput> = {
  input: TInput;
};
