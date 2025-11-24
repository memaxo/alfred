from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass
class ModelConfig:
  baseModelId: Optional[str] = None
  baseModelPath: Optional[str] = None
  modelType: Optional[str] = None
  quantization: str = "none"
  dtype: Optional[str] = None

  def model_identifier(self) -> str:
    if self.baseModelPath:
      return self.baseModelPath
    if self.baseModelId:
      return self.baseModelId
    raise ValueError("Model configuration must include baseModelPath or baseModelId.")


@dataclass
class DatasetConfig:
  datasetId: str = ""
  trainSplit: str = "train"
  evalSplit: Optional[str] = None
  template: str = "system-user-assistant-text"
  maxSamples: Optional[int] = None
  trainRatio: Optional[float] = None
  evalRatio: Optional[float] = None
  shuffleSeed: int = 0


@dataclass
class TrainingConfig:
  epochs: int = 1
  steps: Optional[int] = None
  batchSize: int = 1
  gradientAccumulation: int = 1
  learningRate: float = 1e-4
  maxSeqLen: int = 2048
  warmupSteps: int = 0
  weightDecay: float = 0.0
  seed: int = 42


@dataclass
class LoraConfig:
  enabled: bool = True
  rank: int = 8
  alpha: float = 16.0
  dropout: float = 0.0
  targetModules: list[str] = field(default_factory=lambda: ["self_attn.q_proj", "self_attn.v_proj"])
  layers: Optional[int] = None


@dataclass
class OutputConfig:
  outputDir: str = ""
  logDir: Optional[str] = None
  saveAdapters: bool = True
  fuseAdapters: bool = False
  runName: Optional[str] = None
  keepCheckpoints: Optional[int] = None

  def resolved_output_dir(self) -> Path:
    return Path(self.outputDir).expanduser().resolve()


@dataclass
class Metadata:
  description: Optional[str] = None
  tags: list[str] = field(default_factory=list)
  notes: Optional[str] = None


@dataclass
class RunPaths:
  runId: str
  runsRoot: Path
  runDir: Path
  datasetDir: Path
  logDir: Path
  configPath: Path

  @classmethod
  def from_dict(cls, data: Dict[str, Any]) -> "RunPaths":
    return cls(
      runId=data["runId"],
      runsRoot=Path(data["runsRoot"]).expanduser().resolve(),
      runDir=Path(data["runDir"]).expanduser().resolve(),
      datasetDir=Path(data["datasetDir"]).expanduser().resolve(),
      logDir=Path(data["logDir"]).expanduser().resolve(),
      configPath=Path(data["configPath"]).expanduser().resolve(),
    )


@dataclass
class FineTuneConfig:
  backend: str
  model: ModelConfig
  data: DatasetConfig
  training: TrainingConfig
  lora: LoraConfig
  output: OutputConfig
  metadata: Metadata = field(default_factory=Metadata)
  paths: Optional[RunPaths] = None
  workspaceRoot: Optional[str] = None

  @classmethod
  def from_dict(cls, data: Dict[str, Any], config_path: Path) -> "FineTuneConfig":
    paths = RunPaths.from_dict(data["paths"]) if "paths" in data else None
    workspace_root = data.get("workspaceRoot")
    if workspace_root is None and paths is not None:
      workspace_root = str(paths.runDir.parent)
    if workspace_root is None:
      workspace_root = _infer_workspace_root(config_path)
    return cls(
      backend=data["backend"],
      model=ModelConfig(**data["model"]),
      data=DatasetConfig(**data["data"]),
      training=TrainingConfig(**data["training"]),
      lora=LoraConfig(**data["lora"]),
      output=OutputConfig(**data["output"]),
      metadata=Metadata(**data.get("metadata", {})),
      paths=paths,
      workspaceRoot=workspace_root,
    )

  @property
  def workspace_path(self) -> Path:
    if self.workspaceRoot:
      return Path(self.workspaceRoot).expanduser().resolve()
    if self.paths:
      return self.paths.runDir.parent
    return Path.cwd()

  @property
  def dataset_dir(self) -> Path:
    if not self.paths:
      raise ValueError("Config is missing run paths; createRunPaths must run first.")
    return self.paths.datasetDir

  @property
  def adapters_dir(self) -> Path:
    return self.output.resolved_output_dir() / "adapters"


def load_config(config_path: str | Path) -> FineTuneConfig:
  path = Path(config_path).expanduser().resolve()
  with path.open("r", encoding="utf-8") as handle:
    data = json.load(handle)
  return FineTuneConfig.from_dict(data, path)


def _infer_workspace_root(config_path: Path) -> str:
  parents = list(config_path.parents)
  if len(parents) >= 3:
    return str(parents[2])
  return str(config_path.parent)

