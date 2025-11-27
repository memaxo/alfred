# Linear Features: Underutilized Capabilities & Recommendations

**Date**: 2025-01-27  
**Purpose**: Identify Linear features not currently leveraged that could improve workflow and project management

## Currently Used Features ✅

- ✅ **Issues** - Basic issue tracking
- ✅ **Epics** - Parent issue grouping (ALF-134)
- ✅ **Parent-Child Relationships** - Issue hierarchy
- ✅ **Projects** - Issue organization (6 projects)
- ✅ **Labels** - Categorization (tools, tech-debt, Feature, etc.)
- ✅ **Priorities** - Urgent, High, Medium, Low
- ✅ **Statuses** - Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate
- ✅ **Git Branch Names** - Auto-generated from issue titles
- ✅ **Comments** - Issue discussion
- ✅ **Agent Activities** - Real-time progress updates via API
- ✅ **Webhooks** - Bidirectional sync
- ✅ **Linear API** - GraphQL integration

---

## Underutilized Features (High Value)

### 1. **Cycles** ⭐⭐⭐ (High Priority)

**Current State**: No cycles configured (`list_cycles` returns empty)

**What It Is**: Time-boxed sprints/iterations for planning and tracking

**Benefits**:
- **Sprint Planning**: Group issues into 2-week cycles
- **Velocity Tracking**: Measure completion rate per cycle
- **Focus**: Clear sprint goals and scope boundaries
- **Burndown**: Visual progress tracking

**Recommendation**:
- Create 2-week cycles aligned with development sprints
- Assign high-priority issues to current cycle
- Use cycle completion rate to measure team velocity
- Track ExecPlan completion per cycle

**Implementation**:
Cycles must be created manually in Linear UI or via GraphQL API (Linear MCP does not support cycle creation):

**Option 1: Manual Creation (Recommended)**
1. Go to Linear → Team Settings → Cycles
2. Click "Create Cycle"
3. Set duration: 2 weeks
4. Set start date: Today
5. Auto-assign high-priority issues to cycle

**Option 2: GraphQL API**
```graphql
mutation CreateCycle {
  cycleCreate(
    input: {
      teamId: "4081afaf-ff4e-42ac-a53b-19f02406c1fc"
      name: "2025-01-27 - 2025-02-10"
      startDate: "2025-01-27"
      endDate: "2025-02-10"
});
```

**Impact**: High - Better sprint planning and progress visibility

---

### 2. **Issue Estimates** ⭐⭐⭐ (High Priority)

**Current State**: No estimates set on any issues

**What It Is**: Story points or time estimates for capacity planning

**Benefits**:
- **Capacity Planning**: Know how much work fits in a cycle
- **Prioritization**: Compare effort vs impact
- **Velocity**: Track story points completed per cycle
- **Sprint Planning**: Fill cycles based on capacity

**Recommendation**:
- Add estimates to all issues (story points: 1, 2, 3, 5, 8, 13)
- Use estimates for cycle capacity planning
- Track velocity metrics
- Prioritize high-impact, low-effort issues

**Example**:
- ALF-126 (Knowledge Graph Tools): 5 points
- ALF-127 (RAG Tools): 3 points
- ALF-131 (Home Tool): 8 points

**Impact**: High - Better planning and resource allocation

---

### 3. **Issue Relations (Blocks/Relates To)** ⭐⭐⭐ (High Priority)

**Current State**: Only using parent-child (epic → issue). No "blocks" or "relates to" relations.

**What It Is**: Link issues that depend on each other or are related

**Benefits**:
- **Dependency Tracking**: ALF-128 blocks on ALF-126
- **Impact Analysis**: See what breaks if an issue is delayed
- **Visual Dependencies**: Linear shows dependency graphs
- **Better Planning**: Work on blockers first

**Recommendation**:
- Link ALF-128 → "blocks" → ALF-126 (Knowledge Correction requires Knowledge Tools)
- Link ALF-129 → "blocks" → ALF-126 (Learning Tools require Knowledge Graph)
- Use "relates to" for issues that share context but don't block

**Impact**: High - Prevents blocked work and improves sequencing

---

### 4. **Due Dates** ⭐⭐ (Medium Priority)

**Current State**: No due dates set on issues

**What It Is**: Target completion dates for issues

**Benefits**:
- **Deadline Tracking**: Visual indicators for overdue issues
- **Sprint Boundaries**: Issues due within cycle
- **Priority Signals**: Urgent issues get near-term dates
- **Filtering**: Query issues due soon

**Recommendation**:
- Set due dates for urgent/high-priority issues
- Align with cycle end dates for sprint work
- Use for milestone tracking (e.g., PRD phase deadlines)

**Impact**: Medium - Better deadline awareness and prioritization

---

### 5. **Assignees** ⭐⭐ (Medium Priority)

**Current State**: Most issues unassigned. Only delegate assignment used for Linear agent.

**What It Is**: Assign issues to team members for ownership

**Benefits**:
- **Ownership**: Clear responsibility
- **Workload Visibility**: See who's overloaded
- **Notifications**: Assigned users get updates
- **Filtering**: "My Issues" view

**Recommendation**:
- Assign issues to specific team members
- Use for workload balancing
- Enable "My Issues" filtering
- Track assignment patterns

**Impact**: Medium - Better ownership and workload distribution

---

### 6. **Custom Fields** ⭐⭐ (Medium Priority)

**Current State**: Using default Linear fields only

**What It Is**: Custom metadata fields for domain-specific tracking

**Potential Custom Fields**:
- **ExecPlan Path** - Link to `docs/execplans/` file
- **Package** - Which package(s) affected (`@alfred/agent`, `@alfred/api`, etc.)
- **PRD Phase** - Link to PRD phase (4.3, 5.2, etc.)
- **Performance Budget** - Target latency/budget
- **Test Coverage** - Current coverage percentage

**Benefits**:
- **Structured Metadata**: Query by package, phase, etc.
- **Reporting**: Generate reports by custom fields
- **Filtering**: Find all issues for a package
- **Automation**: Auto-populate from issue templates

**Recommendation**:
- Create custom fields for ExecPlan path, Package, PRD Phase
- Use for filtering and reporting
- Auto-populate via issue templates

**Impact**: Medium - Better organization and querying

---

### 7. **Issue Templates** ⭐⭐ (Medium Priority)

**Current State**: Manual issue creation, inconsistent formats

**What It Is**: Pre-filled issue templates for common types

**Potential Templates**:
- **ExecPlan Issue** - Pre-filled with ExecPlan structure
- **Tool Implementation** - Standard tool issue format
- **Bug Report** - Structured bug template
- **Feature Request** - Feature specification format

**Benefits**:
- **Consistency**: All issues follow same format
- **Speed**: Faster issue creation
- **Completeness**: Ensures all required fields
- **Automation**: Auto-populate custom fields

**Recommendation**:
- Create templates for ExecPlan, Tool, Bug, Feature types
- Include custom fields in templates
- Link templates to projects

**Impact**: Medium - Faster creation and better consistency

---

### 8. **Milestones** ⭐⭐ (Medium Priority)

**Current State**: No milestones configured

**What It Is**: Major release markers or version targets

**Benefits**:
- **Release Planning**: Group issues by release
- **Progress Tracking**: Visual progress toward milestone
- **Communication**: Clear release goals
- **Filtering**: Query issues for a milestone

**Recommendation**:
- Create milestones for PRD phases (Phase 4, Phase 5, etc.)
- Create milestones for major releases (v1.0, v2.0)
- Link issues to milestones
- Track milestone completion

**Impact**: Medium - Better release planning and tracking

---

### 9. **Sub-Issues** ⭐ (Low Priority)

**Current State**: Using parent-child (epic → issue) but not sub-issues

**What It Is**: Break large issues into smaller, trackable sub-tasks

**Benefits**:
- **Granular Tracking**: Track progress on large issues
- **Parallel Work**: Multiple sub-issues can be worked simultaneously
- **Completion**: Clear checklist for issue completion

**Recommendation**:
- Use for large ExecPlans (break into phases)
- Use for complex tool implementations (break into actions)
- Track sub-issue completion

**Impact**: Low - Better progress tracking for large issues

---

### 10. **Automations** ⭐⭐ (Medium Priority)

**Current State**: No automations configured

**What It Is**: Auto-actions based on triggers (status changes, assignments, etc.)

**Potential Automations**:
- **Auto-assign to cycle** - When issue moves to "In Progress", add to current cycle
- **Auto-label** - When issue created in project, add project label
- **Auto-status** - When all sub-issues done, mark parent "Done"
- **Auto-comment** - When issue blocked, comment with blocker info

**Benefits**:
- **Reduced Manual Work**: Automatic status/label updates
- **Consistency**: Enforce workflows automatically
- **Notifications**: Auto-notify on status changes
- **Workflow Enforcement**: Ensure proper issue progression

**Recommendation**:
- Create automation: "When issue moves to In Progress → add to current cycle"
- Create automation: "When all sub-issues Done → mark parent Done"
- Create automation: "When issue created → add project label"

**Impact**: Medium - Reduces manual work and enforces workflows

---

### 11. **Views** ⭐⭐ (Medium Priority)

**Current State**: Using default Linear views

**What It Is**: Custom filtered/sorted views of issues

**Potential Views**:
- **My Issues** - Assigned to me, in current cycle
- **High Priority Backlog** - Urgent/High priority, Backlog status
- **ExecPlans In Progress** - ExecPlan issues, In Progress status
- **Tool Implementation** - Issues with "tools" label, Backlog
- **Blocked Issues** - Issues with "blocks" relations

**Benefits**:
- **Quick Access**: Common queries saved as views
- **Focus**: Filter out noise
- **Reporting**: Generate reports from views
- **Team Alignment**: Shared views for team

**Recommendation**:
- Create views for common queries
- Share views with team
- Use views for daily standups
- Create views for each project

**Impact**: Medium - Faster access to relevant issues

---

### 12. **Roadmaps** ⭐ (Low Priority)

**Current State**: No roadmaps configured

**What It Is**: Visual timeline of projects and milestones

**Benefits**:
- **Visual Planning**: See project timeline
- **Dependency Visualization**: See how projects relate
- **Stakeholder Communication**: Clear roadmap view
- **Timeline Management**: Track project dates

**Recommendation**:
- Create roadmap for PRD phases
- Create roadmap for Strategic Initiatives
- Link projects to roadmap
- Update roadmap as plans change

**Impact**: Low - Better visual planning (nice-to-have)

---

### 13. **Attachments** ⭐ (Low Priority)

**Current State**: Not using attachments

**What It Is**: Attach files, screenshots, diagrams to issues

**Benefits**:
- **Context**: Attach ExecPlan files, diagrams, screenshots
- **Reference**: Link to external documents
- **Documentation**: Keep related files with issues

**Recommendation**:
- Attach ExecPlan markdown files to ExecPlan issues
- Attach architecture diagrams to strategic issues
- Attach screenshots to bug reports

**Impact**: Low - Better context and documentation

---

## Priority Recommendations

### Immediate (This Week)

1. **Create Cycles** - Set up 2-week sprint cycles
2. **Add Estimates** - Add story points to all issues
3. **Link Dependencies** - Use "blocks" relations for dependent issues

### Short-term (This Month)

4. **Set Due Dates** - Add due dates for urgent/high-priority issues
5. **Assign Issues** - Assign issues to team members
6. **Create Issue Templates** - Templates for ExecPlan, Tool, Bug types
7. **Set Up Automations** - Auto-cycle assignment, auto-status updates

### Long-term (This Quarter)

8. **Custom Fields** - Add ExecPlan path, Package, PRD Phase fields
9. **Create Views** - Custom views for common queries
10. **Milestones** - Create milestones for PRD phases/releases

---

## Implementation Guide

### Setting Up Cycles

```typescript
// Example: Create 2-week cycle
const cycle = await linearClient.createCycle({
  teamId: "alfred-ops-team-id",
  name: "Sprint 2025-01-27",
  startDate: "2025-01-27",
  endDate: "2025-02-10",
});
```

### Adding Estimates

```typescript
// Update issue with estimate
await linearClient.updateIssue({
  id: issueId,
  estimate: 5, // Story points
});
```

### Linking Dependencies

```typescript
// Link ALF-128 as blocking on ALF-126
await linearClient.createIssueRelation({
  issueId: "ALF-128-id",
  relatedIssueId: "ALF-126-id",
  type: "blocks", // or "relates"
});
```

### Creating Custom Fields

1. Go to Linear Settings → Custom Fields
2. Create fields:
   - **ExecPlan Path** (Text)
   - **Package** (Select: @alfred/agent, @alfred/api, etc.)
   - **PRD Phase** (Text)
3. Add to issue templates

### Setting Up Automations

1. Go to Linear Settings → Automations
2. Create rules:
   - **When**: Issue status → "In Progress"
   - **Then**: Add to current cycle
3. Create rules:
   - **When**: All sub-issues → "Done"
   - **Then**: Update parent status → "Done"

---

## Expected Benefits

### Planning
- ✅ Better sprint capacity planning (estimates + cycles)
- ✅ Clear dependency visualization (blocks relations)
- ✅ Realistic timelines (due dates + estimates)

### Execution
- ✅ Focused work (cycle assignments)
- ✅ Clear ownership (assignees)
- ✅ Automated workflows (automations)

### Tracking
- ✅ Progress visibility (cycle burndown)
- ✅ Velocity metrics (estimates completed)
- ✅ Dependency awareness (blocks visualization)

### Organization
- ✅ Consistent structure (templates)
- ✅ Rich metadata (custom fields)
- ✅ Quick access (views)

---

## Next Steps

1. **Audit Current Issues**: Review all issues and add estimates
2. **Create First Cycle**: Set up 2-week cycle starting today
3. **Link Dependencies**: Identify and link blocking relationships
4. **Set Up Templates**: Create ExecPlan and Tool templates
5. **Configure Automations**: Set up cycle assignment automation

---

## Notes

- Most features are available via Linear API
- Can be automated via existing Linear integration
- Low effort, high value improvements
- Will significantly improve planning and tracking

