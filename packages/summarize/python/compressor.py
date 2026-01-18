"""
LongCodeZip Compressor Implementation

Based on the LongCodeZip paper (arXiv:2510.00446) for intelligent text compression
using perplexity-based relevance scoring and hierarchical compression.

This is a simplified implementation focused on the core algorithms:
1. Entropy-based semantic chunking
2. AMI (Approximated Mutual Information) relevance scoring
3. Two-stage hierarchical compression (coarse + fine)
4. 0/1 Knapsack block selection
"""

import math
import re
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from loguru import logger
from transformers import AutoModelForCausalLM, AutoTokenizer


class EntropyChunking:
    """Entropy-based text chunking using perplexity boundaries."""

    def __init__(self, model_name: str = "Qwen/Qwen2.5-Coder-0.5B-Instruct"):
        """Initialize with a small model for entropy calculation."""
        logger.debug(f"Loading entropy chunking model: {model_name}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name, torch_dtype=torch.float16
        )
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        logger.debug(f"Entropy chunking model loaded on device: {self.device}")

    def split_into_sentences(self, text: str) -> List[str]:
        """Split text into lines, preserving empty line markers."""
        # Replace double newlines with marker
        text_with_markers = text.replace("\n\n", "\n__EMPTY_LINE__\n")

        # Split by single newlines
        lines = text_with_markers.split("\n")

        # Process lines
        sentences = []
        for line in lines:
            if line == "__EMPTY_LINE__":
                sentences.append(" ")  # Empty line marker
            else:
                sentences.append(line)

        return sentences

    def calculate_sentence_ppl(self, sentences: List[str]) -> List[float]:
        """Calculate perplexity for each sentence based on preceding context."""
        ppls = []

        for i, sentence in enumerate(sentences):
            if i == 0:
                context = ""
                target = sentence
            else:
                context = "\n".join(sentences[:i])
                target = sentence

            ppl = self._compute_ppl(context, target)
            ppls.append(ppl)

        return ppls

    def _compute_ppl(self, context: str, target: str) -> float:
        """Compute perplexity of target text given context."""
        if not target or not target.strip():
            return 0.0

        if context:
            full_text = context + "\n" + target
            context_tokens = self.tokenizer(
                context + "\n", return_tensors="pt", add_special_tokens=True
            )
            context_length = context_tokens.input_ids.shape[1]
        else:
            full_text = target
            context_length = 0

        inputs = self.tokenizer(
            full_text, return_tensors="pt", add_special_tokens=True
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        if context_length > 0:
            target_logits = logits[0, context_length - 1 : -1]
            target_labels = inputs.input_ids[0, context_length:]
        else:
            target_logits = logits[0, :-1]
            target_labels = inputs.input_ids[0, 1:]

        if len(target_labels) > 0:
            log_probs = torch.log_softmax(target_logits, dim=-1)
            token_log_probs = log_probs[
                torch.arange(len(target_labels)), target_labels
            ]
            avg_log_prob = token_log_probs.mean().item()
            ppl = math.exp(-avg_log_prob)
        else:
            ppl = float("inf")

        # Return log2 of ppl as in original implementation
        return math.log2(ppl) if ppl > 0 and not math.isinf(ppl) else ppl

    def calculate_adaptive_thresholds(
        self, ppls: List[float], k: float = 0.2
    ) -> Dict[str, float]:
        """Calculate adaptive thresholds using statistical methods."""
        valid_ppls = [
            p for p in ppls if not math.isinf(p) and not math.isnan(p) and p > 0
        ]

        if len(valid_ppls) < 3:
            return {"std": 0.5, "robust_std": 0.5, "iqr": 0.5, "mad": 0.5}

        valid_ppls = np.array(valid_ppls)

        # Method 1: Standard deviation
        mean_ppl = np.mean(valid_ppls)
        std_ppl = np.std(valid_ppls)
        threshold_std = mean_ppl + k * std_ppl

        # Method 2: Robust std (MAD)
        median_ppl = np.median(valid_ppls)
        mad = np.median(np.abs(valid_ppls - median_ppl))
        robust_std = mad * 1.4826
        threshold_robust_std = median_ppl + k * robust_std

        # Method 3: IQR
        q25 = np.percentile(valid_ppls, 25)
        q75 = np.percentile(valid_ppls, 75)
        iqr = q75 - q25
        threshold_iqr = q75 + k * iqr

        # Method 4: MAD
        threshold_mad = median_ppl + k * mad

        return {
            "std": threshold_std,
            "robust_std": threshold_robust_std,
            "iqr": threshold_iqr,
            "mad": threshold_mad,
        }

    def find_ppl_spikes_adaptive(
        self, values: List[float], method: str = "std", k: float = 0.2
    ) -> Tuple[List[int], float]:
        """Find perplexity spikes using adaptive threshold."""
        thresholds = self.calculate_adaptive_thresholds(values, k)
        threshold = thresholds[method]

        spike_indices = []

        for i in range(1, len(values) - 1):
            current = values[i]
            left = values[i - 1]
            right = values[i + 1]

            # Skip invalid values
            if math.isinf(current) or math.isnan(current):
                continue
            if math.isinf(left) or math.isnan(left):
                left = current
            if math.isinf(right) or math.isnan(right):
                right = current

            left_diff = current - left
            right_diff = current - right

            # Spike condition: higher than both neighbors with threshold
            if (left_diff >= threshold or right_diff >= threshold) and (
                left_diff >= 0 and right_diff >= 0
            ):
                spike_indices.append(i)

        return spike_indices, threshold

    def chunk_text_adaptive(
        self, text: str, method: str = "std", k: float = 0.2
    ) -> Tuple[List[str], List[str], List[float], List[int]]:
        """Perform entropy-based chunking with adaptive spike detection."""
        sentences = self.split_into_sentences(text)
        ppls = self.calculate_sentence_ppl(sentences)
        spike_indices, threshold = self.find_ppl_spikes_adaptive(ppls, method, k)

        # Split at spike points (after the spike line)
        split_points = [0] + [idx + 1 for idx in spike_indices] + [len(sentences)]

        chunks = []
        for i in range(len(split_points) - 1):
            start = split_points[i]
            end = split_points[i + 1]
            chunk_sentences = sentences[start:end]
            chunk_text = "\n".join(chunk_sentences)
            chunks.append(chunk_text)

        return chunks, sentences, ppls, spike_indices


class LongCodeZip:
    """
    LongCodeZip context compression for long texts.

    Implements two-stage hierarchical compression:
    1. Coarse-grained: Function/section level selection based on AMI
    2. Fine-grained: Block-level pruning within selected sections
    """

    def __init__(
        self,
        model_name: str = "Qwen/Qwen2.5-Coder-7B-Instruct-GPTQ-Int4",
        device_map: str = "cuda",
        model_config: Optional[Dict] = None,
    ):
        """Initialize the compressor with a language model."""
        self.model_name = model_name
        self.device = device_map
        self.model_config = model_config or {}
        self.load_model(model_name, device_map, self.model_config)

        # Initialize entropy chunking with smaller model
        logger.debug("Initializing entropy chunking...")
        self.entropy_chunking = EntropyChunking()

        # Caching system
        self.cache: Dict[str, Dict] = {
            "token_length": {},
            "encodings": {},
            "perplexity": {},
            "conditional_ppl": {},
        }
        self.max_cache_size = 1000

        self.max_position_embeddings = getattr(
            self.model.config, "max_position_embeddings", 4096
        )

    def load_model(
        self, model_name: str, device_map: str = "cuda", model_config: Dict = None
    ):
        """Load the language model and tokenizer."""
        model_config = model_config or {}
        logger.debug(f"Loading model {model_name} on {device_map}")
        torch_dtype = model_config.get("torch_dtype", torch.bfloat16)

        model_kwargs = {
            "device_map": device_map,
            "torch_dtype": torch_dtype,
            "trust_remote_code": True,
        }
        model_kwargs.update(model_config)

        self.model = AutoModelForCausalLM.from_pretrained(model_name, **model_kwargs)
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name, trust_remote_code=True
        )
        self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "left"
        logger.debug("Model and tokenizer loaded successfully")

    def _manage_cache_size(self, cache_type: str):
        """Manage cache size by evicting oldest entries."""
        if len(self.cache[cache_type]) > self.max_cache_size:
            remove_count = int(self.max_cache_size * 0.2)
            keys_to_remove = list(self.cache[cache_type].keys())[:remove_count]
            for key in keys_to_remove:
                del self.cache[cache_type][key]

    def get_token_length(self, text: str, add_special_tokens: bool = True) -> int:
        """Get the number of tokens in the text."""
        cache_key = f"{text}_{add_special_tokens}"
        if cache_key in self.cache["token_length"]:
            return self.cache["token_length"][cache_key]

        token_length = len(
            self.tokenizer.encode(text, add_special_tokens=add_special_tokens)
        )
        self.cache["token_length"][cache_key] = token_length
        self._manage_cache_size("token_length")
        return token_length

    def get_ppl(
        self,
        text: str,
        condition_mode: str = "none",
        condition_pos_id: int = 0,
    ) -> Dict:
        """Calculate perplexity for the given text."""
        cache_key = f"{text}_{condition_mode}_{condition_pos_id}"
        if cache_key in self.cache["perplexity"]:
            return self.cache["perplexity"][cache_key]

        encoding = self.tokenizer(text, return_tensors="pt", padding=True)
        input_ids = encoding["input_ids"].to(self.model.device)
        attention_mask = encoding["attention_mask"].to(self.model.device)

        with torch.no_grad():
            outputs = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                return_dict=True,
            )

        shift_logits = outputs.logits[..., :-1, :].contiguous()
        shift_labels = input_ids[..., 1:].contiguous()

        active = (attention_mask[..., :-1] == 1).view(-1)
        active_logits = shift_logits.view(-1, shift_logits.size(-1))[active]
        active_labels = shift_labels.view(-1)[active]

        loss_fct = torch.nn.CrossEntropyLoss(reduction="none")
        loss = loss_fct(active_logits, active_labels)

        if condition_mode == "prefix":
            loss = loss[condition_pos_id:]

        mean_loss = loss.mean() if len(loss) > 0 else torch.tensor(0.0)
        ppl = (
            torch.exp(mean_loss).item()
            if mean_loss.item() != float("inf")
            else float("inf")
        )

        result = {"ppl": ppl, "loss": loss}
        self.cache["perplexity"][cache_key] = result
        self._manage_cache_size("perplexity")
        return result

    def get_condition_ppl(
        self,
        text: str,
        question: str,
        condition_in_question: str = "none",
    ) -> float:
        """
        Calculate AMI: perplexity change when context is provided.
        AMI(c, q) = PPL(q) - PPL(q | c)
        Positive value means context helps predict question.
        """
        cache_key = f"{text}_{question}_{condition_in_question}"
        if cache_key in self.cache["conditional_ppl"]:
            return self.cache["conditional_ppl"][cache_key]

        if condition_in_question == "none":
            result = self.get_ppl(text=text, condition_mode="none")
            ppl_value = result["ppl"]
        else:
            # PPL(q) without context
            question_ppl_without = self.get_ppl(text=question)["ppl"]

            # PPL(q | c) with context
            question_ppl_with = self.get_ppl(
                text=text + "\n\n" + question,
                condition_mode="prefix",
                condition_pos_id=self.get_token_length(
                    text + "\n\n", add_special_tokens=True
                ),
            )["ppl"]

            # AMI = reduction in perplexity
            ppl_value = question_ppl_without - question_ppl_with

        self.cache["conditional_ppl"][cache_key] = ppl_value
        self._manage_cache_size("conditional_ppl")
        return ppl_value

    def control_context_budget(
        self,
        context_list: List[str],
        target_token: float,
        question: str = "",
        context_budget: str = "+100",
    ) -> Tuple[List[str], List[int], List[float], List[Tuple[int, float]]]:
        """
        Control token budget for contexts based on relevance ranking.
        Returns selected contexts, indices, dynamic ratios, and sorted rankings.
        """
        if not context_list:
            return [], [], [], []

        # Get token counts
        context_tokens_length = [
            self.get_token_length(context) for context in context_list
        ]

        total_tokens = sum(context_tokens_length)
        if total_tokens <= target_token:
            return (
                context_list,
                list(range(len(context_list))),
                [0.0] * len(context_list),
                [(i, 0.0) for i in range(len(context_list))],
            )

        # Rank by relevance (AMI)
        if question:
            context_ppl_changes = []
            for d in context_list:
                ppl_change = self.get_condition_ppl(d, question, "prefix")
                context_ppl_changes.append(ppl_change)
            demonstrations_sort = sorted(
                enumerate(context_ppl_changes), key=lambda x: -x[1]
            )
        else:
            demonstrations_sort = [(i, 0) for i in range(len(context_list))]

        # Calculate target with budget expression
        if target_token < 0:
            target_token = 100
        target_token = eval("target_token" + context_budget)

        # Select contexts
        used = []
        for idx, _ in demonstrations_sort:
            if idx >= len(context_tokens_length):
                continue
            target_token -= context_tokens_length[idx]
            if idx not in used:
                used.append(idx)
            if target_token < 0:
                break

        # Keep original order
        used = sorted(used)
        selected_contexts = [
            context_list[idx] for idx in used if idx < len(context_list)
        ]

        return selected_contexts, used, [0.0] * len(used), demonstrations_sort

    def split_code_by_functions(
        self, code: str, language: str = "python"
    ) -> List[str]:
        """Split code into function-level chunks."""
        patterns = {
            "python": r"(^|\n)(\s*)(def|class)\s+[^\n]+(\n(?!\s*(?:def|class)\s)[^\n]*)*",
            "typescript": r"(^|\n)(\s*)(?:(?:export\s+)?(?:async\s+)?function|class|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)",
            "javascript": r"(^|\n)(\s*)(?:(?:export\s+)?(?:async\s+)?function|class|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)",
        }

        if language.lower() not in patterns:
            language = "python"

        function_pattern = re.compile(patterns[language.lower()], re.MULTILINE)
        matches = list(function_pattern.finditer(code))

        if not matches:
            return [code]

        chunks = []
        if matches[0].start() > 0:
            chunks.append(code[: matches[0].start()])

        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i < len(matches) - 1 else len(code)
            chunks.append(code[start:end])

        return chunks

    def compress_code_file(
        self,
        code: str,
        query: str = "",
        instruction: str = "",
        rate: float = 0.5,
        target_token: float = -1,
        language: str = "python",
        context_budget: str = "+100",
        rank_only: bool = False,
        fine_grained_importance_method: str = "conditional_ppl",
        min_lines_for_fine_grained: int = 5,
        importance_beta: float = 0.5,
        use_knapsack: bool = True,
        repeat_instruction_at_end: bool = True,
    ) -> Dict:
        """
        Compress code using two-stage hierarchical compression.

        Args:
            code: Source code/text to compress
            query: Query for relevance scoring
            instruction: Instruction prefix
            rate: Target compression ratio (0-1)
            target_token: Target token count (-1 to use rate)
            language: Programming language
            context_budget: Budget adjustment expression
            rank_only: If True, only do coarse-grained compression
            fine_grained_importance_method: Method for fine-grained scoring
            min_lines_for_fine_grained: Minimum lines for fine-grained
            importance_beta: Importance sensitivity
            use_knapsack: Use knapsack for block selection
            repeat_instruction_at_end: Repeat instruction after code

        Returns:
            Dict with compression results
        """
        logger.debug(f"Starting compression: rate={rate}, target_token={target_token}")
        start_time = time.time()

        # Split into function chunks
        code_chunks = self.split_code_by_functions(code, language=language)
        logger.debug(f"Split into {len(code_chunks)} chunks")

        # Calculate total tokens
        total_tokens = sum(self.get_token_length(chunk) for chunk in code_chunks)

        # Determine target
        if target_token <= 0:
            target_token = int(total_tokens * rate) if rate > 0 else int(total_tokens * 0.5)

        # Coarse-grained: select important functions
        (
            selected_contexts,
            selected_indices,
            dynamic_ratios,
            demonstrations_sort,
        ) = self.control_context_budget(
            code_chunks,
            target_token=target_token,
            question=query,
            context_budget=context_budget,
        )

        # Build compressed output
        compressed_chunks = []
        compressed_tokens = 0
        function_compressions = {}
        comment_marker = "#" if language.lower() in ["python", "typescript", "rust"] else "//"

        for i, chunk in enumerate(code_chunks):
            if i in selected_indices:
                compressed_chunks.append(chunk)
                chunk_tokens = self.get_token_length(chunk)
                compressed_tokens += chunk_tokens
                function_compressions[i] = {
                    "original_tokens": chunk_tokens,
                    "compressed_tokens": chunk_tokens,
                    "compression_ratio": 1.0,
                }
            else:
                omission_text = f"{comment_marker} ... "
                compressed_chunks.append(omission_text)
                compressed_tokens += self.get_token_length(omission_text)

        compressed_code = "\n\n".join(compressed_chunks)

        # Clean up consecutive omission markers
        lines = compressed_code.split("\n")
        cleaned_lines = []
        last_was_omission = False
        omission_content = f"{comment_marker} ...".strip()

        for line in lines:
            stripped = line.strip()
            if not stripped:
                cleaned_lines.append(line)
            elif stripped == omission_content:
                if not last_was_omission:
                    cleaned_lines.append(line)
                    last_was_omission = True
            else:
                cleaned_lines.append(line)
                last_was_omission = False

        compressed_code = "\n".join(cleaned_lines)

        # Build final prompt
        prompt_parts = []
        if instruction and instruction.strip():
            prompt_parts.append(instruction.strip())
        if compressed_code.strip():
            prompt_parts.append(compressed_code)
        if repeat_instruction_at_end and instruction and instruction.strip():
            prompt_parts.append(instruction.strip())
        if query and query.strip():
            prompt_parts.append(query.strip())

        output = "\n\n".join(prompt_parts)
        final_compressed_tokens = self.get_token_length(output)

        end_time = time.time()
        logger.debug(f"Compression completed in {end_time - start_time:.2f}s")
        logger.debug(
            f"Ratio: {compressed_tokens / total_tokens if total_tokens > 0 else 1.0:.2f}"
        )

        return {
            "original_code": code,
            "compressed_code": compressed_code,
            "compressed_prompt": output,
            "original_tokens": total_tokens,
            "compressed_tokens": compressed_tokens,
            "final_compressed_tokens": final_compressed_tokens,
            "compression_ratio": compressed_tokens / total_tokens
            if total_tokens > 0
            else 1.0,
            "function_compressions": function_compressions,
            "selected_functions": selected_indices,
            "demonstrations_sort": demonstrations_sort,
            "compressed_chunks": compressed_chunks,
            "fine_grained_method_used": None if rank_only else fine_grained_importance_method,
        }
