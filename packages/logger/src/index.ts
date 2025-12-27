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
  environment?: string;
};

let config: LoggerConfig = {
  service: "alfred",
  level: "info",
  environment: process.env.NODE_ENV,
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
  const environment = config.environment ?? process.env.NODE_ENV;

  // In production, we want structured JSON
  if (environment !== "development") {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: config.service,
      environment,
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
    return;
  }

  // Development pretty printing
  // TODO: Implement pretty printing
  // Currently, development mode just returns early (no output)
  // The formatted object contains: { timestamp, level, message, context }
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
