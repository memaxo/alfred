# ALFRED Integration Audit: 50 Recommendations

**Date**: 2026-01-24  
**Based on**: [integration-audit.md](./integration-audit.md)

**Update (2026-01-25):**

- `@alfred/resilience` is now imported by `@alfred/pipeline` (`packages/pipeline/src/runner.ts`) for MAX_TRANSITIONS safeguards.
- `@alfred/code-analysis` is now used by the review router (`packages/api/src/routers/review.ts`) to enrich code reviews when `rawDiff` is provided.
- Native voice capture now calls Sense routers (`apps/native/lib/voice/capture.ts`) and has test coverage.
- Graph vs Knowledge boundaries are documented in `docs/architecture/hypergraph.md` with a boundary test in `packages/knowledge/src/__tests__/boundary.test.ts`.

---

## Package Integration & Cleanup (1-15)

### Immediate Actions

1. **Delete `@alfred/util`** - Empty package with only docs/rules. Remove from `tsconfig.json` references and workspace.

2. **Audit `@alfred/resilience`** - ✅ Integrated into pipeline runner (`packages/pipeline/src/runner.ts`). Follow-up: decide whether to expand usage beyond MAX_TRANSITIONS.

3. **Audit `@alfred/code-analysis`** - ✅ Integrated into review router (`packages/api/src/routers/review.ts`) for `raw_diff` analysis. Follow-up: implement GitHub PR/local diff sources or document as raw-diff-only.

4. **Document `@alfred/cortex` client-only usage** - Add README explaining it's intentionally client-side only (WebGPU/visual engine). No backend integration needed.

5. **Document `@alfred/protocol` client protocol** - Add README explaining it's the Agent Client Protocol SDK for client-side codex communication. Document as intentional architecture.

6. **Document `@alfred/mcp` external integration** - Add README explaining it's for external Model Context Protocol servers. Document as intentional external integration point.

7. **Clarify `@alfred/harbor` purpose** - Either integrate harbor scripts into `packages/api/src/routers/` OR document as standalone evaluation tooling.

8. **Audit `@alfred/tui` integration** - Terminal UI package. **Decision**: Keep standalone OR integrate with API for remote terminal access.

9. **Move `@alfred/resilience/abort` patterns** - If keeping resilience patterns, move `abort.ts` utilities into `packages/runtime/src/abort/` where they're actually needed.

10. **Move `@alfred/resilience/escalation` patterns** - If keeping, move escalation detection into `packages/agent/src/orchestrator/` where escalation logic lives.

11. **Move `@alfred/resilience/transitions` patterns** - If keeping, move transition guards into `packages/cognitive/src/transition.ts` where state transitions are managed.

12. **Integrate `@alfred/code-analysis` into review router** - If keeping, wire `detectBugs()` and `analyzeDiff()` into `packages/api/src/routers/review.ts` for automated code review.

13. **Complete `@alfred/sense` native integration** - ✅ Native voice capture wired (`apps/native/lib/voice/capture.ts`). Follow-up: add photo capture wiring if needed.

14. **Test `@alfred/sense` end-to-end** - Add E2E test: native capture → inbox → triage → note creation. Verify receipt generation works.

15. **Wire `@alfred/sense` to native photo capture** - Extend native capture to support photo capture → sense router for multimodal inbox.

---

## Architecture Clarifications (16-25)

16. **Document Pipeline vs Runtime decision tree** - Create `docs/architecture/pipeline-vs-runtime.md` explaining:
    - Use Pipeline when: Multi-stage orchestration, Linear sync needed, checkpoint/resume required
    - Use Runtime when: Single workflow execution, streaming events, phase-based execution

17. **Consolidate Pipeline/Runtime or make explicit** - Either merge into single execution path OR document clear boundaries and when each is used.

18. **Clarify Graph vs Knowledge boundaries** - ✅ Documented in `docs/architecture/hypergraph.md`:
    - `knowledge` = Pure in-memory hypergraph with dirty tracking
    - `graph` = DB query layer for persisted graph data
    - When to use which

19. **Consolidate Graph/Knowledge if overlap >80%** - If functionality overlaps significantly, merge `@alfred/graph` into `@alfred/knowledge` as DB persistence layer.

20. **Document `@alfred/history` usage** - Currently lightweight. Document intended use cases and when to use vs `@alfred/knowledge` for conversation history.

21. **Clarify `@alfred/persona` scope** - Web app only. Document if this is intentional or if native app should also use persona.

22. **Clarify `@alfred/ui` scope** - Native app only. Document if web app should also use shared UI components or if separation is intentional.

23. **Document `@alfred/pacer` usage** - Not used in core runtime. Document intended use cases (debouncing/throttling) and when to use.

24. **Test `@alfred/summarize` Python subprocess** - Verify Python subprocess integration works reliably. Add integration tests for LongCodeZip compression.

25. **Document `@alfred/codeprint` integration** - Currently used via `packages/plan/src/research/codebase.ts`. Document as integrated tool for fast file relevance.

---

## Code Quality & Testing (26-35)

26. **Add integration tests for Pipeline** - Test full pipeline execution: init → context → plan → schedule → execute → review → learn → summarize.

27. **Add integration tests for Runtime** - Test full runtime execution: scan → plan → act → report phases.

28. **Add boundary tests for Pipeline** - Verify Pipeline never imports `@alfred/db` or `@alfred/api` (per `.ruler/48-pipeline-boundaries.md`).

29. **Add boundary tests for Runtime** - Verify Runtime imports are correct (domain packages only, no API/DB direct imports).

30. **Test Sense → Native capture flow** - E2E test: native voice capture → `trpc.capture.create` → inbox → triage → entity creation.

31. **Test Sense → Web capture flow** - E2E test: web voice capture → sense router → inbox → receipt generation.

32. **Add tests for Graph vs Knowledge separation** - Verify `graph` queries DB while `knowledge` operates in-memory. Test persistence boundaries.

33. **Add tests for Codeprint fallback** - Test `gatherCodebaseContext()` fallback to legacy LLM-based context when codeprint fails.

34. **Add tests for Resilience patterns** - If keeping resilience, add tests for abort signal propagation, escalation detection, transition guards.

35. **Add tests for Code-analysis** - If keeping code-analysis, add tests for bug detection, diff parsing, severity classification.

---

## Performance & Optimization (36-40)

36. **Profile Pipeline vs Runtime performance** - Benchmark both execution paths. Document performance characteristics and when to use which.

37. **Optimize Sense capture flow** - Profile native capture → API → DB path. Identify bottlenecks (audio encoding, network, DB writes).

38. **Cache Codeprint indexes** - Verify `.codeprint.json` caching works correctly. Profile index rebuild time vs cache hit performance.

39. **Optimize Graph queries** - Profile `@alfred/graph` DB queries. Add indexes if needed for `getNeighbors`, `getSubgraph`, `findPath`.

40. **Profile Knowledge hypergraph operations** - Verify in-memory hypergraph operations meet <1ms budget. Profile `persistHypergraph` performance.

---

## Documentation & Developer Experience (41-50)

41. **Create package dependency diagram** - Visual diagram showing integration status (green/yellow/red) for all packages.

42. **Document integration patterns** - Create `docs/architecture/integration-patterns.md` explaining:
    - Runtime → Domain packages pattern
    - API → Runtime/Pipeline pattern
    - Apps → API pattern
    - DB → Repos pattern

43. **Add package READMEs** - Every package should have README explaining:
    - Purpose
    - Integration points
    - Usage examples
    - Dependencies

44. **Document when to create new packages** - Add to `docs/architecture/packages.md`:
    - When to split (package >5000 lines, multiple concerns)
    - When to merge (packages always change together)
    - When to extract (clear reusable library emerges)

45. **Create integration checklist** - For new packages:
    - [ ] Define purpose (single sentence)
    - [ ] Identify dependencies
    - [ ] Document integration points
    - [ ] Add tests
    - [ ] Update architecture docs

46. **Document graceful degradation** - For packages with optional dependencies (Python subprocesses, external services), document fallback behavior.

47. **Create troubleshooting guide** - Document common integration issues:
    - Package boundary violations
    - Circular dependencies
    - Missing integration points
    - Unused packages

48. **Add integration health dashboard** - Create script that generates integration status report:
    - Package import counts
    - Integration coverage
    - Orphaned packages
    - Boundary violations

49. **Document migration paths** - For packages being integrated or deprecated:
    - Migration guide from old to new
    - Deprecation timeline
    - Breaking changes

50. **Create architecture decision log** - Document major integration decisions:
    - Why Pipeline vs Runtime separation
    - Why Graph vs Knowledge separation
    - Why Sense is separate package
    - Future consolidation plans

---

## Priority Ranking

### Critical (Do First)

- #1, #2, #3: Delete/utilize unused packages
- #13, #14: Complete Sense integration
- #16, #17: Clarify Pipeline vs Runtime

### High Priority (This Month)

- #4, #5, #6: Document disconnected packages
- #18, #19: Clarify Graph vs Knowledge
- #26, #27: Add integration tests

### Medium Priority (Next Quarter)

- #7, #8: Audit remaining packages
- #36, #37: Performance profiling
- #41, #42: Documentation improvements

### Low Priority (Backlog)

- #43-50: Developer experience improvements
- #38-40: Performance optimizations

---

## Success Metrics

**Target State** (3 months):

- ✅ 80% packages fully integrated (up from 57%)
- ✅ 15% packages partially integrated (down from 23%)
- ✅ 5% packages disconnected (down from 30%)
- ✅ Zero orphaned packages with code
- ✅ Clear Pipeline vs Runtime boundaries
- ✅ Complete Sense integration
- ✅ All packages have READMEs

**Validation**:

- Run integration health dashboard monthly
- Track package import counts
- Monitor boundary violations
- Review integration status in architecture meetings

---

**See Also**:

- [integration-audit.md](./integration-audit.md) - Full audit details
- [integration-summary.md](./integration-summary.md) - Quick reference
