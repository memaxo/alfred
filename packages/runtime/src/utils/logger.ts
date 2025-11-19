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
    service: process.env.SERVICE_NAME ?? "alfred-runtime",
    environment: process.env.NODE_ENV,
    ...context,
  };

  if (process.env.NODE_ENV === "development") {
    console[level](`[${timestamp}] [${level.toUpperCase()}]`, message, context);
    return;
  }

  console.log(JSON.stringify(entry));
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
