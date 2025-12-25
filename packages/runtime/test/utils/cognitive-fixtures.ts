export const resetCognitiveTables = async (): Promise<void> => {
  const { db, cognitiveEvents, cognitiveSnapshots } = await import(
    "@alfred/db"
  );
  const { like } = await import("drizzle-orm");
  // Only delete test-owned rows. Full-table deletes make the runtime suite
  // order-dependent under parallel execution.
  const testPrefix = "cognitive-test-%";
  await db
    .delete(cognitiveEvents)
    .where(like(cognitiveEvents.streamId, testPrefix));
  await db
    .delete(cognitiveSnapshots)
    .where(like(cognitiveSnapshots.streamId, testPrefix));
};
