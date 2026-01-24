# ALFRED Design System: Signal in the Void

**Philosophy:** ALFRED is not just a tool; it is an ambient intelligence emerging from the void. The interface does not sit _on_ a background; it emits light _from_ it. It is calm, precise, and bioluminescent.

## 1. Visual Physics

### The Void

The background is treated as a light-absorbent material, not just a dark color. To prevent digital flatness, a subtle static noise texture mimics the density of the physical world.

- **Base:** `oklch(0.05 0 0)` (Deepest Void)
- **Texture:** Static noise overlay at 2-3% opacity.
- **Depth:** No drop shadows. Shadows imply an external light source. ALFRED elements are self-illuminated. Use outer glows (`shadow-[color]/20`) or reactive strokes to imply internal energy.

### The Lens (HUD)

Avoid heavy "frosted glass". Use **separation transparency**: a very low opacity background combined with a sharp, high-contrast 1px border.

- **Surface:** `bg-white/5`
- **Border:** `border-white/10`
- **Effect:** "High-tech glass" lens, crisp and precise.

## 2. Token System (Tailwind v4)

### Palette (OKLCH)

Using OKLCH for perceptual uniformity in gradients and dark tones.

| Token                  | Value             | Usage                               |
| ---------------------- | ----------------- | ----------------------------------- |
| `--color-void`         | `oklch(0.05 0 0)` | Infinite background                 |
| `--color-void-surface` | `oklch(0.14 0 0)` | Cards, HUDs, Surfaces               |
| `--color-biolum`       | `oklch(0.99 0 0)` | Primary signal, text, active states |
| `--color-biolum-dim`   | `oklch(0.70 0 0)` | Secondary text, metadata            |
| `--color-biolum-faint` | `oklch(0.40 0 0)` | Inactive states, subtle borders     |

### Typography

Neo-Grotesque stack. Technical, precise, tight.

- **Font:** "Inter Tight", "Geist Sans", "San Francisco", system-ui.
- **Tracking:**
  - Display/Headers: `-0.04em` (`tracking-tighter`)
  - Body: `-0.02em` (`tracking-tight`)
- **Weight:** Lean towards lighter weights for large text, medium for legibility at small sizes.

### Geometry & Physics

- **Radius:**
  - Containers/HUDs: `24px` (`--radius-3xl`)
  - Buttons/Pills: `9999px` (`--radius-full`)
- **Icons:** `lucide-react` with `strokeWidth={1.5}`. Thin, geometric.
- **Animation:** Slow, fluid, breathing.
  - Easing: `cubic-bezier(0.25, 0.4, 0.25, 1)` (`--ease-fluid`)

## 3. Component Guidelines

### Cards (The HUD)

Do not use solid opaque backgrounds for standard cards.

```tsx
<div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-6 text-biolum">
  {/* Content */}
</div>
```

### Sliders (The Signal)

Thin tracks, solid white thumbs, no rings/halos.

- **Track:** `h-1 bg-biolum/20`
- **Thumb:** `h-4 w-4 bg-biolum` (no border, no shadow)

### Gradients

Use subtle vertical gradients to imply depth in the void.

- **Backgrounds:** `bg-gradient-to-b from-void-surface to-void/0`

## 4. Motion Principles

- **Breathing:** Elements should feel alive. Use `framer-motion` for subtle oscillation of opacity or scale on idle states.
- **Drawing:** Lines (graphs, dividers) should appear to be drawn in real-time.
- **Flow:** Transitions are fluid, not mechanical.

## 5. Implementation Checklist

1. [ ] Configure Tailwind v4 CSS variables (`@theme`).
2. [ ] Install "Inter Tight" or "Geist" font.
3. [ ] Apply global `bg-void text-biolum bg-noise` to root.
4. [ ] Override shadcn/ui primitives (Slider, Card, Button) to match the aesthetic.
5. [ ] Set global icon stroke width to 1.5.
