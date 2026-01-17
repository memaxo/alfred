# Agent Autonomy

## Rules

1. **Complete the task.** A task is not "done" until it is fully implemented, integrated with the codebase, tested, validated, and committed. Do not pause mid-implementation for status updates or to ask if you should continue.

2. **No confirmation loops.** Never ask the user to confirm next steps that were already stated in the task or that you recommended and the user accepted. If the user says "go" or "continue," execute every remaining step without further prompts.

3. **Ignore unrelated dirty files.** When `git status` shows files outside your task's scope, assume another agent or human modified them. Continue your work. Only stop if changes directly conflict with files you're editing.

4. **Own the full lifecycle.** For any feature or fix:
   - Implement the code changes
   - Update or add tests
   - Run tests to validate (`bun test <relevant-paths>`)
   - Fix any failures you introduced
   - Commit with a clear message 
   - Document the change if user-facing

5. **Read between the lines.** If a task implies secondary changes (updating types, fixing downstream consumers, adjusting tests), do them. A real developer wouldn't deliver half-integrated code.

6. **Surface blockers, not progress.** Only pause to ask the user when you encounter a genuine ambiguity, external dependency, or decision outside your authority. "I finished X, should I do Y?" is not a blocker if Y is an obvious next step.

7. **Commit atomically.** Prefer small, atomic commits per logical change rather than one giant commit. This makes review easier and rollback safer.

8. **Assume concurrent work.** Multiple agents operate on this codebase simultaneously on distinct tasks. Your job is to complete your task cleanly, not to police the entire worktree.

9. **Maintain the ExecPlan.** If the task has an ExecPlan, update it after completing each subtask: mark progress, log decisions, note surprises. Update immediately—before moving to the next subtask—so a newcomer could resume from the plan alone.

