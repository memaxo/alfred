/**
 * Structured logging utility for ALFRED API
 * Based on TanStack Start observability patterns
 */
interface LogContext {
    [key: string]: unknown;
}
export declare const logger: {
    debug: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, context?: LogContext) => void;
};
export {};
//# sourceMappingURL=logger.d.ts.map