from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

from .config import FineTuneConfig, load_config
from .dataset import DatasetArtifacts, prepare_dataset


def main() -> None:
  parser = argparse.ArgumentParser(description="MLX LoRA fine-tuning harness for ALFRED.")
  parser.add_argument("--config", required=True, help="Path to the serialized FineTuneConfig JSON.")
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Prepare configs and datasets but skip launching mlx_lm.",
  )
  args = parser.parse_args()

  cfg = load_config(args.config)
  ensure_memory_budget(cfg)
  emit_event("config_loaded", config=args.config)

  artifacts = prepare_dataset(cfg)
  emit_event(
    "dataset_prepared",
    data_dir=str(artifacts.data_dir),
    train_count=artifacts.train_count,
    valid_count=artifacts.valid_count,
    template=cfg.data.template,
  )

  mlx_config_path = write_mlx_config(cfg, artifacts)
  emit_event("mlx_config_ready", path=str(mlx_config_path))

  if args.dry_run:
    emit_event("dry_run_complete")
    return

  exit_code = run_mlx_lora(cfg, mlx_config_path)
  if exit_code != 0:
    emit_event("training_failed", exit_code=exit_code)
    sys.exit(exit_code)

  emit_event("training_completed", exit_code=exit_code)

  if cfg.output.fuseAdapters:
    fuse_code = run_mlx_fuse(cfg)
    if fuse_code != 0:
      emit_event("fuse_failed", exit_code=fuse_code)
      sys.exit(fuse_code)
    emit_event("fuse_completed", exit_code=fuse_code)


def write_mlx_config(cfg: FineTuneConfig, artifacts: DatasetArtifacts) -> Path:
  adapters_dir = cfg.adapters_dir
  adapters_dir.mkdir(parents=True, exist_ok=True)

  iters = cfg.training.steps
  if iters is None:
    batches = math.ceil(max(1, artifacts.train_count) / cfg.training.batchSize)
    iters = max(1, cfg.training.epochs * batches)

  steps_per_report = max(1, min(100, iters // 20))
  steps_per_eval = max(10, iters // max(1, cfg.training.epochs))
  save_every = cfg.output.keepCheckpoints or max(100, iters // 10)

  mlx_config: Dict[str, object] = {
    "model": cfg.model.model_identifier(),
    "train": True,
    "data": str(artifacts.data_dir),
    "seed": cfg.training.seed,
    "lora_layers": cfg.lora.layers or 16,
    "batch_size": cfg.training.batchSize,
    "iters": iters,
    "val_batches": -1,
    "learning_rate": cfg.training.learningRate,
    "steps_per_report": steps_per_report,
    "steps_per_eval": steps_per_eval,
    "adapter_path": str(adapters_dir),
    "save_every": save_every,
    "test": False,
    "test_batches": 0,
    "max_seq_length": cfg.training.maxSeqLen,
    "grad_checkpoint": cfg.training.gradientAccumulation > 1,
    "lora_parameters": {
      "keys": cfg.lora.targetModules or ["self_attn.q_proj", "self_attn.v_proj"],
      "rank": cfg.lora.rank,
      "alpha": cfg.lora.alpha,
      "scale": 10.0,
      "dropout": cfg.lora.dropout,
    },
  }

  if cfg.training.warmupSteps:
    mlx_config["lr_schedule"] = {
      "name": "cosine_decay",
      "warmup": cfg.training.warmupSteps,
      "arguments": [
        cfg.training.learningRate,
        iters,
        1e-7,
      ],
    }

  paths = require_paths(cfg)
  config_path = paths.runDir / "mlx_lora_config.json"
  with config_path.open("w", encoding="utf-8") as handle:
    json.dump(mlx_config, handle, ensure_ascii=False, indent=2)
  return config_path


def run_mlx_lora(cfg: FineTuneConfig, mlx_config_path: Path) -> int:
  cmd = [sys.executable, "-m", "mlx_lm", "lora", "--config", str(mlx_config_path)]
  env = os.environ.copy()
  emit_event("training_launch", command=cmd)
  return stream_subprocess(cmd, cwd=cfg.workspace_path, env=env)


def run_mlx_fuse(cfg: FineTuneConfig) -> int:
  fused_dir = cfg.output.resolved_output_dir() / "fused"
  fused_dir.mkdir(parents=True, exist_ok=True)
  cmd = [
    sys.executable,
    "-m",
    "mlx_lm",
    "fuse",
    "--model",
    cfg.model.model_identifier(),
    "--adapter-path",
    str(cfg.adapters_dir),
    "--save-path",
    str(fused_dir),
  ]
  env = os.environ.copy()
  emit_event("fuse_launch", command=cmd)
  return stream_subprocess(cmd, cwd=cfg.workspace_path, env=env)


def stream_subprocess(cmd: List[str], cwd: Path | str, env: Optional[Dict[str, str]]) -> int:
  process = subprocess.Popen(
    cmd,
    cwd=cwd,
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1,
  )

  threads = []
  if process.stdout:
    threads.append(
      threading.Thread(
        target=_forward_stream,
        args=(process.stdout, sys.stdout, "stdout"),
        daemon=True,
      )
    )
  if process.stderr:
    threads.append(
      threading.Thread(
        target=_forward_stream,
        args=(process.stderr, sys.stderr, "stderr"),
        daemon=True,
      )
    )

  for thread in threads:
    thread.start()

  try:
    return process.wait()
  except KeyboardInterrupt:
    process.kill()
    raise
  finally:
    for thread in threads:
      thread.join(timeout=1)


def _forward_stream(stream, target, label: str) -> None:
  for line in stream:
    target.write(line)
    target.flush()
    emit_event(
      "subprocess_output",
      source=label,
      line=line.rstrip("\n"),
    )


def emit_event(event: str, **data: object) -> None:
  payload = {
    "event": event,
    "timestamp": time.time(),
    **data,
  }
  print(json.dumps(payload, ensure_ascii=False), flush=True)


def require_paths(cfg: FineTuneConfig):
  if cfg.paths is None:
    raise ValueError("Fine-tune config is missing run paths; ensure createRunPaths was executed.")
  return cfg.paths


def ensure_memory_budget(cfg: FineTuneConfig) -> None:
  params = estimate_param_count(cfg)
  available_gb = detect_physical_memory_gb()
  if params is None or available_gb is None:
    return
  bytes_per_param = estimate_bytes_per_param(cfg.model.quantization)
  estimated_gb = params * bytes_per_param / (1024**3)
  if estimated_gb > available_gb * 0.95:
    raise RuntimeError(
      f"Estimated model size {estimated_gb:.1f} GB exceeds available memory "
      f"{available_gb:.1f} GB. Reduce batch size, increase quantization, "
      "or move the workload to a host with more RAM."
    )


def estimate_param_count(cfg: FineTuneConfig) -> Optional[float]:
  hints = [cfg.model.modelType, cfg.model.baseModelId, cfg.model.baseModelPath]
  for hint in hints:
    if not hint:
      continue
    match = re.search(r"(\d+(?:\.\d+)?)\s*([bBmM])", hint)
    if not match:
      continue
    value = float(match.group(1))
    suffix = match.group(2).lower()
    scale = 1e9 if suffix == "b" else 1e6
    return value * scale
  return None


def estimate_bytes_per_param(quantization: str) -> float:
  normalized = quantization.lower()
  if normalized in {"q4", "int4", "4bit"}:
    return 0.5
  if normalized in {"q8", "int8", "8bit"}:
    return 1
  if normalized in {"fp16", "bf16"}:
    return 2
  return 4


def detect_physical_memory_gb() -> Optional[float]:
  if hasattr(os, "sysconf"):
    try:
      pages = os.sysconf("SC_PHYS_PAGES")
      page_size = os.sysconf("SC_PAGE_SIZE")
      return pages * page_size / (1024**3)
    except (ValueError, OSError):
      return None
  return None


if __name__ == "__main__":
  main()

