/**
 * Structured logging utility for ALFRED
 * Provides consistent JSON logging in production and pretty printing in development.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  [key: string]: unknown;
};

export type LoggerConfig = {
  service: string;
  level?: LogLevel;
};

let config: LoggerConfig = {
  service: "alfred",
  level: "info",
};

/**
 * Configure the global logger instance.
 * Should be called at application startup.
 */
export function configure(newConfig: Partial<LoggerConfig>) {
  config = { ...config, ...newConfig };
}

function formatMessage(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();

  // In production, we want structured JSON
  if (process.env.NODE_ENV !== "development") {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: config.service,
      environment: process.env.NODE_ENV,
      ...context,
    });
  }

  // In development, we want readable output
  return {
    timestamp,
    level,
    message,
    context,
  };
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const formatted = formatMessage(level, message, context);

  if (typeof formatted === "string") {
    // Production: log JSON string
    console.log(formatted);
    return;
  }

  // Development pretty printing
  const { level: lvl, message: msg, context: ctx } = formatted;
  const prefix = `[${lvl.toUpperCase()}] ${msg}`;

  if (ctx && Object.keys(ctx).length > 0) {
    console.log(prefix, ctx);
  } else {
    console.log(prefix);
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
  configure,
};
