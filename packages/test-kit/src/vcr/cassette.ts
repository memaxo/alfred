/**
 * VCR Cassette File I/O
 *
 * Handles reading and writing cassette files that store
 * recorded AI provider interactions.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VCRCassette, VCRInteraction } from "./types";

/**
 * Loads a cassette from disk
 */
export async function loadCassette(
  cassettePath: string
): Promise<VCRCassette | null> {
  try {
    const content = await readFile(cassettePath, "utf-8");
    const cassette = JSON.parse(content) as VCRCassette;

    // Validate version
    if (cassette.version !== 2) {
      console.warn(
        `VCR: Cassette version ${cassette.version} may not be compatible`
      );
    }

    return cassette;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Saves a cassette to disk
 */
export async function saveCassette(
  cassettePath: string,
  cassette: VCRCassette
): Promise<void> {
  await mkdir(path.dirname(cassettePath), { recursive: true });
  await writeFile(cassettePath, JSON.stringify(cassette, null, 2));
}

/**
 * Creates a new empty cassette
 */
export function createCassette(name: string): VCRCassette {
  return {
    version: 2,
    name,
    createdAt: new Date().toISOString(),
    interactions: [],
  };
}

/**
 * Adds an interaction to a cassette
 */
export function addInteraction(
  cassette: VCRCassette,
  interaction: VCRInteraction
): void {
  cassette.interactions.push(interaction);
}

/**
 * Finds a matching interaction in a cassette
 */
export function findInteraction(
  cassette: VCRCassette,
  requestHash: string
): VCRInteraction | undefined {
  return cassette.interactions.find((i) => i.requestHash === requestHash);
}

/**
 * Resolves cassette path relative to test file
 */
export function resolveCassettePath(
  testFilePath: string,
  cassetteName: string
): string {
  const testDir = path.dirname(testFilePath);
  return path.join(testDir, "__cassettes__", `${cassetteName}.json`);
}
