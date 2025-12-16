/**
 * TanStack Start global middleware configuration.
 * 
 * This file configures global middleware that runs for all requests
 * (SSR, server routes, server functions) and all server functions.
 * 
 * Middleware provides cross-cutting concerns like:
 * - Request/response logging
 * - Error handling
 * - Metrics collection
 * - Authentication
 */
import { createStart, createMiddleware } from "@tanstack/react-start";
import { logger } from "@alfred/logger";
import { withRequestTestSession } from "@/lib/test-auth";

/**
 * Request middleware for all requests (SSR, server routes, server functions).
 * 
 * This middleware runs before every request handled by Start, including:
 * - Server-side rendering requests
 * - Server route handlers (GET, POST, etc.)
 * - Server function invocations
 * 
 * Use this for cross-cutting concerns that apply to all server requests.
 */
const requestLoggingMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      const response = await withRequestTestSession(request, next);
      const duration = Date.now() - startTime;

      // Response might be a Response object or other type
      const status = response instanceof Response ? response.status : 200;

      logger.debug("request_completed", {
        method: request.method,
        path: url.pathname,
        status,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("request_failed", {
        method: request.method,
        path: url.pathname,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
);

/**
 * Server function middleware for all server functions.
 * 
 * This middleware runs before every server function invocation.
 * It provides logging and error handling specific to server functions.
 * 
 * Use this for cross-cutting concerns that apply only to server functions,
 * such as input validation, authentication, or function-specific logging.
 */
const functionLoggingMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const startTime = Date.now();

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger.debug("server_function_completed", {
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("server_function_failed", {
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
);

/**
 * Create and export the Start instance with global middleware.
 * 
 * This instance is used by TanStack Start to configure global behavior.
 * The middleware defined here will run for all requests and server functions.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware],
  functionMiddleware: [functionLoggingMiddleware],
}));
