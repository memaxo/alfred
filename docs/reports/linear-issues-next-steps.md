# Linear Issues: Recommended Next Steps

**Date**: 2025-01-27  
**Status**: Issues updated, recommendations for follow-up

## ✅ Completed Actions

1. ✅ Updated ALF-76 to reflect web tool exists
2. ✅ Updated ALF-77 with correct paths and duplicate notice
3. ✅ Updated ALF-72 to show partial completion (2/3 tools)
4. ✅ Updated ALF-131 with correct paths and duplicate notice
5. ✅ Added comment to ALF-77 recommending closure

---

## 🎯 Immediate Next Steps (Priority: High)

### 1. Close Duplicate Issue

**Action**: Close ALF-77 as duplicate of ALF-131

**Rationale**:
- ALF-131 is more comprehensive
- ALF-131 is part of epic ALF-134 (Agent Tool Gaps)
- Both issues now reference each other
- ALF-77 has been marked with duplicate notice

**Steps**:
1. Review ALF-77 to ensure no unique information
2. Close ALF-77 with status "Duplicate"
3. Link ALF-77 → ALF-131 as duplicate relationship
4. Update ALF-131 to note ALF-77 closure

---

### 2. Verify Issue Status Accuracy

**Action**: Review ALF-76 to determine if it should be closed or repurposed

**Options**:
- **Option A**: Close as "Already Implemented" if tool is complete
- **Option B**: Repurpose to track enhancements/improvements
- **Option C**: Keep open for verification/testing tasks

**Recommendation**: Option B - Repurpose to track:
- Test coverage verification
- Documentation improvements
- Usage pattern documentation
- Performance optimization if needed

**Steps**:
1. Review current test coverage for `web.ts` assistant tool
2. Update ALF-76 acceptance criteria to reflect verification tasks
3. Change title to "Verify and Enhance web.ts Assistant Tool"

---

### 3. Update Project Assignments

**Action**: Consolidate related tool issues into consistent projects

**Current State**:
- ALF-76, ALF-77 → "ALFRED Roadmap"
- ALF-72 → "ALFRED Feature Inventory"
- ALF-131 → "Technical Debt & Improvements" (part of ALF-134 epic)

**Recommendation**: 
- Keep ALF-131 in "Technical Debt & Improvements" (epic parent)
- Move ALF-76 to "Technical Debt & Improvements" if keeping open
- Keep ALF-72 in "ALFRED Feature Inventory" (it's a feature inventory item)

**Rationale**: 
- Epic children should be in same project as epic
- Feature inventory items are documentation, not work items
- Roadmap items should be actionable work

---

## 📋 Medium Priority Actions

### 4. Create Issue Status Verification Process

**Action**: Establish process to prevent future inaccuracies

**Proposed Process**:
1. **Before creating issue**: Verify actual codebase state
2. **Before marking complete**: Verify implementation exists
3. **Quarterly audit**: Review all issues for accuracy
4. **Automation**: Consider script to verify file paths in issues

**Implementation**:
- Add to `.ruler/` documentation
- Create verification script: `scripts/verify-linear-issues.ts`
- Document in team wiki/onboarding

---

### 5. Standardize Labels

**Action**: Apply consistent labels to tool-related issues

**Proposed Standard**:
- **All tool issues**: `tools` + `Feature`
- **Tech debt tools**: `tools` + `tech-debt` + `Feature`
- **API-related tools**: `tools` + `api` + `Feature`

**Issues to Update**:
- ALF-76: Add `tools` label
- ALF-77: Add `tools` label (if keeping open)
- ALF-131: Already has `tools` ✅
- ALF-72: Add `tools` label

---

### 6. Update Epic Status

**Action**: Review ALF-134 epic status based on child issue states

**Current Child Issues**:
- ALF-126: Knowledge Graph Tools (Backlog)
- ALF-127: RAG Tools (Backlog)
- ALF-128: Knowledge Correction (Backlog)
- ALF-129: Learning Tools (Backlog)
- ALF-130: Preference Tools (Backlog)
- ALF-131: Home Tool (Backlog) ← Just updated
- ALF-132: Cognitive State (Backlog)
- ALF-133: Voice Control (Backlog)

**Recommendation**: 
- Epic status is correct (Backlog)
- Consider prioritizing high-priority items (ALF-126, ALF-127)
- Update epic description if any child issues change status

---

## 🔍 Low Priority Actions

### 7. Audit Other Tool-Related Issues

**Action**: Review other tool issues for similar inaccuracies

**Issues to Check**:
- ALF-41: Web Research Tool (Feature Inventory)
- ALF-37-43: Other orchestrator tools
- Any issues mentioning file paths

**Method**:
- Search Linear for issues with file paths
- Verify paths against codebase
- Check status claims against implementation

---

### 8. Update Documentation

**Action**: Update PRD and status reports

**Files to Update**:
- `docs/alfred-prd.md` - Phase 4.3 status
- `docs/reports/prd-implementation-status.md` - Web tool status
- `docs/reports/linear-issues-audit.md` - Mark actions complete

**Changes**:
- Mark web tool as complete in PRD
- Update Phase 4.3 to show 2/3 tools done
- Add note about ALF-77 duplicate closure

---

### 9. Create Verification Script

**Action**: Build automated verification tool

**Script**: `scripts/verify-linear-issues.ts`

**Capabilities**:
- Check file paths mentioned in issue descriptions
- Verify implementation status claims
- Flag potential duplicates
- Generate audit report

**Benefits**:
- Prevent future inaccuracies
- Quarterly automated audits
- Faster issue verification

---

## 📊 Success Metrics

**Immediate (This Week)**:
- [ ] ALF-77 closed as duplicate
- [ ] ALF-76 repurposed or closed
- [ ] Project assignments reviewed

**Short-term (This Month)**:
- [ ] Label standardization complete
- [ ] Verification process documented
- [ ] PRD updated with accurate status

**Long-term (This Quarter)**:
- [ ] Verification script created
- [ ] Quarterly audit process established
- [ ] All tool issues verified for accuracy

---

## 🎯 Recommended Priority Order

1. **Close ALF-77** (5 min) - Immediate cleanup
2. **Decide ALF-76 fate** (10 min) - Repurpose or close
3. **Update labels** (5 min) - Quick consistency fix
4. **Update PRD** (15 min) - Documentation accuracy
5. **Create verification script** (2-3 hours) - Prevent future issues

---

## 📝 Notes

- All critical inaccuracies have been fixed
- Remaining actions are organizational improvements
- No blocking issues remain
- Process improvements will prevent future problems

