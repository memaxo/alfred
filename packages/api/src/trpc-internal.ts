/**
 * Re-export tRPC internal types for declaration file compatibility.
 *
 * When TypeScript generates .d.ts files with `composite: true`, it needs
 * to reference tRPC's internal types. This re-export ensures the types
 * are accessible through proper package exports.
 *
 * @see https://github.com/trpc/trpc/issues/4965
 */
export * from "@trpc/server/unstable-core-do-not-import";
