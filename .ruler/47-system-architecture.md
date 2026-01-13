# System Architecture Discipline

## Core Principle

Complex systems fragment when features are added without architectural contracts. Every system exceeding 500 lines or 3 files requires explicit boundaries, extension models, and state management before implementation begins.

## Architecture Contract (Required for Complex Systems)

1. **Define before building.** Any system expected to exceed 500 lines or span 3+ files must have a written architecture contract before implementation. The contract answers: What does this system do? What does it NOT do? How is it extended? How does state flow?

2. **Single-sentence responsibility.** Every system, module, and file must have a responsibility expressible in one sentence without "and". If you need "and", you have two responsibilities—split them.

3. **Explicit boundaries.** Draw the boundary between your system and others before writing code. Document: What crosses in? What crosses out? What format? The boundary is the API contract.

4. **Extension model upfront.** Before building, decide how the system will be extended: observers, middleware, plugins, or inheritance. Document this. "Modify the core" is not an extension model.

## Feature Placement (The "Where Does This Go?" Test)

5. **Responsibility audit.** Before adding a feature, list the system's current responsibilities. If the feature doesn't fit an existing responsibility, it either (a) belongs elsewhere, or (b) requires architectural revision. Never "just add it."

6. **One-hop rule.** A feature should interact with at most one layer of the system. If implementing a feature requires touching orchestration AND persistence AND events AND external APIs, the feature is too coupled or the boundaries are wrong.

7. **The stranger test.** If a new developer would be surprised to find this feature in this file/module, it's in the wrong place. Code location should be predictable from responsibility.

8. **Callback smell.** Adding a callback to an interface is a design smell. It means you're threading a concern through the system instead of separating it. Prefer observer/event patterns over callback accumulation.

## Code Extraction (When to Create Files)

9. **Abstraction before extraction.** Never extract code because a file is "too long." Extract only when: (a) a clear abstraction has emerged, (b) the extraction has a stable interface, (c) the extraction is cohesive. Size is not a reason.

10. **Minimum viable module.** A file should contain at least 100 lines OR represent a complete, stable abstraction. Files under 50 lines with 1-2 exports are almost always premature extraction.

11. **Directory purpose.** Every directory must have a clear, documented purpose. If you can't explain what ALL files in a directory have in common, the directory structure is wrong.

12. **Merge before split.** If two files have overlapping responsibilities or would be edited together for most changes, merge them. Cohesion beats small files.

## State Management

13. **No closure state for complex systems.** Systems exceeding 200 lines must not use closure variables for state. Use explicit state containers (context objects, state machines, stores) that can be inspected and tested.

14. **State must be typed.** All state must have explicit TypeScript types. `unknown`, `any`, or untyped closures are forbidden in state management.

15. **Observable transitions.** State changes in complex systems should emit events or be otherwise observable. Silent state mutations make debugging impossible.

## Communication Patterns

16. **Events over callbacks.** Prefer emitting events to a registry over passing callbacks through call chains. Events decouple; callbacks couple.

17. **Return values over side effects.** Functions should return their results, not mutate external state. Side effects (logging, metrics, persistence) belong in observers or at boundaries.

18. **Explicit dependencies.** If a module needs something, it should receive it as a parameter or import it explicitly. Implicit dependencies via closures or globals are forbidden.

## Architectural Review Triggers

19. **Review threshold.** Any system exceeding 1,000 lines total, 5 files, or 3 directories requires architectural review before further features are added. The review asks: Is this still coherent? Are boundaries clear? Is the extension model working?

20. **Refactor before extend.** If adding a feature requires modifying more than 3 files or touching code you don't fully understand, stop. The system needs refactoring before the feature, not after.

21. **Complexity budget.** Each system has a complexity budget. Adding a feature spends complexity. If a feature would push the system past its budget (subjective but real), redesign or split the system first.

## Anti-Pattern Recognition

22. **God object.** An interface or class that accumulates unrelated responsibilities. Symptom: callbacks or methods that don't all relate to each other. Fix: Split by responsibility.

23. **Feature accretion.** Each feature "just" added without architectural consideration. Symptom: 500+ line functions, 10+ parameters, unclear boundaries. Fix: Define architecture contract, refactor to it.

24. **Premature extraction.** Files created because "this function was getting long." Symptom: Many small files (< 50 lines) that are always edited together. Fix: Merge, then extract by abstraction.

25. **Implicit coupling.** Systems that can't be tested or understood without running the whole thing. Symptom: Mocking 10+ dependencies for a unit test. Fix: Explicit dependencies, explicit state, clear boundaries.
