# Design System: Signal in the Void

## Core Principle

ALFRED's interface is an ambient "Signal in the Void." It treats the screen as a light-absorbent material where UI elements are self-illuminated. The aesthetic is high-contrast, bioluminescent, and technical—avoiding "SaaS" tropes like drop shadows, grey surfaces, and heavy frosted glass.

## Rules

1.  **The Void Foundation.**
    - **Background:** Always use `--color-void` (`oklch(0.05 0 0)`) as the base.
    - **Texture:** Apply a static noise overlay at 2-3% opacity to all root layouts to prevent digital flatness.
    - **No Drop Shadows:** Never use drop shadows. Shadows imply external light. Use outer glows (`shadow-[color]/20`) or border strokes to define edges.

2.  **Typography: Technical & Tight.**
    - **Font:** Use "Inter Tight", "Geist Sans", or "San Francisco".
    - **Tracking:** Enforce negative tracking.
      - Headers/Display: `-0.04em` (`tracking-tighter`)
      - Body: `-0.02em` (`tracking-tight`)
    - **Weight:** Prefer lighter weights for large text.

3.  **The Lens (HUD) Pattern.**
    - **Transparency:** Use "separation transparency" instead of heavy blur.
    - **Formula:** `bg-void-surface/40` + `backdrop-blur-xl` + `border border-white/10`.
    - **Radius:** Large curvature. `24px` (`rounded-3xl`) for containers.

4.  **Bioluminescent Color System.**
    - **Signal (White):** `--color-biolum` (`oklch(0.99 0 0)`). Pure, glowing white for active data.
    - **Dim:** `--color-biolum-dim` (`oklch(0.70 0 0)`). Secondary text.
    - **Faint:** `--color-biolum-faint` (`oklch(0.40 0 0)`). Inactive elements.
    - **Avoid Grey:** Do not use standard greys. Use opacity variations of the Biolum color or Void Surface tones.

5.  **Geometry & Icons.**
    - **Radius:** Fully rounded (`rounded-full`) for buttons, inputs, and pills.
    - **Icons:** `lucide-react` with `strokeWidth={1.5}` globally. Thin, geometric, precise.
    - **Borders:** Thin, crisp `1px` borders. `border-white/10` is the standard for separation.

6.  **Animation Physics.**
    - **Easing:** fluid (`cubic-bezier(0.25, 0.4, 0.25, 1)`).
    - **Motion:** Elements should "breathe" (subtle opacity/scale oscillation) rather than purely toggle.
    - **Drawing:** Graphs and lines should animate as if being drawn (path length interpolation).

7.  **Component Overrides.**
    - **Slider:** Thin track (`h-1`), solid white thumb, no ring/halo.
    - **Card:** Remove default shadow/bg. Use the HUD Lens pattern.
    - **Button:** `rounded-full`. Ghost variants preferred for secondary actions to reduce visual weight.

## Implementation Reference

### Tailwind v4 Theme Configuration

Define colors in `@theme` block: `--color-void` (`oklch(0.05 0 0)`), `--color-void-surface` (`oklch(0.14 0 0)`), `--color-biolum` (`oklch(0.99 0 0)`), `--color-biolum-dim` (`oklch(0.70 0 0)`), `--color-biolum-faint` (`oklch(0.40 0 0)`). Set font to "Inter Tight", "Geist Sans", or "San Francisco". Define `--radius-3xl: 24px`, `--radius-full: 9999px`, `--ease-fluid: cubic-bezier(0.25, 0.4, 0.25, 1)`.

### Usage Examples

**Standard Container (HUD):** Use `rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl` for containers. Apply `text-biolum tracking-tighter` to headings.

**Primary Action:** Use `rounded-full bg-biolum text-void hover:bg-biolum/90` for primary buttons.
