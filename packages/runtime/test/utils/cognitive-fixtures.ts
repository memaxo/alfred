export const resetCognitiveTables = async (): Promise<void> => {
  const { db, cognitiveEvents, cognitiveSnapshots } = await import(
    "@alfred/db"
  );
  await db.delete(cognitiveEvents);
  await db.delete(cognitiveSnapshots);
};
