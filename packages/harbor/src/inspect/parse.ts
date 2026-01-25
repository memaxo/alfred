/**
 * Parse ATIF trajectory from file or JSON
 */

import * as fs from "node:fs";

import type { AtifTrajectory } from "../types.js";

/**
 * Parse an ATIF trajectory from a file path
 */
export function parseTrajectory(pathOrJson: string): AtifTrajectory {
  let content: string;

  // Check if it's a file path or raw JSON
  if (pathOrJson.trim().startsWith("{")) {
    content = pathOrJson;
  } else {
    if (!fs.existsSync(pathOrJson)) {
      throw new Error(`Trajectory file not found: ${pathOrJson}`);
    }
    content = fs.readFileSync(pathOrJson, "utf8");
  }

  const parsed = JSON.parse(content) as AtifTrajectory;

  // Basic validation
  if (!parsed.schema_version) {
    throw new Error("Invalid ATIF trajectory: missing schema_version");
  }
  if (!parsed.session_id) {
    throw new Error("Invalid ATIF trajectory: missing session_id");
  }
  if (!Array.isArray(parsed.steps)) {
    throw new TypeError("Invalid ATIF trajectory: steps must be an array");
  }

  return parsed;
}
