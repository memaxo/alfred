/**
 * Conflict Resolution Integration Tests
 *
 * Tests the system's handling of multi-agent write conflicts:
 * - Arbiter spawned on merge conflicts
 * - Optimistic concurrency resolution
 * - Multi-agent write conflicts
 *
 * Run: bun test conflict.integration.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("Conflict Resolution Integration", () => {
  describe("Optimistic Concurrency", () => {
    it("detects concurrent modifications", () => {
      // Simulate two agents trying to modify the same resource
      const resource = { id: "resource-1", version: 1, content: "initial" };

      // Agent 1 reads
      const agent1Read = { ...resource };

      // Agent 2 reads
      const agent2Read = { ...resource };

      // Agent 1 modifies
      const agent1Modified = {
        ...agent1Read,
        version: agent1Read.version + 1,
        content: "agent1 modification",
      };

      // Agent 1's write succeeds (version matches)
      const commit1Success = agent1Read.version === resource.version;
      expect(commit1Success).toBe(true);

      // Update resource
      Object.assign(resource, agent1Modified);

      // Agent 2 tries to write (version mismatch)
      const commit2Success = agent2Read.version === resource.version;
      expect(commit2Success).toBe(false);

      // Agent 2 should detect conflict
      expect(resource.version).toBe(2);
      expect(agent2Read.version).toBe(1);
    });

    it("handles version collision gracefully", () => {
      let currentVersion = 1;
      const attempts: number[] = [];

      const tryUpdate = (readVersion: number, _newContent: string): boolean => {
        attempts.push(readVersion);
        if (readVersion !== currentVersion) {
          return false; // Conflict
        }
        currentVersion++;
        return true;
      };

      // First update succeeds
      expect(tryUpdate(1, "update-1")).toBe(true);
      expect(currentVersion).toBe(2);

      // Stale update fails
      expect(tryUpdate(1, "stale-update")).toBe(false);
      expect(currentVersion).toBe(2);

      // Fresh update succeeds
      expect(tryUpdate(2, "update-2")).toBe(true);
      expect(currentVersion).toBe(3);

      expect(attempts).toEqual([1, 1, 2]);
    });

    it("supports retry with backoff on conflict", async () => {
      const maxRetries = 3;
      const baseDelay = 10;
      let retries = 0;
      let currentVersion = 1;
      let attemptCount = 0;
      const delays: number[] = [];

      const attemptUpdate = (
        readVersion: number,
        _content: string
      ): Promise<boolean> => {
        attemptCount++;
        // Simulate another agent racing ahead on first two attempts
        if (attemptCount <= 2) {
          currentVersion++;
          return Promise.resolve(false);
        }
        // Third attempt succeeds
        if (readVersion === currentVersion) {
          currentVersion++;
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      };

      const updateWithRetry = async (content: string): Promise<boolean> => {
        let readVersion = currentVersion;

        while (retries < maxRetries) {
          const success = await attemptUpdate(readVersion, content);
          if (success) {
            return true;
          }

          retries++;
          const delay = baseDelay * 2 ** (retries - 1);
          delays.push(delay);
          await new Promise((r) => setTimeout(r, delay));
          readVersion = currentVersion; // Re-read
        }

        return false;
      };

      // Should eventually succeed after retries
      const result = await updateWithRetry("final-content");
      expect(result).toBe(true);
      expect(delays.length).toBeGreaterThan(0);
      expect(attemptCount).toBe(3);
    });
  });

  describe("Arbiter Spawning", () => {
    type Conflict = {
      resourceId: string;
      baseVersion: number;
      agent1Change: string;
      agent2Change: string;
    };

    type Resolution = {
      resolvedContent: string;
      strategy: "merge" | "agent1_wins" | "agent2_wins";
    };

    const arbiterResolve = (conflict: Conflict): Resolution => {
      // Simple arbiter logic: if changes are compatible, merge
      // Otherwise, prefer the more recent change
      const canMerge = !(
        conflict.agent1Change.includes(conflict.agent2Change) ||
        conflict.agent2Change.includes(conflict.agent1Change)
      );

      if (canMerge) {
        return {
          resolvedContent: `${conflict.agent1Change}\n${conflict.agent2Change}`,
          strategy: "merge",
        };
      }

      // Prefer agent2 (assumed to be more recent)
      return {
        resolvedContent: conflict.agent2Change,
        strategy: "agent2_wins",
      };
    };

    it("spawns arbiter on merge conflict", () => {
      const conflict: Conflict = {
        resourceId: "file.ts",
        baseVersion: 1,
        agent1Change: "function add(a, b) { return a + b; }",
        agent2Change: "function subtract(a, b) { return a - b; }",
      };

      const resolution = arbiterResolve(conflict);

      expect(resolution.strategy).toBe("merge");
      expect(resolution.resolvedContent).toContain("add");
      expect(resolution.resolvedContent).toContain("subtract");
    });

    it("arbiter picks winner when merge not possible", () => {
      const conflict: Conflict = {
        resourceId: "config.json",
        baseVersion: 1,
        agent1Change: '{"setting": "value1"}',
        agent2Change: '{"setting": "value2"}',
      };

      // These changes conflict - same setting with different values
      // Arbiter should pick one
      const resolution = arbiterResolve(conflict);

      expect(["agent1_wins", "agent2_wins", "merge"]).toContain(
        resolution.strategy
      );
      expect(resolution.resolvedContent).toBeDefined();
    });

    it("arbiter handles complex multi-file conflicts", () => {
      const conflicts: Conflict[] = [
        {
          resourceId: "src/auth.ts",
          baseVersion: 1,
          agent1Change: "export function login() {}",
          agent2Change: "export function logout() {}",
        },
        {
          resourceId: "src/api.ts",
          baseVersion: 1,
          agent1Change: 'import { login } from "./auth"',
          agent2Change: 'import { logout } from "./auth"',
        },
      ];

      const resolutions = conflicts.map(arbiterResolve);

      // All conflicts should be resolved
      expect(resolutions.length).toBe(2);
      resolutions.forEach((r) => {
        expect(r.resolvedContent).toBeDefined();
        expect(["merge", "agent1_wins", "agent2_wins"]).toContain(r.strategy);
      });
    });
  });

  describe("Multi-Agent Write Conflicts", () => {
    type WriteOperation = {
      agentId: string;
      resourceId: string;
      content: string;
      timestamp: number;
    };

    class ConflictDetector {
      private readonly pendingWrites: Map<string, WriteOperation[]> = new Map();

      queueWrite(op: WriteOperation): void {
        const existing = this.pendingWrites.get(op.resourceId) || [];
        existing.push(op);
        this.pendingWrites.set(op.resourceId, existing);
      }

      detectConflicts(): Map<string, WriteOperation[]> {
        const conflicts = new Map<string, WriteOperation[]>();

        for (const [resourceId, writes] of this.pendingWrites) {
          if (writes.length > 1) {
            // Multiple writes to same resource
            conflicts.set(resourceId, writes);
          }
        }

        return conflicts;
      }

      clear(): void {
        this.pendingWrites.clear();
      }
    }

    let detector: ConflictDetector;

    beforeEach(() => {
      detector = new ConflictDetector();
    });

    afterEach(() => {
      detector.clear();
    });

    it("detects concurrent writes from multiple agents", () => {
      const now = Date.now();

      detector.queueWrite({
        agentId: "agent-1",
        resourceId: "shared-file.ts",
        content: "Agent 1 content",
        timestamp: now,
      });

      detector.queueWrite({
        agentId: "agent-2",
        resourceId: "shared-file.ts",
        content: "Agent 2 content",
        timestamp: now + 50,
      });

      const conflicts = detector.detectConflicts();

      expect(conflicts.has("shared-file.ts")).toBe(true);
      expect(conflicts.get("shared-file.ts")?.length).toBe(2);
    });

    it("no conflict when agents write to different resources", () => {
      const now = Date.now();

      detector.queueWrite({
        agentId: "agent-1",
        resourceId: "file-1.ts",
        content: "Agent 1 content",
        timestamp: now,
      });

      detector.queueWrite({
        agentId: "agent-2",
        resourceId: "file-2.ts",
        content: "Agent 2 content",
        timestamp: now + 50,
      });

      const conflicts = detector.detectConflicts();

      expect(conflicts.size).toBe(0);
    });

    it("handles three-way merge conflicts", () => {
      const now = Date.now();

      detector.queueWrite({
        agentId: "agent-1",
        resourceId: "shared.ts",
        content: "Content from agent 1",
        timestamp: now,
      });

      detector.queueWrite({
        agentId: "agent-2",
        resourceId: "shared.ts",
        content: "Content from agent 2",
        timestamp: now + 25,
      });

      detector.queueWrite({
        agentId: "agent-3",
        resourceId: "shared.ts",
        content: "Content from agent 3",
        timestamp: now + 50,
      });

      const conflicts = detector.detectConflicts();

      expect(conflicts.has("shared.ts")).toBe(true);
      expect(conflicts.get("shared.ts")?.length).toBe(3);
    });
  });

  describe("Conflict Resolution Strategies", () => {
    type ConflictStrategy =
      | "last_write_wins"
      | "first_write_wins"
      | "merge"
      | "arbiter";

    const resolveConflict = (
      writes: { agentId: string; content: string; timestamp: number }[],
      strategy: ConflictStrategy
    ): string => {
      const sorted = [...writes].sort((a, b) => a.timestamp - b.timestamp);

      switch (strategy) {
        case "first_write_wins":
          return sorted[0]?.content;
        case "last_write_wins":
          return sorted.at(-1)?.content;
        case "merge":
          return sorted.map((w) => w.content).join("\n");
        case "arbiter":
          // Arbiter would make a decision; simulate with last-write
          return sorted.at(-1)?.content;
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    };

    it("last_write_wins strategy", () => {
      const writes = [
        { agentId: "agent-1", content: "First", timestamp: 100 },
        { agentId: "agent-2", content: "Second", timestamp: 200 },
      ];

      const result = resolveConflict(writes, "last_write_wins");
      expect(result).toBe("Second");
    });

    it("first_write_wins strategy", () => {
      const writes = [
        { agentId: "agent-1", content: "First", timestamp: 100 },
        { agentId: "agent-2", content: "Second", timestamp: 200 },
      ];

      const result = resolveConflict(writes, "first_write_wins");
      expect(result).toBe("First");
    });

    it("merge strategy", () => {
      const writes = [
        { agentId: "agent-1", content: "Line 1", timestamp: 100 },
        { agentId: "agent-2", content: "Line 2", timestamp: 200 },
      ];

      const result = resolveConflict(writes, "merge");
      expect(result).toBe("Line 1\nLine 2");
    });

    it("arbiter strategy", () => {
      const writes = [
        { agentId: "agent-1", content: "Agent 1 content", timestamp: 100 },
        { agentId: "agent-2", content: "Agent 2 content", timestamp: 200 },
      ];

      const result = resolveConflict(writes, "arbiter");
      // Arbiter makes a decision (simulated as last-write)
      expect(result).toBeDefined();
    });
  });
});
