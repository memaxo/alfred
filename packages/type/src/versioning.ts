import { type EventEnvelope } from "./envelope";

/**
 * A migration function transforms an event from version V to V+1.
 */
// oxlint-disable noExplicitAny: Migrations operate on arbitrary shapes
export type EventMigration = (event: any) => any;

/**
 * Registry of event migrations.
 * Key is the source version (V), value is the migration function to V+1.
 */
const migrationRegistry: Record<number, EventMigration> = {
  // Example: 1: (event) => ({ ...event, v: 2, newField: 'default' })
};

/**
 * The current latest event schema version.
 */
export const LATEST_EVENT_VERSION = 1;

/**
 * Migrates an event envelope to the latest version.
 */
// oxlint-disable noExplicitAny: Generic event envelope migration
export function migrateEvent(envelope: EventEnvelope<any>): EventEnvelope<any> {
  let current = envelope;

  while ((current.v ?? 0) < LATEST_EVENT_VERSION) {
    const migrate = migrationRegistry[current.v ?? 0];
    if (!migrate) {
      throw new Error(`No migration found for event version ${current.v ?? 0}`);
    }
    current = migrate(current);
  }

  return current;
}

/**
 * Deserializes a JSON string into a migrated EventEnvelope.
 */
// oxlint-disable noExplicitAny: Generic event envelope deserialization
export function deserializeWithMigration(json: string): EventEnvelope<any> {
  // oxlint-disable noExplicitAny: Generic event envelope deserialization
  const envelope = JSON.parse(json) as EventEnvelope<any>;
  return migrateEvent(envelope);
}
