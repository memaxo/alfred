import { mock, vi } from "bun:test";

mock.module("@alfred/agent/assistant/src/hypergraph-bridge", () => ({
  loadHypergraphFromDb: vi.fn().mockResolvedValue(),
  persistHypergraphToDb: vi.fn().mockResolvedValue(),
  startHypergraphSync: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

mock.module("@alfred/agent/assistant/src/graphstore", () => ({
  linkRagProvenanceToReasoning: vi.fn().mockResolvedValue(),
}));
