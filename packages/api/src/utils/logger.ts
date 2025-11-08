/**
 * Structured logging utility for ALFRED API
 * Based on TanStack Start observability patterns
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    service: "alfred-api",
    environment: process.env.NODE_ENV,
    ...context,
  };

  if (process.env.NODE_ENV === "development") {
    console[level](`[${timestamp}] [${level.toUpperCase()}]`, message, context);
  } else {
    // Production: Structured JSON logging
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
  info: (message: string, context?: LogContext) =>
    log("info", message, context),
  warn: (message: string, context?: LogContext) =>
    log("warn", message, context),
  error: (message: string, context?: LogContext) =>
    log("error", message, context),
};
