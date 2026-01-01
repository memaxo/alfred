import { describe, expect, it } from "bun:test";
import { dockerRun, isDockerAvailable, isImageAvailable } from "./utils/infra";

const IMAGE = "alfred-agentfs:codex";

const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);

describe("AgentFS image", () => {
  it.skipIf(!(dockerOk && imageOk))(
    "includes required runtime tools without executing them",
    () => {
      const res = dockerRun(
        IMAGE,
        [
          "command -v bun >/dev/null",
          "command -v codex >/dev/null",
          "command -v rg >/dev/null",
          // fd is sometimes installed as fdfind; we symlink fd but accept either.
          "(command -v fd >/dev/null || command -v fdfind >/dev/null)",
          "command -v lsd >/dev/null",
          // ast-grep may be installed as sg and/or ast-grep
          "(command -v sg >/dev/null || command -v ast-grep >/dev/null)",
        ].join(" && ")
      );

      expect(res.exitCode).toBe(0);
    }
  );
});
