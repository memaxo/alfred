from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

from .config import load_config


def main() -> None:
  parser = argparse.ArgumentParser(description="Run mlx_lm.generate with optional adapters.")
  parser.add_argument("--config", help="Path to FineTuneConfig JSON to infer defaults.")
  parser.add_argument("--model", help="Override base model path or repo ID.")
  parser.add_argument("--adapter-path", help="Path to trained adapters.")
  parser.add_argument("--prompt", required=True, help="Prompt text to send to the model.")
  parser.add_argument("--max-tokens", type=int, default=256, help="Maximum tokens to generate.")
  parser.add_argument("--temperature", type=float, default=0.7, help="Generation temperature.")
  args = parser.parse_args()

  model = args.model
  adapter_path = args.adapter_path

  if args.config:
    cfg = load_config(args.config)
    if model is None:
      model = cfg.model.model_identifier()
    if adapter_path is None and cfg.output.saveAdapters:
      adapter_path = str(cfg.adapters_dir)

  if not model:
    raise SystemExit("A model path or repo ID must be provided via --model or --config.")

  cmd = [
    sys.executable,
    "-m",
    "mlx_lm",
    "generate",
    "--model",
    model,
    "--prompt",
    args.prompt,
    "--max-tokens",
    str(args.max_tokens),
    "--temp",
    str(args.temperature),
  ]

  if adapter_path:
    cmd.extend(["--adapter-path", adapter_path])

  env = os.environ.copy()
  process = subprocess.run(cmd, env=env, check=False)
  sys.exit(process.returncode)


if __name__ == "__main__":
  main()

