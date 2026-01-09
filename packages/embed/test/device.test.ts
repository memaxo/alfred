import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("embed_server device selection", () => {
  it("honors EMBED_DEVICE without importing torch", async () => {
    const code = `
import sys
import json
import types
import importlib.util

spec = importlib.util.spec_from_file_location(
  "embed_server",
  "packages/embed/scripts/embed_server.py",
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class Cuda:
  def __init__(self, ok):
    self._ok = ok
  def is_available(self):
    return self._ok

class Mps:
  def __init__(self, ok):
    self._ok = ok
  def is_available(self):
    return self._ok

torch = types.SimpleNamespace(
  cuda=Cuda(False),
  backends=types.SimpleNamespace(mps=Mps(False)),
)

out = json.dumps({
  "cpu": mod.resolve_device("cpu", torch),
  "auto": mod.resolve_device("auto", torch),
  "cuda_fallback": mod.resolve_device("cuda", torch),
  "rocm_fallback": mod.resolve_device("rocm", torch),
})

with open(sys.argv[1], "w", encoding="utf-8") as f:
  f.write(out)
`;

    const dir = mkdtempSync(join(tmpdir(), "alfred-embed-"));
    const file = join(dir, "script.py");
    const outFile = join(dir, "out.json");
    await Bun.write(file, code);

    try {
      expect((await Bun.file(file).text()).trim().length).toBeGreaterThan(0);

      const proc = spawnSync("python3", [file, outFile], {
        cwd: process.cwd(),
        encoding: "utf8",
      });

      expect(proc.status).toBe(0);
      expect((proc.stderr ?? "").trim()).toBe("");

      expect(await Bun.file(outFile).exists()).toBe(true);

      const data = (await Bun.file(outFile).json()) as {
        cpu: string;
        auto: string;
        cuda_fallback: string;
        rocm_fallback: string;
      };

      expect(data.cpu).toBe("cpu");
      expect(data.auto).toBe("cpu");
      expect(data.cuda_fallback).toBe("cpu");
      expect(data.rocm_fallback).toBe("cpu");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
