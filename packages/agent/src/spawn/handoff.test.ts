import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { WaveHandoff, createWaveHandoff, type WaveAgentResult } from "./handoff.js";

describe("WaveHandoff", () => {
  let testDir: string;
  let targetDir: string;
  let handoff: WaveHandoff;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), "poof-handoff-test-"));
    targetDir = path.join(testDir, "target");
    mkdirSync(targetDir, { recursive: true });
    handoff = createWaveHandoff(targetDir);
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("recordWave", () => {
    test("records wave state", () => {
      const agents: WaveAgentResult[] = [
        {
          agentId: "agent1",
          upperDir: "/tmp/upper1",
          exitCode: 0,
          timedOut: false,
          durationMs: 1000,
        },
      ];

      handoff.recordWave("wave_0", agents, 1000, 2000);

      const wave = handoff.getWave("wave_0");
      expect(wave).toBeDefined();
      expect(wave?.waveId).toBe("wave_0");
      expect(wave?.startTime).toBe(1000);
      expect(wave?.endTime).toBe(2000);
      expect(wave?.agents.get("agent1")).toBeDefined();
    });

    test("records multiple waves", () => {
      handoff.recordWave("wave_0", [], 1000, 2000);
      handoff.recordWave("wave_1", [], 2000, 3000);

      const waves = handoff.getWaves();
      expect(waves.length).toBe(2);
    });
  });

  describe("getAllUpperDirs", () => {
    test("returns all upper directories", () => {
      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir: "/tmp/upper1",
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
          {
            agentId: "agent2",
            upperDir: null, // ephemeral mode
            exitCode: 0,
            timedOut: false,
            durationMs: 500,
          },
        ],
        1000,
        2000
      );

      const upperDirs = handoff.getAllUpperDirs();
      expect(upperDirs.size).toBe(1);
      expect(upperDirs.get("agent1")).toBe("/tmp/upper1");
    });
  });

  describe("getAgentChanges", () => {
    test("returns changes for agent with upper dir", async () => {
      // Create upper directory structure
      const upperDir = path.join(testDir, "upper1");
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "file.txt"), "content");

      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
        ],
        1000,
        2000
      );

      const changes = await handoff.getAgentChanges("agent1");
      expect(changes.length).toBe(1);
      expect(changes[0].path).toBe("file.txt");
    });

    test("returns empty array for unknown agent", async () => {
      const changes = await handoff.getAgentChanges("unknown");
      expect(changes).toEqual([]);
    });
  });

  describe("getWaveChanges", () => {
    test("returns changes for all agents in wave", async () => {
      const upperDir1 = path.join(testDir, "upper1");
      const upperDir2 = path.join(testDir, "upper2");

      // Agent 1 changes
      const changes1 = path.join(upperDir1, targetDir);
      mkdirSync(changes1, { recursive: true });
      writeFileSync(path.join(changes1, "file1.txt"), "content1");

      // Agent 2 changes
      const changes2 = path.join(upperDir2, targetDir);
      mkdirSync(changes2, { recursive: true });
      writeFileSync(path.join(changes2, "file2.txt"), "content2");

      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir: upperDir1,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
          {
            agentId: "agent2",
            upperDir: upperDir2,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
        ],
        1000,
        2000
      );

      const waveChanges = await handoff.getWaveChanges("wave_0");
      expect(waveChanges.size).toBe(2);
      expect(waveChanges.get("agent1")?.length).toBe(1);
      expect(waveChanges.get("agent2")?.length).toBe(1);
    });

    test("returns empty map for unknown wave", async () => {
      const changes = await handoff.getWaveChanges("unknown");
      expect(changes.size).toBe(0);
    });
  });

  describe("detectConflicts", () => {
    test("detects files modified by multiple agents", async () => {
      const upperDir1 = path.join(testDir, "upper1");
      const upperDir2 = path.join(testDir, "upper2");

      // Both agents modify the same file
      const changes1 = path.join(upperDir1, targetDir);
      mkdirSync(changes1, { recursive: true });
      writeFileSync(path.join(changes1, "shared.txt"), "content1");

      const changes2 = path.join(upperDir2, targetDir);
      mkdirSync(changes2, { recursive: true });
      writeFileSync(path.join(changes2, "shared.txt"), "content2");

      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir: upperDir1,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
          {
            agentId: "agent2",
            upperDir: upperDir2,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
        ],
        1000,
        2000
      );

      const conflicts = await handoff.detectConflicts();
      expect(conflicts.size).toBe(1);
      expect(conflicts.get("shared.txt")).toEqual(["agent1", "agent2"]);
    });

    test("returns empty map when no conflicts", async () => {
      const upperDir1 = path.join(testDir, "upper1");
      const upperDir2 = path.join(testDir, "upper2");

      // Each agent modifies different files
      const changes1 = path.join(upperDir1, targetDir);
      mkdirSync(changes1, { recursive: true });
      writeFileSync(path.join(changes1, "file1.txt"), "content1");

      const changes2 = path.join(upperDir2, targetDir);
      mkdirSync(changes2, { recursive: true });
      writeFileSync(path.join(changes2, "file2.txt"), "content2");

      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir: upperDir1,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
          {
            agentId: "agent2",
            upperDir: upperDir2,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
        ],
        1000,
        2000
      );

      const conflicts = await handoff.detectConflicts();
      expect(conflicts.size).toBe(0);
    });
  });

  describe("generateSynthesisReport", () => {
    test("generates report with wave and agent info", async () => {
      const upperDir = path.join(testDir, "upper1");
      const changesPath = path.join(upperDir, targetDir);
      mkdirSync(changesPath, { recursive: true });
      writeFileSync(path.join(changesPath, "file.txt"), "content");

      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir,
            exitCode: 0,
            timedOut: false,
            durationMs: 1000,
          },
        ],
        1000,
        2000
      );

      const report = await handoff.generateSynthesisReport();
      expect(report).toContain("# Wave Changes Report");
      expect(report).toContain("wave_0");
      expect(report).toContain("agent1");
      expect(report).toContain("Exit code: 0");
      expect(report).toContain("+ file.txt");
    });

    test("marks timed out agents", async () => {
      handoff.recordWave(
        "wave_0",
        [
          {
            agentId: "agent1",
            upperDir: null,
            exitCode: 124,
            timedOut: true,
            durationMs: 30000,
          },
        ],
        1000,
        31000
      );

      const report = await handoff.generateSynthesisReport();
      expect(report).toContain("**TIMED OUT**");
    });
  });

  describe("clear", () => {
    test("clears all recorded waves", () => {
      handoff.recordWave("wave_0", [], 1000, 2000);
      handoff.recordWave("wave_1", [], 2000, 3000);

      expect(handoff.getWaves().length).toBe(2);

      handoff.clear();

      expect(handoff.getWaves().length).toBe(0);
    });
  });
});
