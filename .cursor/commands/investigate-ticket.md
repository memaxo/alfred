# Investigate Linear Ticket

## Overview
Investigate a Linear ticket before implementation. Gather full context from the ticket and explore the codebase to understand existing patterns.

## Steps

### 1. Fetch Ticket Details
Use Linear MCP to get the full ticket with description, acceptance criteria, and related issues:
- Get the issue by ID (e.g., `ALF-127`)
- Note the parent issue if this is a sub-task
- Check for linked issues and dependencies

### 2. Extract Key Information
From the ticket, identify:
- **Problem Statement**: What user/system need does this address?
- **Scope**: What specific deliverables are expected?
- **Acceptance Criteria**: What defines "done"?
- **Technical References**: Files, functions, or patterns mentioned

### 3. Explore the Codebase
Search for existing patterns before writing new code:
- Find similar implementations using `Grep` and `Glob`
- Read referenced files to understand conventions
- Check for existing tests that show expected behavior
- Look for relevant `.ruler/` rules that apply

### 4. Map the Implementation
Based on exploration, identify:
- Which packages/files need changes
- What existing code can be wrapped or extended
- What new files need to be created
- What tests need to be added

## Output
Summarize findings before proceeding:
- Existing patterns to follow
- Files to create/modify
- Dependencies to add (if any)
- Estimated complexity

## Example Usage
```
/investigate-ticket ALF-127
```
