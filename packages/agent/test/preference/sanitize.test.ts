import { describe, expect, it } from "bun:test";

import type { PreferenceDetail, PreferenceKey } from "@alfred/type/preference";
import { sanitizePreferences } from "../../src/preference/sanitize";

describe("sanitizePreferences", () => {
  it("preserves enum-backed response values", () => {
    const prefs = new Map<PreferenceKey, PreferenceDetail>([
      [
        "response.verbosity",
        { value: "concise", source: "user", confidence: 1 },
      ],
    ]);

    const sanitized = sanitizePreferences(prefs);
    expect(sanitized.get("response.verbosity")?.value).toBe("concise");
  });

  it("removes unsafe characters from strings", () => {
    const prefs = new Map<PreferenceKey, PreferenceDetail>([
      [
        "domain.proxmox.config_format",
        {
          value: "yaml<script>alert(1)</script>",
          source: "inferred",
          confidence: 0.7,
        },
      ],
    ]);

    const sanitized = sanitizePreferences(prefs);
    expect(sanitized.get("domain.proxmox.config_format")?.value).toBe(
      "yamlscriptalert(1)/script"
    );
  });
});
