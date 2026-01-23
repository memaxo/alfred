/**
 * Error handling utilities for tRPC routers.
 *
 * Provides consistent error patterns for resource access checks.
 */

import { TRPCError } from "@trpc/server";

/**
 * Assert resource exists and belongs to user, throw TRPCError if not.
 *
 * @param resource - The resource to check (must have `userId` property)
 * @param userId - The user ID to verify ownership
 * @param resourceName - Name of the resource type for error messages (e.g., "focus_set")
 * @throws TRPCError with code "NOT_FOUND" if resource doesn't exist
 * @throws TRPCError with code "FORBIDDEN" if resource belongs to different user
 */
export function assertResourceAccess<T extends { userId: string }>(
  resource: T | null,
  userId: string,
  resourceName: string
): asserts resource is T {
  if (!resource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${resourceName}_not_found`,
    });
  }
  if (resource.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${resourceName}_access_denied`,
    });
  }
}
