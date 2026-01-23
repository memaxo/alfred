import shlex
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


def _choose_delim(text: str) -> str:
    # Pick a heredoc delimiter that won't appear in the payload.
    base = "__HARBOR_INSTRUCTION_END__"
    if base not in text:
        return base
    # Extremely unlikely fallback.
    i = 0
    while True:
        d = f"{base}_{i}"
        if d not in text:
            return d
        i += 1


class AlfredAgent(BaseAgent):
    """
    Harbor agent adapter that runs ALFRED inside the task container.

    Expectations:
    - ALFRED is available at /alfred in the container (provided by a prebuilt image)
    - Task workspace is available at /workspace (provided by task Dockerfile)
    - Writes ATIF trajectory to /logs/verifier/trajectory.json
    """

    SUPPORTS_ATIF = True

    @staticmethod
    def name() -> str:
        return "alfred"

    def __init__(self, logs_dir: Path, model_name: str | None = None, **kwargs):
        super().__init__(logs_dir=logs_dir, model_name=model_name, **kwargs)

    def version(self) -> str | None:
        return "0.1.0"

    async def setup(self, environment: BaseEnvironment) -> None:
        # No-op; the container image should already contain ALFRED.
        return

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        delim = _choose_delim(instruction)

        # Default to low autonomy unless the job passes a different band.
        auto = "low"
        if isinstance(getattr(context, "metadata", None), dict):
            v = context.metadata.get("auto")
            if isinstance(v, str) and v in ("read", "low", "medium", "high"):
                auto = v

        cmd = "\n".join(
            [
                "set -euo pipefail",
                "mkdir -p /logs/verifier",
                'echo "harbor_env_PATH=$PATH"',
                "command -v docker || true",
                "docker version || true",
                'cd /alfred && bun -e \'import { resolveExecutable } from "./packages/agent/src/orchestrator/tool/codex/policy.ts"; console.log("codex_resolve_docker", resolveExecutable("docker"));\'',
                f"cat > /instruction.md <<'{delim}'",
                instruction.rstrip("\n"),
                delim,
                "cd /alfred",
                'export DATABASE_URL="sqlite:/logs/verifier/alfred.db"',
                # Write ATIF trajectory to verifier logs so Harbor verifiers can consume it.
                (
                    "bun packages/harbor/src/agent/run.ts"
                    ' --requirement "$(cat /instruction.md)"'
                    ' --workspace "${CONTEXT_DIR}/workspace"'
                    " --outTrajectory /logs/verifier/trajectory.json"
                    f" --auto {shlex.quote(auto)}"
                ),
            ]
        )

        # Keep all logs in /logs/agent via tee (Harbor mounts this directory).
        wrapped = (
            "set -o pipefail; "
            f"bash -lc {shlex.quote(cmd)} 2>&1 | tee /logs/agent/alfred.txt"
        )

        result = await environment.exec(command=wrapped)
        if result.return_code != 0:
            raise RuntimeError(
                f"alfred_agent_failed rc={result.return_code} stdout_len={len(result.stdout or '')} stderr_len={len(result.stderr or '')}"
            )

