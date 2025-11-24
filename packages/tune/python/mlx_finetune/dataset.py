from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

from .config import FineTuneConfig

try:
  from datasets import Dataset, load_dataset
except ImportError as exc:  # pragma: no cover - import guard
  raise RuntimeError(
    "The 'datasets' package is required. Install it with `pip install datasets`."
  ) from exc


@dataclass
class DatasetArtifacts:
  data_dir: Path
  train_path: Path
  valid_path: Optional[Path]
  test_path: Optional[Path]
  train_count: int
  valid_count: int
  test_count: int


def prepare_dataset(config: FineTuneConfig) -> DatasetArtifacts:
  data_dir = config.dataset_dir
  data_dir.mkdir(parents=True, exist_ok=True)

  train_dataset = load_dataset(config.data.datasetId, split=config.data.trainSplit)
  train_dataset = train_dataset.shuffle(seed=config.data.shuffleSeed)

  if config.data.maxSamples:
    count = min(config.data.maxSamples, len(train_dataset))
    train_dataset = train_dataset.select(range(count))

  if config.data.trainRatio:
    count = max(1, int(len(train_dataset) * config.data.trainRatio))
    train_dataset = train_dataset.select(range(count))

  eval_dataset = _resolve_eval_dataset(config, train_dataset)

  train_path = data_dir / "train.jsonl"
  valid_path = data_dir / "valid.jsonl"
  test_path = data_dir / "test.jsonl"

  train_count = _write_jsonl(train_dataset, train_path, config.data.template)
  valid_count = _write_jsonl(eval_dataset or train_dataset, valid_path, config.data.template)
  test_count = 0

  if eval_dataset is not None:
    test_count = _write_jsonl(eval_dataset, test_path, config.data.template)

  return DatasetArtifacts(
    data_dir=data_dir,
    train_path=train_path,
    valid_path=valid_path if valid_count > 0 else None,
    test_path=test_path if test_count > 0 else None,
    train_count=train_count,
    valid_count=valid_count,
    test_count=test_count,
  )


def _resolve_eval_dataset(config: FineTuneConfig, train_dataset: Dataset) -> Optional[Dataset]:
  if config.data.evalSplit:
    return load_dataset(config.data.datasetId, split=config.data.evalSplit).shuffle(
      seed=config.data.shuffleSeed
    )
  if config.data.evalRatio:
    split = train_dataset.train_test_split(
      test_size=config.data.evalRatio,
      seed=config.data.shuffleSeed,
    )
    return split["test"]
  if len(train_dataset) == 0:
    return None
  sample_size = max(1, min(50, len(train_dataset) // 10))
  return train_dataset.select(range(sample_size))


def _write_jsonl(dataset: Dataset, destination: Path, template: str) -> int:
  count = 0
  with destination.open("w", encoding="utf-8") as handle:
    for record in dataset:
      text = render_template(record, template)
      if not text:
        continue
      handle.write(json.dumps({"text": text}, ensure_ascii=False))
      handle.write("\n")
      count += 1
  return count


def render_template(record: DictLike, template: str) -> str:
  template_key = template.lower()
  if template_key == "system-user-assistant-text":
    system = _first_present(record, ["system", "context", "schema", "background"])
    user = _first_present(
      record, ["user", "instruction", "question", "query", "prompt", "input"]
    )
    assistant = _first_present(
      record, ["assistant", "output", "response", "answer", "completion"]
    )
    parts = []
    if system:
      parts.append(system)
    if user:
      parts.append(f"User: {user}")
    if assistant:
      parts.append(f"Assistant: {assistant}")
    return "\n".join(parts).strip()
  if template_key == "instruction-completion":
    instruction = _first_present(
      record, ["instruction", "question", "query", "prompt", "input"]
    )
    context = _first_present(record, ["context", "schema", "background"])
    completion = _first_present(
      record, ["assistant", "completion", "output", "response", "answer"]
    )
    parts = []
    if context:
      parts.append(context)
    if instruction:
      parts.append(f"Instruction: {instruction}")
    if completion:
      parts.append(f"Completion: {completion}")
    return "\n".join(parts).strip()
  raise ValueError(f"Unsupported dataset template: {template}")


DictLike = Any


def _first_present(record: DictLike, keys: Iterable[str]) -> Optional[str]:
  for key in keys:
    value = record.get(key) if isinstance(record, dict) else None
    if value is None:
      continue
    text = _coerce_text(value)
    if text:
      return text
  return None


def _coerce_text(value: Any) -> str:
  if isinstance(value, str):
    return value.strip()
  if isinstance(value, (int, float)):
    return str(value)
  if isinstance(value, list):
    return "\n".join(_coerce_text(item) for item in value if item is not None)
  if isinstance(value, dict):
    return json.dumps(value, ensure_ascii=False)
  return ""

