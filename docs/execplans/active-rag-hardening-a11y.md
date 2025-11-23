# ExecPlan: Active RAG Hardening - Accessibility (A11y)

## Purpose
Ensure the Context Lens features are accessible to keyboard users and screen readers, complying with WCAG standards.

## Plan

1.  **Keyboard Navigation**:
    *   Verify the `ContextLens` trigger (`button`) is reachable via `Tab`.
    *   Ensure `Enter` or `Space` opens the `HoverCard` (Radix UI `HoverCard` may require specific configuration for click-to-open behavior or fallback to `Popover` if strictly needed, but standard practice is that it should be focus-revealed).
    *   *Note*: Radix `HoverCard` does not open on focus by default. We may need to switch to `Popover` or compose them, OR accept that it's a "progressive enhancement" and ensure the info is available elsewhere.
    *   *Better approach*: Since this is "Hover" card, for A11y, we should probably wrap it or use `Tooltip` patterns. However, given it's interactive content (scrollable list), a `Popover` triggered by click is often better for A11y than a HoverCard.
    *   **Decision**: Change `HoverCard` to `Popover` (or a composite that acts as Hover on desktop, Click on mobile/keyboard). For simplicity and A11y, **switching to `Popover` (click-to-toggle)** is often superior for complex content like lists.
    *   *Alternative*: Keep `HoverCard` but ensure the trigger has `aria-label` summarizing the context count.

2.  **ARIA Roles**:
    *   Ensure the trigger button has a descriptive `aria-label` (e.g., "Active Context: Quantum Physics, 3 related documents available").

3.  **Screen Reader**:
    *   When the "Sparkles" icon appears (context found), ensure this status change is announced (using `aria-live` region or simple label update).

## Implementation Steps
1.  Update `ContextLens` in `apps/web/src/components/chat-container.tsx`.
2.  Add `aria-label` to the trigger button constructed from props.
3.  Test keyboard focus flow.

## Verification
*   **Test**: Tab to the badge.
*   **Expectation**: Button receives focus ring.
*   **Test**: VoiceOver/Screen Reader.
*   **Expectation**: Reads meaningful description, not just "button".
