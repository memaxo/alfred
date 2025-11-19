/**
 * Structured logging utility for ALFRED API
 * Based on TanStack Start observability patterns
 */
function log(level, message, context) {
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
    }
    else {
        // Production: Structured JSON logging
        console.log(JSON.stringify(entry));
    }
}
export const logger = {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
};
