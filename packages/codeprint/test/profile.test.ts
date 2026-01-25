import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  enableProfiling,
  disableProfiling,
  clearProfiles,
  getIndexBuildProfiles,
  getQueryProfiles,
  formatIndexBuildProfile,
  formatQueryProfile,
} from "../src/profile.js";
import {
  buildIndexProfiled,
  findRelevantFilesProfiled,
} from "../src/profiled.js";

describe("profiling", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-profile-"));
    await mkdir(join(workspace, "src"));

    for (let i = 0; i < 10; i++) {
      await writeFile(
        join(workspace, `src/file${i}.ts`),
        `export function func${i}(): void {}\nexport const val${i} = ${i};`
      );
    }

    enableProfiling();
    clearProfiles();
  });

  afterAll(async () => {
    disableProfiling();
    await rm(workspace, { recursive: true });
  });

  test("buildIndexProfiled returns profile with all stages", async () => {
    const { index, profile } = await buildIndexProfiled(workspace);

    expect(index.size).toBe(10);
    expect(profile.totalMs).toBeGreaterThan(0);
    expect(profile.files.total).toBe(10);
    expect(profile.files.parsed).toBe(10);
    expect(profile.files.errors).toBe(0);
    expect(profile.bytesRead).toBeGreaterThan(0);

    // All stages should have timing
    expect(profile.stages.discover.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.read.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.parse.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.extract.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.bm25Build.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.persist.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("findRelevantFilesProfiled returns profile with all stages", async () => {
    // First build the index so cache is populated
    await buildIndexProfiled(workspace);

    const { results, profile } = await findRelevantFilesProfiled(
      workspace,
      "func val src",
      5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(profile.totalMs).toBeGreaterThan(0);
    expect(profile.result.queryTerms).toBe(3);
    expect(profile.result.candidates).toBeGreaterThan(0);
    expect(profile.result.returned).toBeLessThanOrEqual(5);

    // All stages should have timing
    expect(profile.stages.cacheCheck.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.tokenize.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.match.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.sort.durationMs).toBeGreaterThanOrEqual(0);
    expect(profile.stages.format.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("profiles are recorded when profiling enabled", async () => {
    clearProfiles();

    await buildIndexProfiled(workspace);
    await findRelevantFilesProfiled(workspace, "func src", 5);
    await findRelevantFilesProfiled(workspace, "val src", 5);

    const indexProfiles = getIndexBuildProfiles();
    const queryProfiles = getQueryProfiles();

    // Index build is recorded
    expect(indexProfiles.length).toBeGreaterThanOrEqual(1);
    // Query profiles are recorded (may include nested build)
    expect(queryProfiles.length).toBeGreaterThanOrEqual(2);
  });

  test("formatIndexBuildProfile produces readable output", async () => {
    const { profile } = await buildIndexProfiled(workspace);
    const output = formatIndexBuildProfile(profile);

    expect(output).toContain("Index Build Profile");
    expect(output).toContain("Files:");
    expect(output).toContain("Stages:");
    expect(output).toContain("discover:");
    expect(output).toContain("parse:");
  });

  test("formatQueryProfile produces readable output", async () => {
    const { profile } = await findRelevantFilesProfiled(workspace, "func", 5);
    const output = formatQueryProfile(profile);

    expect(output).toContain("Query Profile");
    expect(output).toContain("Terms:");
    expect(output).toContain("Stages:");
    expect(output).toContain("match:");
    expect(output).toContain("tokenize:");
  });

  test("stage timing sums approximately to total", async () => {
    const { profile } = await findRelevantFilesProfiled(
      workspace,
      "func val",
      5
    );

    const stageSum =
      profile.stages.cacheCheck.durationMs +
      profile.stages.tokenize.durationMs +
      profile.stages.match.durationMs +
      profile.stages.sort.durationMs +
      profile.stages.rerankPrep.durationMs +
      profile.stages.rerank.durationMs +
      profile.stages.format.durationMs;

    // Allow some overhead tolerance
    expect(stageSum).toBeLessThanOrEqual(profile.totalMs * 1.1);
  });
});
