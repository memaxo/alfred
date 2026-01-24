# Two-Stage Reasoning Architectures for Real-Time Voice AI

Ultra-fast inference from Cerebras (2,100 tokens/second) fundamentally changes what's possible in real-time voice AI. Combined with speculative decoding patterns that preserve output quality while delivering 2-3x speedups, a new class of architectures can achieve **sub-500ms response latency** while maintaining sophisticated reasoning capabilities. This report analyzes production implementations from OpenAI, Google, and ElevenLabs, examines speculative decoding patterns proven in production, and provides concrete architectural recommendations for Cerebras-powered reasoning preload systems.

## Production voice AI achieves sub-400ms through native multimodal processing

The latency-intelligence tradeoff in voice AI is being solved through three distinct architectural approaches. **OpenAI GPT-4o** processes audio natively without intermediate text conversion, achieving **232ms minimum response time** under ideal conditions and ~500ms time-to-first-byte in production API measurements. Previous Voice Mode required 2.8-5.4 seconds due to cascaded Whisper → GPT-4 → TTS pipelines—GPT-4o's unified architecture eliminates two model boundaries entirely.

**Google Gemini Live** takes a similar native multimodal approach with Gemini 2.5 Flash Native Audio, processing raw audio through a single low-latency model. While Google hasn't published specific millisecond benchmarks, third-party measurements show **~280ms TTFT** for Flash models. The key differentiator is simultaneous audio, video, and text processing—the model can "see" and "hear" context together.

**ElevenLabs Conversational AI** proves that optimized cascaded pipelines remain competitive. Their architecture chains specialized components: **75ms TTS inference** (Flash v2.5), **<100ms STT** (custom implementation vs 300ms+ for Whisper), achieving **sub-second total latency** with optimal LLM selection. The modular approach enables mixing best-in-class components and provides debuggable text transcripts.

| System             | Architecture            | Claimed/Measured Latency | Key Trade-off                          |
| ------------------ | ----------------------- | ------------------------ | -------------------------------------- |
| OpenAI GPT-4o      | Native speech-to-speech | 232ms min / ~500ms TTFB  | Harder to debug, audio-in/audio-out    |
| Google Gemini Live | Native multimodal       | ~280ms TTFT              | Limited public benchmarks              |
| ElevenLabs         | Optimized cascade       | 525-1400ms total         | Sequential processing, LLM flexibility |

The critical insight: **first-token latency determines perceived responsiveness**, not total generation time. Audio playback streams continuously once TTS begins, so LLM token generation (80-90 tok/s for GPT-4o) easily outpaces speech playback rate (~3 words/second).

## Speculative decoding delivers 2-3x speedups without quality loss

Speculative decoding, proven in production at Google AI Overviews and available in OpenAI's Predicted Outputs API, provides the foundational pattern for two-stage reasoning. The technique exploits a fundamental property of LLM inference: **verifying multiple tokens in parallel costs roughly the same as generating one token** due to memory-bandwidth constraints.

The mechanism works through draft-then-verify: a small, fast model generates γ candidate tokens autoregressively, then the target model scores all candidates in a single forward pass. Modified rejection sampling accepts tokens matching the target distribution, with **70-80% acceptance rates** in practice. Mathematically, output quality is **provably identical** to standard autoregressive decoding—this is lossless acceleration.

**Production implementations** demonstrate real-world viability:

- **Google**: Deployed in AI Overviews for search, achieving "remarkable speedups while maintaining same quality"
- **OpenAI Predicted Outputs**: Users provide expected output predictions for code editing; rejected tokens charged at completion rates
- **vLLM**: Open-source implementation with continuous batching, achieving **1.5x on ShareGPT, 2.8x on summarization**
- **Groq**: Llama-3.3-70b-specdec achieves **1,665 tok/s** (6x speedup from 250 tok/s baseline)

**EAGLE-3** represents current state-of-the-art, operating at the feature level rather than token level. By using second-to-top-layer features for prediction and including sampled token embeddings to handle uncertainty, EAGLE-3 achieves **up to 6.5x speedup** with ~0.8 acceptance rate. The technique creates sparse tree structures that are more selective than Medusa's Cartesian product approach.

For voice AI specifically, speculative decoding reduces TTFT by generating multiple tokens per forward pass—precisely what streaming TTS pipelines need. The technique provides maximum benefit in **memory-bandwidth-bound scenarios** (typical of LLM inference), **predictable outputs** (greetings, confirmations, structured responses), and **low-QPS environments** where systems aren't compute-saturated.

## Cerebras and Groq enable reasoning at conversation speed

Cerebras and Groq have fundamentally broken the GPU memory-bandwidth bottleneck that historically limited LLM inference. **Cerebras achieves 2,100 tokens/second** for Llama 3.1 70B—**16-68x faster than GPU hyperscalers**—through 21 PB/s memory bandwidth (7,000x more than H100) and 44GB on-chip SRAM storing entire models without transfer overhead.

| Platform           | Llama 70B tok/s    | TTFT          | Memory Bandwidth | Best For                  |
| ------------------ | ------------------ | ------------- | ---------------- | ------------------------- |
| **Cerebras WSE-3** | 2,100              | 240ms         | 21 PB/s          | Throughput, large batches |
| **Groq LPU**       | 1,665 (w/spec dec) | 220ms         | 80 TB/s          | Latency consistency       |
| **NVIDIA H100**    | 50-100             | 1,000-4,200ms | 3.3 TB/s         | Flexibility, training     |

The **LiveKit + Cerebras partnership** already demonstrates production voice AI viability. LiveKit's Agents framework directly integrates Cerebras inference, powering what they call the "world's fastest AI voice assistant" at cerebras.livekit.io. LiveKit CEO Russell d'Sa notes that "Cerebras' best-in-class compute with LiveKit's global edge network has allowed us to create AI experiences that feel more human."

At **1,600+ tokens/second**, previously impossible capabilities become viable for real-time voice:

- **1,050 tokens in 500ms**: A full reasoning chain completes within typical voice response latency budget
- **10x more CoT steps**: Complex multi-step reasoning fits within interactive timeframes
- **Agentic workflows**: Multi-tool sequences execute at conversation speed

The cost picture is equally compelling: Cerebras charges **$0.60/M output tokens** for Llama 70B versus ~$3-10/M on GPU infrastructure—**50-100x better price-performance** for inference workloads.

## Two-stage reasoning patterns for voice latency constraints

Several architectural patterns enable sophisticated reasoning within voice latency budgets. These can be combined with Cerebras/Groq speed advantages to create systems that "think fast."

**Pattern 1: Reasoning Preload During STT**

```
[User speaking: 200-300ms STT processing]
    ↓
[Cerebras: Speculatively generate reasoning context]
    → Pre-compute likely response paths based on partial transcript
    → Warm KV-cache with reasoning tokens
    ↓
[On transcript finalized]
    → Verify/refine precomputed reasoning in single forward pass
    → Generate final response with minimal additional latency
```

This exploits the observation that **STT processing and LLM reasoning can overlap**. While streaming ASR feeds partial transcripts, the LLM begins reasoning on the first clause before the sentence completes. At 2,100 tok/s, Cerebras can generate **420 reasoning tokens** during 200ms of STT processing.

**Pattern 2: Speculative Thinking for Reasoning Models**
Recent research (April 2025) proposes "Speculative Thinking" specifically for reasoning models:

- Small model generates most reasoning steps speculatively
- Larger "mentor" model handles only **difficult reflective steps** (identified by cues like "wait," "alternatively")
- Target model modifies only ~20% of speculative output
- Achieves **1.5-2.5x speedup** while **improving accuracy by 1-9.9%**

**Pattern 3: Speculative Cascades**
Google Research combines speculative decoding with model cascades:

- Small model decides if it can handle the query or should defer
- Speculative verification happens within each cascade level
- Provides better cost-quality trade-offs than either technique alone

**Pattern 4: KV-Cache Aware Routing**
The llm-d project routes requests to pods with warm KV-caches:

- Achieves **87% cache hit rate**
- **88% faster TTFT** for warm cache hits
- Critical for multi-turn conversation where context accumulates

For a Cerebras-powered voice system, the recommended architecture combines patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Voice Input Layer                           │
│  Audio → VAD → Streaming STT (200ms)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Partial transcript streams
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cerebras Reasoning Preload (1,600+ tok/s)          │
│  • Generate speculative reasoning during STT                    │
│  • Pre-compute response paths for likely queries                │
│  • Warm KV-cache with reasoning tokens (400+ tokens in 200ms)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Reasoning context ready
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Generation                          │
│  • Verify precomputed reasoning (single forward pass)           │
│  • Generate response tokens (streaming to TTS)                  │
│  • Target TTFT: <300ms from end of speech                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Streaming tokens
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TTS Synthesis (75-100ms TTFB)                 │
│  Flash TTS begins synthesis on first tokens                     │
└─────────────────────────────────────────────────────────────────┘
```

## Voice-specific optimizations compound latency gains

Production voice systems employ multiple optimization layers that compound with fast inference. **KV-cache warming** eliminates cold-start latency: sending a lightweight "ping" query when a call begins primes the model instance, with prompt caching reducing costs by **10x** ($0.30 vs $3.00 per million tokens for cached prefixes).

**Streaming at every layer** is non-negotiable. Traditional pipelines wait for complete LLM output before TTS synthesis; true streaming begins audio synthesis immediately upon receiving first text tokens. ElevenLabs achieves **135ms TTS TTFB** with Flash models, meaning audio playback can begin within 400ms of LLM first token.

**Chain-of-Thought compression** addresses the latency cost of reasoning tokens. TokenSkip achieves **40% token reduction** with <0.4% accuracy drop by selectively skipping less important tokens within CoT sequences. TALE (Token-Budget-Aware LLM Reasoning) reduces tokens by **68.9%** with <5% accuracy loss through dynamic budget estimation based on problem complexity. For voice, the recommendation is clear: use reasoning tokens only for genuinely complex queries, implement "thinking indicators" for longer operations, and pre-compute common reasoning chains.

**Barge-in handling** requires immediate response—production systems flush audio buffers within **<200ms** of detecting user speech. OpenAI's Realtime API includes semantic VAD that chunks audio based on utterance completion rather than simple silence detection. Context preservation during interruption is critical: partial response context must be stored to resume naturally.

| Optimization     | Latency Impact                 | Implementation                             |
| ---------------- | ------------------------------ | ------------------------------------------ |
| KV-cache warming | Eliminates cold start (10-30s) | Pre-send dummy query at session start      |
| Prompt caching   | Up to 80% TTFT reduction       | Keep stable prefix, dynamic content at end |
| Streaming TTS    | ~135ms TTFB vs batch synthesis | ElevenLabs Flash, Cartesia                 |
| CoT compression  | 40-70% fewer reasoning tokens  | TokenSkip, TALE budget-aware               |
| Semantic VAD     | Reduce false turn-endings      | OpenAI semantic_vad mode                   |

## Academic foundations inform production architectures

The academic literature provides rigorous foundations for these production techniques. **PagedAttention** (Kwon et al., SOSP 2023) enables vLLM's 2-4x throughput improvement by storing KV-cache in non-contiguous blocks, reducing memory fragmentation from ~70% waste to <4%. **FlashAttention** (Dao et al., NeurIPS 2022) delivers 3x speedup through IO-aware tiled computation using GPU SRAM, reducing memory footprint from O(N²) to O(N).

**Speech-native LLM architectures** represent the frontier. **LLaMA-Omni** achieves **226ms latency** for simultaneous text and speech response using a non-autoregressive speech decoder with CTC for streaming speech unit prediction. **DiVA** (Distilled Voice Assistant) reaches **72% win rate** versus Qwen 2 Audio with **100x less training compute** through self-supervised distillation from text LLM transcripts.

Key academic findings applicable to production voice AI:

- **Speculative decoding preserves exact output distribution** (Leviathan et al., ICML 2023)—quality guarantees are mathematical, not empirical
- **Continuous batching** (Orca, OSDI 2022) achieves **36.9x throughput** over static batching by dynamically adding/removing requests at each decoding step
- **Reasoning tokens show diminishing returns** beyond ~500 tokens for most tasks; budget-aware approaches can reduce overhead by 40-70%
- **GQA/MQA attention** reduces KV-cache size by 8x, critical for conversation context accumulation

## Architectural recommendations for Cerebras-powered voice reasoning

For a production system targeting **<500ms end-to-end latency** with Cerebras fast inference generating reasoning for voice:

**Recommended Architecture Stack:**

1. **Inference**: Cerebras Cloud API for Llama 70B at 2,100 tok/s
2. **Serving framework**: vLLM with PagedAttention + automatic prefix caching
3. **Speculative decoding**: EAGLE-3 or Cerebras native spec dec for additional 2-3x
4. **STT**: Deepgram or custom streaming ASR (<100ms)
5. **TTS**: ElevenLabs Flash (75ms inference) or Cartesia
6. **Transport**: WebRTC via LiveKit for <50ms audio transport
7. **Reasoning compression**: Token budget-aware prompting, cached reasoning chains

**Latency Budget Allocation (Target: <500ms):**
| Component | Budget | Achievable With |
|-----------|--------|-----------------|
| Audio capture + preprocessing | 25ms | Local VAD, noise gate |
| WebRTC transport | 50ms | LiveKit edge network |
| STT processing | 100ms | Streaming Deepgram/custom |
| LLM reasoning + response | 200ms | Cerebras @ 2,100 tok/s |
| TTS synthesis | 75ms | ElevenLabs Flash |
| Return audio transport | 50ms | WebRTC |
| **Total** | **500ms** | |

**Two-Stage Reasoning Implementation:**

1. **During STT (200ms window)**: Cerebras generates ~400 speculative reasoning tokens based on partial transcript
2. **On transcript finalization**: Single forward pass verifies reasoning, generates response tokens
3. **Streaming to TTS**: First response tokens reach TTS within 50ms of reasoning completion
4. **Audio playback begins**: Within 500ms of user finishing speech

**Key Implementation Considerations:**

- **Speculative reasoning accuracy**: Monitor acceptance rates; target 70%+ for optimal speedup
- **Context window management**: Cerebras supports 128K context; use prefix caching for system prompts
- **Fallback handling**: Implement graceful degradation when speculation fails
- **Cost optimization**: Cerebras at $0.60/M tokens makes aggressive reasoning economically viable

## Conclusion

Two-stage reasoning architectures for voice AI are now production-viable due to converging advances in ultra-fast inference, speculative decoding, and voice-specific optimizations. **Cerebras' 2,100 tok/s** enables generating complete reasoning chains within voice latency budgets that would take 2-4 seconds on GPU infrastructure. Speculative decoding adds **2-3x additional speedup** without quality loss, validated in production at Google and OpenAI.

The most promising pattern for a Cerebras-powered system is **reasoning preload during STT**: using the 200ms STT window to speculatively generate 400+ reasoning tokens, then verifying and completing the response in a single forward pass. Combined with streaming TTS (75ms TTFB) and WebRTC transport, **sub-500ms end-to-end latency becomes achievable** while maintaining sophisticated reasoning capabilities.

The competitive landscape is rapidly evolving—OpenAI and Google's native speech-to-speech models eliminate pipeline latency entirely, while ElevenLabs proves optimized cascades remain competitive. For applications requiring transparent reasoning chains, debuggable outputs, and model flexibility, a Cerebras-powered two-stage architecture offers the best combination of speed, intelligence, and control. The LiveKit + Cerebras partnership demonstrates this is not theoretical: production voice AI at conversation speed is already deployed.
