#!/usr/bin/env bun

/**
 * Script to delegate Linear tickets to Cursor background agents
 *
 * This script:
 * 1. Gets issue details for each ticket
 * 2. Updates delegate field to "Cursor"
 * 3. Creates customized instruction comments
 *
 * Usage: bun scripts/delegate-linear-tickets.ts
 */

// This script would use Linear MCP tools, but since we're running it via MCP,
// we'll process tickets directly using the MCP tools in the main execution

// Ticket list with customization data
export const TICKETS = [
  {
    id: "ALF-87",
    scope: "packages/knowledge/src/extractor.ts, learning worker",
    keyPatterns: "Domain detection, confidence boosting",
    tests: "packages/knowledge/test/",
  },
  {
    id: "ALF-89",
    scope: "Part 3 only: ConceptNode component, visualize procedure",
    keyFiles:
      "apps/web/src/components/mindscape/, packages/api/src/routers/knowledge.ts",
    tests: "Mindscape component tests",
  },
  {
    id: "ALF-143",
    scope: "Extract to packages/agent/src/orchestrator/tool/shared/",
    keyPatterns: "No DI, pure functions, no interfaces",
    tests: "Shared function tests",
  },
  {
    id: "ALF-139",
    scope: "Audit auth flows, simplify policy checks",
    keyFiles: "packages/policy/, packages/auth/",
    tests: "Auth integration tests",
  },
  {
    id: "ALF-142",
    scope: "Audit and complete/remove cognitive components",
    keyFiles: "packages/cognitive/",
    tests: "Cognitive integration tests",
  },
  {
    id: "ALF-72",
    scope: "Complete home.ts tool only",
    keyFiles: "packages/agent/assistant/src/tool/home.ts",
    tests: "Home tool tests",
  },
  {
    id: "ALF-113",
    scope: "Manual E2E testing",
    key: "Test with real Linear workspace",
  },
  {
    id: "ALF-122",
    scope: "Complete remaining regression tests",
    keyFiles: "apps/web/src/test/, apps/web/tests/",
  },
  {
    id: "ALF-131",
    scope: "Implement Home Assistant provider",
    keyFiles:
      "packages/agent/assistant/src/tool/home/providers/homeassistant.ts",
    tests: "Home automation integration tests",
  },
  {
    id: "ALF-12",
    scope: "Add escalation check in runOrchestrator",
    keyFiles: "packages/runtime/src/orchestrator/index.ts",
    tests: "Workflow escalation tests",
  },
  {
    id: "ALF-18",
    scope: "Make stuck detection thresholds configurable",
    keyFiles: "packages/agent/src/orchestrator/multi/tracker.ts",
    tests: "Stuck detection tests",
  },
  {
    id: "ALF-20",
    scope: "Persist review gate state",
    keyFiles: "packages/agent/src/workflow/orchestrator.ts",
    tests: "Review gate persistence tests",
  },
  {
    id: "ALF-22",
    scope: "Add orchestrator escalation tests",
    keyFiles: "packages/runtime/test/orchestrator.escalation.test.ts",
    tests: "New test suite",
  },
  {
    id: "ALF-23",
    scope: "Add conflict arbiter tests",
    keyFiles: "packages/agent/test/conflict.arbiter.test.ts",
    tests: "New test suite",
  },
  {
    id: "ALF-79",
    scope: "Create timer route",
    keyFiles: "apps/web/src/routes/timer.tsx",
    tests: "Timer route tests",
  },
  {
    id: "ALF-70",
    scope: "Feature inventory summary doc",
    keyFiles: "docs/",
  },
] as const;

export function generateCommentTemplate(issue: {
  title: string;
  description: string;
  scope?: string;
  keyFiles?: string;
  keyPatterns?: string;
  tests?: string;
}): string {
  const { title, description, scope, keyFiles, keyPatterns, tests } = issue;

  return `@Cursor Agent Assignment

## Task
${title}

## Scope
${scope || "See issue description for details"}

${
  keyFiles
    ? `## Key Files
${keyFiles}`
    : ""
}

${
  keyPatterns
    ? `## Key Patterns
${keyPatterns}`
    : ""
}

## Duties

Complete the following in order:

1. **Implementation**
   - [ ] Read and understand the issue requirements
   - [ ] Implement the feature/fix according to project standards
   - [ ] Follow single-word naming conventions (\`.ruler/01-naming-conventions.md\`)
   - [ ] Adhere to architecture patterns (\`.ruler/02-architecture.md\`)

2. **Code Quality**
   - [ ] Review your own work before committing
   - [ ] Validate code adheres to all project standards in \`.ruler/\`
   - [ ] Run \`bun run typecheck\` and fix all type errors
   - [ ] Run \`bun run lint\` (or \`npx ultracite check\`) and fix all issues
   - [ ] Ensure zero type suppressions unless absolutely necessary

3. **Testing**
   - [ ] Run existing relevant tests: \`bun test ${tests || "[package-path]"}\`
   - [ ] Add new tests for new functionality
   - [ ] Ensure test coverage meets project thresholds (80% repos, 60% routers)
   - [ ] Verify all tests pass before completing

4. **Documentation**
   - [ ] Add concise documentation if feature is user-facing
   - [ ] Update relevant docs in \`docs/\` if architecture changes
   - [ ] Add 1-2 rules max in nested \`.ruler/\` directory if patterns emerge
   - [ ] Follow documentation naming conventions (lowercase kebab-case)

5. **Completion**
   - [ ] Update Linear issue status to "Done" when complete
   - [ ] Add completion comment with summary of changes
   - [ ] Reference commit hash in completion comment

${
  keyFiles
    ? `## Key Files/Patterns
${keyFiles}`
    : ""
}

## Related Issues
See issue description for related issues and dependencies.
`;
}
