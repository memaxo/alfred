import type { UnifiedNodeRef } from "./unified.js";

export interface MappingRecord {
  uiId?: string;
  dbId?: string;
  hgHash?: string;
}

export class GraphIdMapper {
  private readonly ui2db = new Map<string, string>();
  private readonly ui2hash = new Map<string, string>();
  private readonly db2ui = new Map<string, string>();
  private readonly db2hash = new Map<string, string>();
  private readonly hash2ui = new Map<string, string>();
  private readonly hash2db = new Map<string, string>();

  link(record: MappingRecord): void {
    const { uiId, dbId, hgHash } = record;
    if (uiId && dbId) {
      this.ui2db.set(uiId, dbId);
      this.db2ui.set(dbId, uiId);
    }
    if (uiId && hgHash) {
      this.ui2hash.set(uiId, hgHash);
      this.hash2ui.set(hgHash, uiId);
    }
    if (dbId && hgHash) {
      this.db2hash.set(dbId, hgHash);
      this.hash2db.set(hgHash, dbId);
    }
  }

  toDbId(ref: UnifiedNodeRef): string | undefined {
    if (ref.dbId) {
      return ref.dbId;
    }
    if (ref.uiId && this.ui2db.has(ref.uiId)) {
      return this.ui2db.get(ref.uiId);
    }
    if (ref.hgHash && this.hash2db.has(ref.hgHash)) {
      return this.hash2db.get(ref.hgHash);
    }
    return;
  }

  toUiId(ref: UnifiedNodeRef): string | undefined {
    if (ref.uiId) {
      return ref.uiId;
    }
    if (ref.dbId && this.db2ui.has(ref.dbId)) {
      return this.db2ui.get(ref.dbId);
    }
    if (ref.hgHash && this.hash2ui.has(ref.hgHash)) {
      return this.hash2ui.get(ref.hgHash);
    }
    return;
  }

  toHash(ref: UnifiedNodeRef): string | undefined {
    if (ref.hgHash) {
      return ref.hgHash;
    }
    if (ref.dbId && this.db2hash.has(ref.dbId)) {
      return this.db2hash.get(ref.dbId);
    }
    if (ref.uiId && this.ui2hash.has(ref.uiId)) {
      return this.ui2hash.get(ref.uiId);
    }
    return;
  }
}
