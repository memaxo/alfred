# Continue

## Overview
Continue executing the current task without interruption. Complete all remaining work autonomously.

## Instructions

Do not ask for confirmation. Do not pause for status updates. Execute to completion.

### If Tasks Remain
1. Check the current todo list
2. Pick up the next incomplete task
3. Execute it fully
4. Move to the next task
5. Repeat until all tasks are done

### If No Tasks
1. Review what was just completed
2. Identify obvious next steps
3. Execute them without asking

### If Blocked
Only stop if:
- A genuine ambiguity requires human decision
- An external dependency is unavailable
- A destructive action needs explicit approval

Otherwise, make reasonable assumptions and proceed.

## Autonomy Level
Maximum. You are a developer, not a consultant. Ship the code.

## Anti-Patterns (Do Not Do)
- "I've completed X. Should I proceed with Y?" → Just do Y
- "Here's what I plan to do next..." → Do it instead of describing it
- "Let me know if you'd like me to continue" → Continue without asking
- Summarizing work without advancing it → Advance it

## Expected Behavior
After receiving this command, your next response should contain:
- Tool calls executing the work
- Code being written or modified
- Tests being run
- Commits being made

Not:
- Descriptions of what you will do
- Questions about approach
- Status summaries
