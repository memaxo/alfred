# Context Management System Overview

Owner: cognition

## Executive Summary

ALFRED's context management system handles LLM API call construction, message history pruning, RAG integration, and token budget allocation. This document provides a comprehensive analysis of the current system, identifies weaknesses, and synthesizes cutting-edge research on context compression and pruning techniques applicable to production LLM applications.

**Scope Clarification**: This analysis focuses on _applied_ context optimization—techniques for managing what goes into LLM API calls from an application perspective. We are NOT building or training LLMs; we are optimizing how we construct prompts and manage context windows for inference efficiency and quality.

---

## Part 1: Current System Architecture

### 1.1 LLM API Call Construction Flow

```
UIMessage[] (from client/DB)
  ↓ validateUIMessages() [AI SDK]
  ↓ buildHistoryContext() [prunes & selects]
  ↓ convertToModelMessages() [AI SDK]
  ↓ pruneMessages() [AI SDK - removes empty]
  → ModelMessage[] (to LLM)
```

#### Primary Entry Points

| Entry Point     | File                                          | Purpose                                   |
| --------------- | --------------------------------------------- | ----------------------------------------- |
| Stream Handler  | `packages/api/src/stream-handler.ts:159-876`  | Main SSE streaming, uses `streamText()`   |
| Voice Assistant | `packages/api/src/voice/assistant.ts:414-627` | Voice interactions, uses `generateText()` |
| AI Adapter      | `packages/runtime/src/adapters/ai.ts:73-375`  | Workflow runtime, uses `streamText()`     |
| Plan Phase      | `packages/runtime/src/phases/plan.ts:35-394`  | Planning, uses `generateObject()`         |
| Act Phase       | `packages/runtime/src/phases/act.ts:13-437`   | Execution, uses `generateObject()`        |

### 1.2 Context Sources

#### System Prompts (4 sources)

1. **Base Persona** (`packages/persona/src/prompt.ts:11-75`) - Honorific, modality, focus mode
2. **User Preferences** (`packages/agent/src/preference/prompt.ts:28-65`) - DB-loaded, domain-filtered
3. **Domain Instructions** (`packages/api/src/ai/assistant-context.ts:69-119`) - Context-detected personas
4. **RAG Context** (`packages/api/src/ai/assistant-context.ts:97-115`) - Knowledge base chunks

#### Message History

- Stored in `conversation_messages` table
- Retrieved via `conversationRepo.getConversationHistory()`
- Normalized to `UIMessage[]` format
- Pruned via tier-based selection algorithm

#### Tool Call History

- Preserved via tool chain detection (`packages/history/src/history-context.ts:548-568`)
- Tool chains marked as "anchor" tier (always kept)
- Groups tracked to maintain call-result pairs

### 1.3 Pruning Strategy

**Primary Function**: `buildHistoryContext()` in `packages/history/src/history-context.ts:80-333`

#### Tier System

| Tier   | Messages                                       | Policy               |
| ------ | ---------------------------------------------- | -------------------- |
| Anchor | Last user message, tool chains, force-keep IDs | Always kept          |
| High   | Recent user messages                           | 2% overdraft allowed |
| Medium | Assistant messages, tool messages              | 1% overdraft allowed |
| Low    | Older assistant-only messages                  | Dropped first        |

#### Selection Algorithm

1. Force-keep anchors (lines 113-162)
2. Calculate token budget using research-backed ratios
3. Score messages by tier, recency, role (lines 166-208)
4. Group messages (tool chains grouped together)
5. Select groups greedily within budget (lines 234-254)

#### Budget Calculation (`packages/history/src/calculator.ts:134-239`)

```
Research-backed ratios:
- Default history ratio: 55% (below "Lost in the Middle" threshold)
- System reserve: 8% (scaled)
- Headroom: 15% (response generation)
- Tooling reserve: 6%

Formula: historyBudget = (maxContextTokens * historyRatio) - systemReserve - headroom - tooling
```

### 1.4 Caching Mechanisms

| Cache           | Location                                                 | TTL        | Key Strategy                              |
| --------------- | -------------------------------------------------------- | ---------- | ----------------------------------------- |
| Context Bundle  | `packages/agent/src/orchestrator/flow/context.ts:64-70`  | 5 min      | `context:${workspace}:${hashRequirement}` |
| Codeprint Index | `packages/agent/src/orchestrator/flow/context.ts:72-126` | 5 min      | Loads from `.codeprint.json`              |
| RAG Documents   | `rag_documents` + `rag_chunks` tables                    | Persistent | Deduped via `source` index                |

### 1.5 RAG Integration

**Engine**: `KnowledgeEngine` in `packages/runtime/src/engines/knowledge.ts:73-319`

- Hybrid search (vector + full-text with GIN indexes)
- Embedding model: KaLM-Embedding-Gemma3-12B-2511 with MRL truncation to 1024 dims
- Threshold filtering: default 0.7 similarity
- Optional reranking via `RAG_RERANK=1`
- Active Recall: touches graph nodes after retrieval

---

## Part 2: Identified Weaknesses

### 2.1 Critical Gaps

#### No Message Compression

- Messages are **pruned (removed)**, not **compressed**
- Long messages consume full token budget
- No LLMLingua-style token reduction
- Potential loss of important context when messages are dropped

#### No Semantic Summarization

- Old messages dropped without summarization
- No "summary of dropped messages" mechanism
- Context loss in long conversations
- No rolling summary to preserve conversation arc

#### RAG Context Not Budgeted

- RAG chunks added to system prompt without explicit budget check
- `packages/api/src/ai/assistant-context.ts:107-114` — No token limit on RAG injection
- Can exceed system reserve
- No ranking by relevance within budget constraints

#### Tool Result Truncation Missing

- Large tool results not truncated
- Can consume significant portion of context window
- No max-size limit on tool outputs
- Code outputs and long file contents uncapped

#### No Per-Message Importance Scoring

- Scoring is heuristic (tier + recency)
- No LLM-based importance scoring
- No user feedback loop on dropped messages
- No task-aware prioritization

### 2.2 Moderate Issues

| Issue                                        | Impact                              | Location                                              |
| -------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Context bundle token estimation inaccuracy   | May under/over-estimate code tokens | `packages/agent/src/orchestrator/flow/context.ts:971` |
| No streaming-aware pruning                   | Can't adjust mid-stream             | Pruning happens before stream starts                  |
| Preference prompt unbounded                  | Can bloat system prompt             | `packages/agent/src/preference/prompt.ts`             |
| Multiple system prompt sources uncoordinated | May exceed intended reserve         | 4 separate sources without unified budget             |
| No context quality metrics                   | Can't measure pruning impact        | No tracking of hit rate or quality                    |

### 2.3 Minor Improvements

- Cache invalidation fixed TTL (should use file modification times)
- Tool chain detection doesn't handle parallel tool calls
- Environment variable sprawl for tuning
- No context versioning for debugging

---

## Part 3: Research Synthesis

### 3.1 Prompt Compression Techniques

#### LLMLingua Family (Microsoft, EMNLP'23, ACL'24)

**Key Papers:**

- [LLMLingua](https://arxiv.org/abs/2310.05736): Coarse-to-fine compression using perplexity from small LM
- [LongLLMLingua](https://aclanthology.org/2024.acl-long.91/): Query-aware compression for long contexts
- [LLMLingua-2](https://arxiv.org/abs/2403.12968): Data distillation for 3-6x faster compression

**Core Approach:**

1. Budget controller maintains semantic integrity under high compression
2. Token-level iterative compression models interdependence
3. Instruction tuning aligns distribution between compressor and target LM

**Results:** Up to 20x compression with minimal performance loss

**GitHub:** [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) (5.8k stars)

```python
# Example: Structured prompt compression
compressed_prompt = llm_lingua.compress_prompt(
    demonstration.split("\n"),
    instruction,
    question,
    rate=0.55,
    use_sentence_level_filter=False,
    condition_in_question="after_condition",
    reorder_context="sort",
    dynamic_context_compression_ratio=0.3,
)
```

#### Dynamic Compressing Prompts (LLM-DCP)

**Paper:** [arXiv:2504.11004](https://arxiv.org/pdf/2504.11004) (2025)

**Approach:** Models prompt compression as a Markov Decision Process (MDP), enabling a DCP-Agent to sequentially remove redundant tokens by adapting to dynamic contexts.

**Key Innovation:** Task-agnostic method that adapts to context changes without retraining.

#### SCOPE: Generative Compression

**Paper:** [arXiv:2508.15813](https://arxiv.org/html/2508.15813v1) (2025)

**Approach:** Chunking-and-summarization mechanism that splits prompts into semantically coherent chunks and rewrites them.

**Advantage:** Overcomes information loss and structural incoherence of token removal methods.

### 3.2 Extractive vs Abstractive Compression

#### Key Finding: Extractive Often Wins

**Paper:** [Characterizing Prompt Compression Methods](https://arxiv.org/abs/2407.08892) (July 2024)

> "Surprisingly, we find that extractive compression often outperforms all the other approaches, and enables up to 10× compression with minimal accuracy loss."

#### EXIT: Context-Aware Extractive Compression

**Paper:** [arXiv:2412.12559](https://arxiv.org/html/2412.12559v1) (2024)

**Innovation:** Classifies sentences while preserving contextual dependencies, unlike independent sentence selection.

**Advantages over abstractive:**

- Parallelizable (no token-by-token generation)
- Lower latency
- Maintains exact phrasing for factual content

#### RECOMP: Selective Augmentation

**Paper:** [ICLR 2024](https://proceedings.iclr.cc/paper_files/paper/2024/hash/bda88ed2892f5e61c9a9bf215c566913-Abstract-Conference.html)

**Results:** Extractive compressor achieves compression rates as low as 6% with minimal performance loss, significantly outperforming off-the-shelf summarization models.

### 3.3 KV Cache Management

#### LazyLLM: Dynamic Token Pruning

**Paper:** [arXiv:2407.14057](https://arxiv.org/abs/2407.14057) (July 2024)

**Approach:** Dynamic token pruning during inference based on attention patterns.

#### TokenSelect: Dynamic KV Cache Selection

**Paper:** [arXiv:2411.02886](https://arxiv.org/abs/2411.02886) (Nov 2024)

**Innovation:** Token-level KV cache selection for length extrapolation beyond training context.

#### SAGE-KV: Self-Attention Guided Eviction

**Paper:** [ICLR 2025 SLLM Workshop](https://openreview.net/pdf?id=qg9dlCcNzr)

**Key Insight:** LLMs implicitly "know" which tokens can be dropped after pre-filling.

**Approach:** One-time top-k selection at token and head levels post-prefilling.

**Results:** 4× higher memory efficiency than StreamingLLM, 2× higher than Quest on 512k token contexts.

#### Production KV Cache Methods

| Method        | Approach                      | Compression        | Compatibility      |
| ------------- | ----------------------------- | ------------------ | ------------------ |
| EvicPress     | Joint compression + eviction  | 2.19× faster TTFT  | Multi-tier storage |
| PagedEviction | Block-wise pruning            | vLLM-native        | PagedAttention     |
| NACL          | Proxy token + random eviction | 50% KV reduction   | General            |
| Ada-KV        | Head-wise adaptive budget     | Theoretical bounds | Plug-and-play      |

### 3.4 Semantic Caching

#### GPTCache

**GitHub:** [zilliztech/gptcache](https://github.com/zilliztech/gptcache) (7.9k stars)

**Architecture:**

1. **Embedding Function**: Query → vector (OpenAI, Cohere, ONNX, SentenceTransformers)
2. **Cache Storage**: Scalar data (SQLite, MySQL, PostgreSQL)
3. **Vector Storage**: Semantic search (FAISS, Milvus)
4. **Similarity Evaluation**: Exact match or distance threshold

**Results:** Up to 10x cost reduction, 100x speed improvement

#### Provider-Native Caching

**Anthropic Prompt Caching** (via LlamaIndex):

- Caches prompt prefixes with `cache_control` markers
- Minimum 1024-2048 tokens depending on model
- Reduces processing time and costs on similar prefixes

### 3.5 Context Window Extension

#### Hierarchical Context Merging (HOMER)

**Paper:** [arXiv:2404.10308](https://arxiv.org/abs/2404.10308) (April 2024)

**Approach:** Training-free divide-and-conquer algorithm for long inputs.

#### Recurrent Context Compression (RCC)

**Paper:** [arXiv:2406.06110](https://arxiv.org/html/2406.06110v1) (June 2024)

**Results:** Up to 32x compression on text reconstruction with high BLEU4 scores.

#### LLoCO: Learning Long Contexts Offline

**Paper:** [EMNLP 2024](https://aclanthology.org/2024.emnlp-main.975.pdf)

**Approach:** Context compression + in-domain LoRA finetuning.

**Results:** Extends 4k token LLaMA2-7B to handle 128k tokens.

### 3.6 Long Context vs RAG

**Paper:** [arXiv:2501.01880](https://arxiv.org/html/2501.01880v1) (Dec 2024)

**Key Findings:**

- Long Context (LC) generally outperforms RAG for Wikipedia-based questions
- Summarization-based retrieval performs comparably to LC
- Chunk-based retrieval lags behind
- RAG has advantages for dialogue-based and general queries

---

## Part 4: Applied Code Patterns

### 4.1 Compression Trigger Pattern

From Claude Code analysis:

```typescript
class ContextManager {
  compressionThreshold = 0.92; // Trigger at 92% usage

  async manageContext(currentContext, newInput) {
    const updatedContext = this.appendToContext(currentContext, newInput);
    const tokenUsage = await this.calculateTokenUsage(updatedContext);

    if (tokenUsage.ratio >= this.compressionThreshold) {
      const compressionPrompt = await generateCompressionPrompt(updatedContext);
      const compressedSummary =
        await this.compressionModel.generate(compressionPrompt);
      return this.buildCompressedContext(compressedSummary, updatedContext);
    }

    return updatedContext;
  }
}
```

### 4.2 LangChain Document Compressor Pipeline

```python
from langchain.retrievers.document_compressors import DocumentCompressorPipeline
from langchain_community.document_transformers import EmbeddingsRedundantFilter
from langchain_text_splitters import CharacterTextSplitter

splitter = CharacterTextSplitter(chunk_size=300, chunk_overlap=0, separator=". ")
redundant_filter = EmbeddingsRedundantFilter(embeddings=embeddings)
relevant_filter = EmbeddingsFilter(embeddings=embeddings, similarity_threshold=0.76)

pipeline_compressor = DocumentCompressorPipeline(
    transformers=[splitter, redundant_filter, relevant_filter]
)
```

### 4.3 AI SDK `prepareStep` for Context Compaction

```typescript
// Recommended by Vercel AI SDK for context window management
const result = await streamText({
  model,
  messages,
  prepareStep: async ({ messages, stepNumber }) => {
    const tokenCount = estimateTokens(messages);
    const threshold = model.contextWindow * 0.85;

    if (tokenCount > threshold) {
      const summary = await generateSummary(messages.slice(0, -10));
      return {
        messages: [
          { role: "system", content: `Previous context summary: ${summary}` },
          ...messages.slice(-10),
        ],
      };
    }
    return { messages };
  },
});
```

### 4.4 H2O KV Cache Configuration

```python
from intel_extension_for_transformers.transformers.kv_cache_compression import (
    H2OConfig,
    LlamaForCausalLM
)

h2o_config = H2OConfig(
    heavy_ratio=0.2,   # Keep top 20% by attention weight
    recent_ratio=0.3,  # Keep most recent 30%
)

model = LlamaForCausalLM.from_pretrained(
    model_path,
    h2o_config=h2o_config,
)
```

### 4.5 Compression Best Practices

From production analysis:

```typescript
const compressionBestPractices = {
  timing: {
    threshold: "92% context usage",
    triggers: [
      "long conversations",
      "complex tasks",
      "multi-turn interactions",
    ],
    frequency: "dynamic based on task complexity",
  },

  strategy: {
    preservation: [
      "key file paths",
      "important findings",
      "error messages",
      "user requirements",
    ],
    optimization: [
      "merge duplicate info",
      "reduce detail granularity",
      "structured organization",
    ],
    validation: [
      "information completeness check",
      "key content verification",
      "compression rate monitoring",
    ],
  },

  effectiveness: {
    compressionRatio: "70-80% length reduction average",
    informationRetention: "95%+ key information preserved",
    performanceGain: "significant response speed improvement",
  },
};
```

---

## Part 5: Recommendations

### 5.1 Immediate Priorities

#### 1. Unified Context Budget Manager

Create a single source of truth for all context sources with real-time tracking:

```typescript
interface ContextBudget {
  total: number; // Model context window
  allocated: {
    system: number; // System prompts
    rag: number; // RAG chunks
    history: number; // Message history
    tools: number; // Tool schemas
    headroom: number; // Response generation
  };
  used: {
    system: number;
    rag: number;
    history: number;
    tools: number;
  };
}
```

#### 2. Message Compression Layer

Integrate LLMLingua or equivalent for progressive compression:

- **Recent messages**: Full fidelity
- **Older messages**: Extractive compression (sentence selection)
- **Very old messages**: Rolling summary

#### 3. RAG Budget Integration

- Include RAG chunks in system prompt budget
- Rank chunks by relevance within budget
- Dynamic chunk selection based on available budget

#### 4. Tool Result Truncation

- Truncate large tool outputs (> 4k tokens)
- Summarize tool results when over threshold
- Store full results in AgentFS, reference by ID in context

### 5.2 Medium-Term Improvements

#### 5. Context Quality Observability

- Track pruning impact metrics
- Measure RAG retrieval effectiveness
- A/B test pruning strategies
- Log which messages were dropped and downstream effects

#### 6. Semantic Caching Integration

Evaluate GPTCache or similar for:

- Repeated queries
- Similar prompt prefixes
- RAG chunk deduplication

#### 7. Extractive Compression Pipeline

Implement EXIT or RECOMP-style extractive compression:

- Train sentence classifier on QA task performance
- Preserve contextual dependencies
- Target 10x compression with minimal loss

### 5.3 Future Considerations

#### 8. KV Cache Optimization (if self-hosting)

For self-hosted models, consider:

- SAGE-KV for attention-guided eviction
- H2O for heavy-hitter + recent token preservation
- PagedEviction for vLLM deployments

#### 9. Provider-Native Features

- Anthropic prompt caching for repeated prefixes
- OpenAI's future caching features
- Gemini's context caching

#### 10. Task-Aware Context Selection

- Use LLM to score message relevance to current task
- Dynamic budget allocation based on task complexity
- Query-aware compression (LongLLMLingua style)

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Budget Unification)

1. Create `ContextBudgetManager` class
2. Refactor all context sources to register with budget manager
3. Add budget tracking to stream-handler
4. Add observability metrics

### Phase 2: Compression (Message Layer)

1. Integrate LLMLingua Python subprocess
2. Add compression threshold detection (92% usage)
3. Implement progressive compression tiers
4. Add rolling summary for very old messages

### Phase 3: RAG Integration

1. Add token budget to RAG retrieval
2. Implement relevance ranking within budget
3. Add chunk deduplication
4. Integrate with budget manager

### Phase 4: Observability & Optimization

1. Add context quality metrics
2. Implement A/B testing framework
3. Train extractive compressor on ALFRED-specific data
4. Evaluate semantic caching benefits

---

## References

### Papers

1. LLMLingua: Compressing Prompts for Accelerated Inference (EMNLP 2023)
2. LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios (ACL 2024)
3. LLMLingua-2: Data Distillation for Efficient Task-Agnostic Prompt Compression (2024)
4. Characterizing Prompt Compression Methods for Long Context Inference (arXiv 2024)
5. EXIT: Context-Aware Extractive Compression for RAG (2024)
6. RECOMP: Improving Retrieval-Augmented LMs with Context Compression (ICLR 2024)
7. LazyLLM: Dynamic Token Pruning for Efficient Long Context Inference (2024)
8. SAGE-KV: Self-Attention Guided KV Cache Eviction (ICLR 2025)
9. LLoCO: Learning Long Contexts Offline (EMNLP 2024)
10. Long Context vs RAG: An Evaluation and Revisits (2024)

### Implementations

- [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) - Prompt compression
- [zilliztech/gptcache](https://github.com/zilliztech/gptcache) - Semantic caching
- [vllm-project/llm-compressor](https://github.com/vllm-project/llm-compressor) - Model compression
- [Vercel AI SDK](https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages) - pruneMessages utility

---

## Appendix: ALFRED-Specific Files

### Core Context Management

- `packages/history/src/history-context.ts` - Message pruning & selection
- `packages/history/src/calculator.ts` - Budget calculation
- `packages/api/src/ai/messages.ts` - Message preparation
- `packages/api/src/stream-handler.ts` - Streaming context

### System Prompts

- `packages/persona/src/prompt.ts` - Persona prompt
- `packages/agent/src/preference/prompt.ts` - User preferences
- `packages/runtime/src/phases/plan.ts` - Plan system prompt
- `packages/runtime/src/phases/act.ts` - Act system prompt

### Context Building

- `packages/agent/src/orchestrator/flow/context.ts` - Code context bundle
- `packages/runtime/src/context.ts` - Runtime context
- `packages/runtime/src/engines/knowledge.ts` - Knowledge engine
