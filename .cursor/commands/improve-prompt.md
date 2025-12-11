# Improve Prompt for AI

## Overview
Take a draft prompt and improve it for clarity, specificity, and effectiveness when given to another AI system.

## Improvement Principles

### 1. Structure
- Add clear sections with headers
- Use numbered steps for sequences
- Use bullet points for lists
- Separate context from instructions from constraints

### 2. Specificity
- Replace vague words with concrete ones
- Add examples of expected output
- Specify format requirements explicitly
- Define edge cases and how to handle them

### 3. Context
- State the goal upfront
- Explain why this matters
- Provide relevant background
- Define key terms if ambiguous

### 4. Constraints
- State what NOT to do
- Set boundaries on output length
- Specify tone and style
- List forbidden patterns

### 5. Examples
- Show input/output pairs
- Include edge cases
- Demonstrate the format

## Transformation Process

### Step 1: Identify the Core Intent
What does the user actually want the AI to do?

### Step 2: Extract Implicit Requirements
What's assumed but not stated?
- Output format?
- Length constraints?
- Tone?
- Audience?

### Step 3: Add Structure
Reorganize into:
```markdown
## Goal
[One sentence: what to accomplish]

## Context
[Background the AI needs]

## Instructions
[Step-by-step what to do]

## Constraints
[What to avoid, limits]

## Output Format
[Exactly how to structure response]

## Examples (if helpful)
[Input → Output demonstrations]
```

### Step 4: Sharpen Language
- "Make it better" → "Improve readability by shortening sentences to <20 words"
- "Be creative" → "Generate 3 distinct approaches, each with different trade-offs"
- "Help me with" → "Produce a [specific deliverable] that [specific criteria]"

### Step 5: Add Escape Hatches
- What if the AI can't do it?
- What if input is ambiguous?
- What if multiple interpretations exist?

## Anti-Patterns to Fix

| Vague | Specific |
|-------|----------|
| "Write good code" | "Write TypeScript with explicit return types, error handling, and JSDoc comments" |
| "Be concise" | "Response under 200 words" |
| "Follow best practices" | "Follow the patterns in [reference file]" |
| "Make it professional" | "Use formal tone, no contractions, third person" |
| "Help me understand" | "Explain in 3 levels: one-sentence summary, paragraph overview, detailed breakdown" |

## Output Format

Return the improved prompt in a code block:

```markdown
## [Title]

### Goal
[Clear objective]

### Context
[Relevant background]

### Instructions
1. [First step]
2. [Second step]
...

### Constraints
- [What to avoid]
- [Limits]

### Output Format
[Exact structure expected]

### Examples
**Input**: [example]
**Output**: [example]
```

Then briefly explain what was improved and why.
