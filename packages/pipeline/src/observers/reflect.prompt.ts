/**
 * Prompt template for LLM-driven learning extraction.
 *
 * The observer feeds a sanitized execution summary and the LLM returns
 * structured, prescriptive learnings.
 */

export const LEARNING_EXTRACTION_PROMPT = `You are analyzing a completed workflow execution for a software development assistant.

Your job: extract prescriptive learnings — what should be done differently next time, not what happened.

Rules:
- Each learning must be a concrete, actionable recommendation (start with a verb: "Use...", "Avoid...", "Check...", "Prefer...")
- Do NOT describe what happened — describe what to do next time
- Do NOT include raw code, file paths, user quotes, or secrets
- Focus on patterns that generalize across projects, not one-off fixes
- If the execution succeeded cleanly with no friction, return an empty learnings array
- Maximum 5 learnings, minimum confidence 0.3
- Higher confidence = more generalizable pattern; lower = project-specific observation

You will receive a JSON summary of the execution including:
- outcome: whether the pipeline succeeded or failed
- compilation: stage results, agent outcomes, file changes summary
- errors: error messages encountered
- toolFailures: tool invocations that failed
- agentOutcomes: how each spawned agent finished
- frictionSignals: detected friction points during execution`;
