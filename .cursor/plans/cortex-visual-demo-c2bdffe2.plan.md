<!-- c2bdffe2-9eee-4d85-be16-cc9208dab16b 00d1c66b-a607-49db-9ffa-1ff92c85125e -->
# Cortex Visual Configuration System

## Architecture

Two-tier system:

1. **Developer Demo** (`/demo/cortex`) - Full parameter exposure with real-time preview
2. **User Settings** (`/settings/visual`) - Simplified presets + key adjustments

Both backed by the existing preference system using keys like `visual.*`.

## Phase 1: Type Definitions and Schema

**File: `packages/type/src/visual.ts`**

Define visual preference schema:

```typescript
export const visualPresetSchema = z.enum(["minimal", "balanced", "performance", "maximum", "custom"]);

export const visualConfigSchema = z.object({
  preset: visualPresetSchema,
  particles: z.object({ count: z.number(), spawnRadius: z.number() }),
  corona: z.object({ fiberCount: z.number(), innerRadius: z.number(), outerRadius: z.number(), rotationSpeed: z.number() }),
  bloom: z.object({ threshold: z.number(), intensity: z.number(), blurRadius: z.number() }),
  colors: z.object({ primary: z.string(), secondary: z.string(), accent: z.string(), void: z.string() }),
  atmosphere: z.object({ fogDensity: z.number(), fiberIntensity: z.number() }),
  nodes: z.object({ glowIntensity: z.number(), ringWidth: z.number() }),
  edges: z.object({ particleSpeed: z.number(), curvature: z.number() }),
});
```

**File: `packages/cortex/src/presets.ts`**

Define preset configurations:

- `MINIMAL`: Low particle/fiber counts, reduced effects
- `BALANCED`: Default values (current implementation)
- `PERFORMANCE`: Optimized for 60fps on lower-end hardware
- `MAXIMUM`: Full visual fidelity

## Phase 2: Preference Integration

**File: `packages/api/src/routers/visual.ts`**

New tRPC router for visual preferences:

- `visual.getConfig` - Load visual config from preferences
- `visual.setConfig` - Save entire config
- `visual.setPreset` - Quick preset application
- `visual.resetToDefault` - Reset to balanced preset

Uses existing `userRepo.setPreference` with keys like:

- `visual.preset`
- `visual.particles.count`
- `visual.bloom.intensity`
- etc.

## Phase 3: Developer Demo Page

**File: `apps/web/src/routes/demo/cortex.tsx`**

Full-featured demo page with:

1. **Live Canvas** - Full Cortex rendering with current config
2. **Control Panels** (collapsible sections):

   - Particle System: count slider, spawn radius, gravity constant
   - Corona: fiber count, inner/outer radius, rotation speed, spiral tightness
   - Post-Processing: bloom threshold/intensity/radius, chromatic aberration
   - Colors: color pickers for primary (teal), secondary, accent, void background
   - Atmosphere: fog density, fiber texture intensity
   - Nodes: glow intensity, ring width, activity pulse speed
   - Edges: particle speed, flow direction, curvature

3. **Preset Selector** - Dropdown with save/load custom presets
4. **Performance Monitor** - FPS counter, particle count, draw calls
5. **Export/Import** - JSON export/import for sharing configs

UI Components needed:

- `VisualSlider` - Labeled slider with min/max/value display
- `VisualColorPicker` - Color picker with oklch preview
- `VisualToggle` - On/off for features
- `PresetCard` - Preset selection with preview thumbnail

## Phase 4: User Settings Page

**File: `apps/web/src/routes/_protected/settings/visual.tsx`**

Simplified user-facing page:

1. **Preset Grid** - Large cards for Minimal/Balanced/Performance/Maximum
2. **Key Adjustments** (if preset is "custom"):

   - Particle density (Low/Medium/High/Ultra)
   - Glow intensity slider
   - Color theme picker (3-4 curated palettes)

3. **Preview Window** - Small canvas showing current config
4. **Apply Button** - Saves preferences

Link from main settings page with "Visual Appearance" card.

## Phase 5: Cortex Engine Integration

**File: `packages/cortex/src/config.ts`**

New configuration loader:

```typescript
export function applyVisualConfig(engine: CortexEngine, config: VisualConfig): void {
  engine.getSystem<ParticleSystem>("particles")?.setParticleCount(config.particles.count);
  engine.getSystem<CoronaSystem>("corona")?.setFiberCount(config.corona.fiberCount);
  // ... etc
}
```

**File: `apps/web/src/hooks/use-visual-preferences.ts`**

Hook that:

1. Loads visual preferences from tRPC
2. Returns reactive config object
3. Provides `updateConfig` and `applyPreset` methods
4. Auto-applies to Cortex engine when loaded

## Files to Create/Modify

| File | Action |

|------|--------|

| `packages/type/src/visual.ts` | Create - Schema definitions |

| `packages/type/src/index.ts` | Modify - Export visual types |

| `packages/cortex/src/presets.ts` | Create - Preset configurations |

| `packages/cortex/src/config.ts` | Create - Config application logic |

| `packages/api/src/routers/visual.ts` | Create - tRPC router |

| `packages/api/src/routers/index.ts` | Modify - Add visual router |

| `apps/web/src/routes/demo/cortex.tsx` | Create - Dev demo page |

| `apps/web/src/routes/_protected/settings/visual.tsx` | Create - User settings |

| `apps/web/src/routes/_protected/settings.tsx` | Modify - Add link to visual settings |

| `apps/web/src/hooks/use-visual-preferences.ts` | Create - Preference hook |

| `apps/web/src/components/visual-config/*.tsx` | Create - Control components |

### To-dos

- [ ] Create packages/cortex with engine foundation, buffer management, and 4D coordinate system
- [ ] Implement mathematical primitives: logarithmic spiral, bezier evaluation, gravitational physics, simplex noise
- [ ] Build gravitational particle compute shader with respawn logic and GPU buffer double-buffering
- [ ] Create fibrous corona renderer with 2000 logarithmic spiral fibers and organic wobble
- [ ] Implement living edge system with bezier particle streams and activity states
- [ ] Build SDF-based circular node renderer with inner/outer glow and activity pulsing
- [ ] Create atmospheric layer with radial fog, fiber texture, and depth-based rendering
- [ ] Implement bloom extraction, separable Gaussian blur, and chromatic aberration
- [ ] Build synchronization layer between xyflow state and Cortex GPU buffers
- [ ] Modify MindscapeCanvas to layer transparent xyflow over Cortex WebGPU canvas
- [ ] Integrate knowledge graph embeddings for semantic dimension of 4D coordinates
- [ ] Implement time dimension with state history and interpolation for time-travel
- [ ] Create LOD manager that adjusts particle/fiber counts based on zoom level
- [ ] Build Canvas2D and WebGL fallback renderers for devices without WebGPU
- [ ] Connect cognitive state, voice FFT, and workflow runtime to visual parameters