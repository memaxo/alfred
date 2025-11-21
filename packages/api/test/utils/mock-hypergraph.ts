import { mock, vi } from "bun:test";

mock.module("@alfred/agent/assistant/src/hypergraph-bridge", () => ({
  loadHypergraphFromDb: vi.fn().mockResolvedValue(undefined),
  persistHypergraphToDb: vi.fn().mockResolvedValue(undefined),
  startHypergraphSync: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));
