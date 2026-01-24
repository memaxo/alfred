# Cognitive State Machine

**Owner:** Cognitive  
**Last Updated:** 2025-11-26

## Purpose

This guide explains the event-sourced cognitive state machine at the heart of ALFRED, covering how it models attention, decision-making, and continuous learning through pure state transitions and Bayesian autonomy updates.

---

ALFRED's cognitive state machine is the beating heart of the assistant. Unlike traditional request-response systems that treat each interaction as stateless, ALFRED maintains continuous awareness of its own cognitive state—whether it's idle and waiting, deep in thought, making decisions, or reflecting on outcomes. This statefulness enables ALFRED to learn from every interaction, adapt its behavior based on context, and maintain coherence across conversations that span hours or days.

The design draws inspiration from cognitive science: humans don't simply react to stimuli, they maintain internal states that influence how they process information and make decisions. ALFRED models this through a discriminated union of six cognitive states, each with its own properties and valid transitions. This is the foundation for ALFRED's genuine learning and adaptation.

## Core Concepts

The cognitive state machine uses event sourcing as its persistence model. Rather than storing only the current state, ALFRED persists every event that triggers a state change. This immutable event log serves as a complete audit trail of ALFRED's cognitive journey, enabling powerful capabilities that would be impossible with traditional state storage.

Event sourcing provides more than just an audit trail. By storing every state change as an immutable event, ALFRED can replay any conversation from scratch, debug issues by examining the exact sequence of events that led to a decision, and even experiment with alternative outcomes by replaying events with different parameters. This determinism is crucial for a learning system: if ALFRED can't reliably reproduce its own reasoning, it can't learn from mistakes or improve its decision-making.

The six cognitive states form a closed system where every state has well-defined entry and exit conditions. In the `idle` state, ALFRED waits for input while consuming minimal resources. `Capturing` represents the initial processing of user input, where ALFRED gauges confidence in its understanding. `Thinking` is where deep reasoning occurs—exploring multiple paths, building reasoning traces, and considering alternatives. `Deciding` surfaces when multiple viable options exist and ALFRED must weigh them against criteria like safety, speed, accuracy, and cost. `Executing` tracks progress through a multi-step plan, while `reflecting` closes the loop by comparing expected outcomes against actual results.

## Architecture

The state machine implementation prioritizes purity and performance above all else. State transitions are pure functions that take the current state and an incoming event, returning a new state without any side effects. This purity guarantees determinism—given the same inputs, transitions will always produce the same outputs. It also enables aggressive optimization: pure functions can be safely memoized, parallelized, and tested in complete isolation.

Performance budgets are strict by design. State transitions must complete within 100 microseconds, a constraint that forces the implementation to avoid memory allocation in hot paths and use efficient data structures. The actual transition logic uses a direct pattern match on the event discriminant, avoiding the overhead of virtual dispatch or complex conditionals. This isn't premature optimization—it's recognition that the cognitive loop runs on every user interaction, and latency directly impacts the assistant's responsiveness.

Events flow into the system from multiple sources. User input arrives as `input` events with content and a source discriminant. System timeouts generate `timeout` events when operations exceed their deadlines. Feedback events capture the user's assessment of ALFRED's performance by comparing expected and actual outcomes. Interrupt events allow the brainstem supervisor to halt runaway processes, while completion events mark the end of execution with success, failure, partial completion, or cancellation outcomes.

The event persistence layer writes events to the `cognitive_events` table immediately after each transition. Periodic snapshots of the full cognitive state are stored in `cognitive_snapshots` to enable fast hydration—rather than replaying thousands of events, ALFRED can load the most recent snapshot and replay only subsequent events. This optimization keeps startup time constant regardless of conversation length.

## Physiology and Homeostasis

ALFRED's cognitive state includes a physiology system that models the assistant's operational health through three metrics: energy, boredom, and frustration. These are homeostatic regulators that influence ALFRED's autonomy and decision-making in measurable ways.

Energy depletes with each processing step and recovers after successful interactions. When energy drops below critical thresholds, ALFRED becomes more conservative in its actions, preferring simpler solutions that don't risk compounding exhaustion. Boredom increases when ALFRED detects repetitive patterns in its processing—a signal that it may be stuck in a loop. Frustration accumulates with errors and unexpected failures, triggering increased caution and eventual escalation to user intervention.

These physiological signals feed directly into the autonomy gradient, creating a self-regulating system. High frustration automatically reduces autonomy levels, causing ALFRED to seek more approval before taking action. This prevents frustrated thrashing while ensuring that temporary setbacks don't permanently impair the assistant's capabilities. As successful interactions accumulate, physiology recovers and autonomy can rise again.

## Bayesian Autonomy

The autonomy gradient represents ALFRED's confidence in its own judgment. Rather than using fixed thresholds or manual configuration, autonomy adapts through Bayesian inference. The system maintains a Beta distribution prior that tracks the history of successes and failures, updating after each outcome to produce a posterior estimate of ALFRED's reliability.

The Beta distribution was chosen for its mathematical elegance and computational efficiency. It's conjugate to the Bernoulli likelihood, meaning Bayesian updates reduce to simple addition: successful outcomes increment alpha, failures increment beta. The mode of this distribution provides the autonomy level, while the variance yields a confidence score. As evidence accumulates, the distribution narrows, and ALFRED's self-assessment becomes more precise.

Autonomy bands translate the continuous autonomy level into discrete behavioral policies. At the lowest band (0.0–0.3), ALFRED operates in read-only mode, observing and reporting but never modifying state. The suggest band (0.3–0.5) allows proposing actions that require user approval. Cautious execution (0.5–0.7) permits safe mutations with clear rollback paths. Supervised execution (0.7–0.9) enables more consequential actions with appropriate monitoring. Full autonomy (0.9–1.0) is reserved for highly trusted scenarios where ALFRED has demonstrated consistent reliability.

## Brainstem Supervisor

Operating beneath the conscious cognitive states, the brainstem supervisor monitors for pathological conditions that the state machine itself cannot detect. It watches for semantic loops—sequences of reasoning that repeat without making progress—by computing entropy over recent thoughts. When entropy drops below a threshold, indicating repetitive content, the supervisor fires an interrupt event to break the cycle.

The supervisor also monitors process health through heartbeats. Each workflow registers with the supervisor and must emit periodic pulses to confirm forward progress. If heartbeats cease—indicating a hung process or resource exhaustion—the supervisor terminates the workflow and triggers recovery procedures. This watchdog pattern ensures that even catastrophic failures in individual components don't leave ALFRED in an unresponsive state.

Physiology monitoring completes the supervisor's remit. By continuously sampling energy, boredom, and frustration levels, it can detect gradual degradation that might not trigger state-level alarms. When any physiological metric crosses critical thresholds, the supervisor emits appropriate events to force state transitions that address the underlying condition.

## Design Decisions

The choice of event sourcing over traditional CRUD storage reflects ALFRED's nature as a learning system. CRUD optimizes for the current state at the expense of history; event sourcing optimizes for understanding how the current state came to be. This trade-off is worth the additional complexity because ALFRED's value compounds over time—the longer it runs, the more it learns, and the more valuable its history becomes.

Pure state transitions were chosen despite the ergonomic convenience of mutable state objects. Purity eliminates entire categories of bugs related to shared mutable state, race conditions, and non-deterministic behavior. It also enables the snapshot-and-replay architecture that makes debugging and testing tractable. The performance cost of creating new state objects on each transition is negligible compared to the cognitive overhead of reasoning about mutable state.

The Bayesian autonomy system represents a deliberate choice to let ALFRED adapt through evidence rather than configuration. Hard-coded autonomy levels would require constant tuning and would never account for the specific context of individual deployments. By learning from outcomes, ALFRED automatically calibrates its confidence to match its actual reliability, requiring no manual intervention beyond occasional feedback.

## Integration Points

The cognitive loop integrates with voice and chat interfaces through the `runCognitiveLoop` function, which serves as the primary entry point for user interactions. Voice transcripts and chat messages arrive as input events, triggering state transitions that may generate response effects. These effects are returned to the caller for execution, maintaining the separation between pure state logic and side-effectful operations.

The workflow runtime consumes cognitive state to inform context building. Before executing any workflow, the runtime queries the current cognitive state to understand ALFRED's current focus, attention level, and autonomy constraints. This context influences tool selection, prompt construction, and risk assessment throughout the workflow's execution.

Learning systems connect through the reflection state, which provides structured comparison of expected versus actual outcomes. These reflection results feed into the knowledge graph as insights and patterns, closing the loop between experience and future behavior. The cognitive state machine doesn't learn directly—it provides the structured observations that downstream learning systems consume.

## Related Documentation

- [Cognitive Architecture Guide](cognitive-architecture.md) — Detailed implementation reference
- [Architecture Overview](../architecture/overview.md) — System-wide architecture context
- [Learning System](learning-system.md) — How reflection feeds into learning
- [Integration Patterns](integration-patterns.md) — How cognitive state composes with other systems
