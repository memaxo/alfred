# Manual Ticket Update Guide

**Date**: 2025-12-16  
**Purpose**: Detailed guide for manually updating Linear tickets with sizing and prioritization  
**Total Tickets**: 216

## Quick Start

### Option 1: Use Linear CLI (Recommended)

1. Install Linear CLI:
   ```bash
   brew install schpet/tap/linear
   # OR
   deno install -A --reload -f -g -n linear jsr:@schpet/linear-cli
   ```

2. Set API key:
   ```bash
   export LINEAR_API_KEY="lin_api_..."
   ```

3. Configure workspace:
   ```bash
   cd /Users/jackmazac/Development/alfred
   linear config
   ```

4. Run update script:
   ```bash
   bun scripts/size-linear-tickets.ts
   ```

### Option 2: Use GraphQL API Directly

See `scripts/size-linear-tickets.ts` for GraphQL mutation patterns.

### Option 3: Manual Updates via Linear Web UI

Use this guide to update tickets one by one in the Linear web interface.

## High-Priority Tickets (Update First)

### ALF-12: Add escalation status handling in runOrchestrator

**Current State**: In Progress, High, 2 pts  
**Recommended Updates**:
- ✅ Size: 2 pts (already correct)
- ✅ Priority: High (already correct)
- ✅ Status: **Done** (implementation verified)
- ✅ Comment: "Implementation verified in packages/runtime/src/orchestrator/index.ts:43-51. Code checks wavesResult.escalated and emits workflow_escalated events."

**Linear CLI Commands**:
```bash
linear issue update ALF-12 --state Done
linear issue comment add ALF-12 --body "Implementation verified in packages/runtime/src/orchestrator/index.ts:43-51. Code checks wavesResult.escalated and emits workflow_escalated events."
```

---

### ALF-72: Complete Personal Assistant Tools

**Current State**: In Progress, None, 5 pts  
**Recommended Updates**:
- ✅ Size: 5 pts (already correct)
- ✅ Priority: **High** (POC-critical: core assistant functionality)
- ✅ Status: **Done** (all tools complete)
- ✅ Labels: Feature, tools
- ✅ Comment: "Implementation verified: packages/agent/assistant/src/tool/home.ts (307 lines). All three tools (focus, web, home) are complete and registered."

**Linear CLI Commands**:
```bash
linear issue update ALF-72 --priority 2 --state Done
linear issue comment add ALF-72 --body "Implementation verified: packages/agent/assistant/src/tool/home.ts (307 lines). All three tools (focus, web, home) are complete and registered."
```

---

### ALF-134: Agent Tool Gaps: Expose Core System Capabilities as Tools

**Current State**: In Progress, Urgent, no estimate  
**Recommended Updates**:
- ✅ Size: **8 pts** (epic - multiple tool implementations)
- ✅ Priority: Urgent (already correct - POC-critical)
- ✅ Labels: Feature, tools, epic
- ✅ Comment: "Epic ticket. Consider breaking into subtasks: tool discovery (3 pts), tool registration (2 pts), tool execution (3 pts)"

**Linear CLI Commands**:
```bash
linear issue update ALF-134 --estimate 8
linear issue comment add ALF-134 --body "Epic ticket. Consider breaking into subtasks: tool discovery (3 pts), tool registration (2 pts), tool execution (3 pts)"
```

---

### ALF-89: Knowledge-Policy-Mindscape Integration

**Current State**: In Progress, None, 8 pts  
**Recommended Updates**:
- ✅ Size: 8 pts (already correct)
- ✅ Priority: **High** (strategic, enhances POC value)
- ✅ Labels: Feature, integration, strategic

**Linear CLI Commands**:
```bash
linear issue update ALF-89 --priority 2
```

---

### ALF-139: Simplify Auth Layer for Single-User Context

**Current State**: In Progress, High, no estimate  
**Recommended Updates**:
- ✅ Size: **5 pts** (refactoring, moderate complexity)
- ✅ Priority: **Medium** (tech debt, not POC-blocking)
- ✅ Labels: tech-debt, infrastructure

**Linear CLI Commands**:
```bash
linear issue update ALF-139 --estimate 5 --priority 3
```

---

### ALF-142: Consolidate Cognitive Architecture - Ship What Exists

**Current State**: In Progress, High, no estimate  
**Recommended Updates**:
- ✅ Size: **8 pts** (architectural refactoring)
- ✅ Priority: **Medium** (tech debt, can defer post-POC)
- ✅ Labels: tech-debt, architecture

**Linear CLI Commands**:
```bash
linear issue update ALF-142 --estimate 8 --priority 3
```

---

### ALF-143: Extract Shared Tool Functions (Not Interface)

**Current State**: In Progress, High, no estimate  
**Recommended Updates**:
- ✅ Size: **5 pts** (refactoring, code organization)
- ✅ Priority: **Medium** (tech debt, improves maintainability)
- ✅ Labels: tech-debt, refactoring

**Linear CLI Commands**:
```bash
linear issue update ALF-143 --estimate 5 --priority 3
```

---

### ALF-5: Critical Workflow Reliability Issues (Epic)

**Current State**: Backlog, Urgent, no estimate  
**Recommended Updates**:
- ✅ Size: **13 pts** (epic - should be broken down)
- ✅ Priority: Urgent (already correct)
- ✅ Labels: Bug, reliability, epic
- ✅ Comment: "Epic ticket. Review child tickets (ALF-9, ALF-10, ALF-11) and consider breaking down if needed."

**Linear CLI Commands**:
```bash
linear issue update ALF-5 --estimate 13
linear issue comment add ALF-5 --body "Epic ticket. Review child tickets (ALF-9, ALF-10, ALF-11) and consider breaking down if needed."
```

---

### ALF-6: High Priority Workflow Issues (Epic)

**Current State**: Backlog, High, no estimate  
**Recommended Updates**:
- ✅ Size: **13 pts** (epic - should be broken down)
- ✅ Priority: High (already correct)
- ✅ Labels: Feature, workflow, epic

**Linear CLI Commands**:
```bash
linear issue update ALF-6 --estimate 13
```

---

## Priority Framework for POC Phase

### Urgent (0-2 tickets max)
- Blockers preventing POC demonstration
- Critical bugs breaking core workflows
- Security vulnerabilities

**Current Urgent Tickets**: ALF-134, ALF-5

### High (5-10 tickets)
- Core features required for POC viability:
  - Workflow execution (AI SDK v6)
  - Basic assistant tools (notes, reminders, timers)
  - Voice interaction basics
  - Knowledge graph core functionality
  - Security/policy engine basics
- Critical infrastructure (database, auth)

**Current High Tickets**: ALF-72, ALF-89, ALF-6, ALF-12

### Medium (10-20 tickets)
- Enhancements adding POC value
- Nice-to-have features
- Performance optimizations
- UI improvements
- Non-critical technical debt

### Low (remainder)
- Post-POC features
- Non-critical technical debt
- Documentation improvements
- Advanced features

## Sizing Guidelines (Fibonacci Scale)

- **1 point**: Trivial (1-2 hours) - Simple bug fixes, docs, config changes
- **2 points**: Simple (2-4 hours) - Small features, simple refactoring, basic tests
- **3 points**: Moderate (4-8 hours) - Multi-file changes, features with dependencies
- **5 points**: Complex (8-16 hours) - Significant features, architectural changes
- **8 points**: Very Complex (16-32 hours) - Large features, major refactoring
- **13 points**: Epic (break down) - Multi-phase features, system-wide changes

## Label Strategy

### Type Labels
- `Feature`: New functionality
- `Bug`: Defects to fix
- `tech-debt`: Code quality improvements
- `Documentation`: Docs and guides
- `Infrastructure`: Build, deploy, monitoring

### Domain Labels
- `tools`: Agent tools
- `workflow`: Workflow execution
- `voice`: Voice system
- `knowledge`: Knowledge graph
- `ui`: User interface
- `api`: API layer
- `auth`: Authentication
- `testing`: Test coverage

### POC Indicators
- `poc-critical`: Required for POC
- `post-poc`: Can defer after POC

## Batch Update Script

For bulk updates, see `scripts/size-linear-tickets.ts`. Run with:

```bash
LINEAR_API_KEY="lin_api_..." bun scripts/size-linear-tickets.ts
```

The script will:
1. Fetch all open tickets
2. Analyze and size each ticket
3. Assign POC-appropriate priorities
4. Update tickets via GraphQL API
5. Generate summary report

## Verification Checklist

After updating tickets, verify:

- [ ] All high-priority tickets have estimates
- [ ] All tickets have priority assignments
- [ ] Status corrections applied (ALF-12, ALF-72 marked Done)
- [ ] Epics >8 points noted for breakdown
- [ ] Labels applied consistently
- [ ] Comments added for status changes

## Next Steps

1. **Immediate**: Update ALF-12 and ALF-72 to Done status
2. **This Week**: Update all high-priority tickets (ALF-134, ALF-89, ALF-139, ALF-142, ALF-143)
3. **This Month**: Process backlog tickets in batches of 50
4. **Ongoing**: Review and break down epics >8 points

---

**Report Generated**: 2025-12-16  
**Next Review**: After API key is available for automated updates
