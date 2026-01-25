/**
 * Structured logging utility for ALFRED.
 *
 * Goals:
 * - Safe to import in both browser and server environments.
 * - Single-line JSON in production-like environments, pretty output in development.
 * - Structured context propagation via `child()`.
 * - Best-effort redaction and safe serialization to avoid crashing on edge cases.
 */

import { detectEnvironment, supportsAnsiColor } from "./env";
import { safeJsonStringify } from "./stringify";
import { createConsoleTransport, type LogTransport } from "./transport";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogIds {
  runId?: string;
  workflowId?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
}

export type LogContext = LogIds & Record<string, unknown>;

export interface LoggerConfig {
  service: string;
  level: LogLevel;
  environment?: string;
  transport: LogTransport;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let config: LoggerConfig = {
  service: "alfred",
  level: "info",
  environment: detectEnvironment(),
  transport: createConsoleTransport(),
};

export function configure(newConfig: Partial<LoggerConfig>) {
  const next: LoggerConfig = { ...config };
  if (typeof newConfig.service === "string") {
    next.service = newConfig.service;
  }
  if (typeof newConfig.level === "string") {
    next.level = newConfig.level;
  }
  if (typeof newConfig.environment === "string") {
    next.environment = newConfig.environment;
  }
  if (newConfig.transport) {
    next.transport = newConfig.transport;
  }
  config = next;
}

interface LogParams {
  level: LogLevel;
  message: string;
  context?: LogContext;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[config.level];
}

function isDev(env: string | undefined): boolean {
  return env === "development";
}

function colorFor(level: LogLevel): { open: string; close: string } {
  if (!supportsAnsiColor()) {
    return { open: "", close: "" };
  }
  // ANSI 256 colors: blue/info, yellow/warn, red/error, gray/debug.
  if (level === "info") {
    return { open: "\u001B[38;5;39m", close: "\u001B[0m" };
  }
  if (level === "warn") {
    return { open: "\u001B[38;5;214m", close: "\u001B[0m" };
  }
  if (level === "error") {
    return { open: "\u001B[38;5;196m", close: "\u001B[0m" };
  }
  return { open: "\u001B[38;5;244m", close: "\u001B[0m" };
}

function formatLine({ level, message, context }: LogParams): string {
  const timestamp = new Date().toISOString();
  const environment = config.environment ?? detectEnvironment() ?? "production";

  // JSON for production-like environments.
  if (!isDev(environment)) {
    const ctx = context ?? {};
    return safeJsonStringify({
      ...ctx,
      timestamp,
      level,
      message,
      service: config.service,
      environment,
    });
  }

  // Pretty for development.
  const c = colorFor(level);
  const lvl = `${c.open}${level.toUpperCase()}${c.close}`;
  if (!context || Object.keys(context).length === 0) {
    return `${timestamp} ${lvl} ${message}`;
  }
  return `${timestamp} ${lvl} ${message} ${safeJsonStringify(context)}`;
}

function writeLog(params: LogParams): void {
  if (!shouldLog(params.level)) {
    return;
  }
  const line = formatLine(params);
  config.transport.write(line);
}

interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (context: LogContext) => Logger;
  configure: (newConfig: Partial<LoggerConfig>) => void;
}

function mergeContext(
  base: LogContext,
  next?: LogContext
): LogContext | undefined {
  if (!next || Object.keys(next).length === 0) {
    return base;
  }
  return { ...base, ...next };
}

function createLogger(base: LogContext): Logger {
  return {
    debug(message: string, context?: LogContext) {
      writeLog({
        level: "debug",
        message,
        context: mergeContext(base, context),
      });
    },
    info(message: string, context?: LogContext) {
      writeLog({
        level: "info",
        message,
        context: mergeContext(base, context),
      });
    },
    warn(message: string, context?: LogContext) {
      writeLog({
        level: "warn",
        message,
        context: mergeContext(base, context),
      });
    },
    error(message: string, context?: LogContext) {
      writeLog({
        level: "error",
        message,
        context: mergeContext(base, context),
      });
    },
    child(context: LogContext) {
      return createLogger(mergeContext(base, context) ?? base);
    },
    configure,
  };
}

export const logger: Logger = createLogger({});
export type { Logger, LogTransport };
export { createConsoleTransport, createLokiTransport } from "./transport";
