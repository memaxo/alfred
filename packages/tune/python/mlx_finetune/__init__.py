"""
MLX fine-tuning helpers for ALFRED.

This module is invoked from the Bun/TypeScript bridge via:

    python -m mlx_finetune.train_lora --config <path>

It handles HuggingFace dataset preparation, MLX LoRA orchestration,
and optional evaluation helpers.
"""

__all__ = ["config", "dataset", "train_lora", "eval"]

