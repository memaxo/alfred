/**
 * Codex error types
 *
 * Centralized error creation for Codex tool execution.
 * All errors include stage, code, and retryability information.
 */

export type CodexErrorStage =
  | "spawn"
  | "timeout"
  | "parse"
  | "runtime"
  | "session";

export type CodexErrorCode =
  | "codex_exec_timeout"
  | "codex_exec_aborted"
  | "codex_exec_failed"
  | "codex_binary_not_found"
  | "codex_invalid_cwd"
  | "codex_container_name_invalid"
  | "codex_container_cwd_invalid"
  | "codex_session_user_required"
  | "codex_session_forbidden"
  | "invalid_output_schema";

const RETRYABLE_STAGES = new Set<CodexErrorStage>(["spawn", "timeout"]);

export class CodexError extends Error {
  readonly code: CodexErrorCode;
  readonly stage: CodexErrorStage;
  readonly isRetryable: boolean;
  readonly detail?: string;

  constructor(stage: CodexErrorStage, code: CodexErrorCode, detail?: string) {
    const message = detail ? `${code}:${detail}` : code;
    super(message);
    this.name = "CodexError";
    this.code = code;
    this.stage = stage;
    this.isRetryable = RETRYABLE_STAGES.has(stage);
    this.detail = detail;
  }

  static spawn(code: CodexErrorCode, detail?: string): CodexError {
    return new CodexError("spawn", code, detail);
  }

  static timeout(detail?: string): CodexError {
    return new CodexError("timeout", "codex_exec_timeout", detail);
  }

  static runtime(detail?: string): CodexError {
    return new CodexError("runtime", "codex_exec_failed", detail);
  }

  static session(code: CodexErrorCode, detail?: string): CodexError {
    return new CodexError("session", code, detail);
  }

  static parse(detail?: string): CodexError {
    return new CodexError("parse", "codex_exec_failed", detail);
  }
}
