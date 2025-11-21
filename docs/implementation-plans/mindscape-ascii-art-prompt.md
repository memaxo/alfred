# Implementation Plan Prompt: Psychedelic ASCII Art Mindscape Entry

**Target Audience:** Genius mathematician-designer AI specializing in computational graphics, WebGPU optimization, and psychovisual design.

**Objective:** Create an implementation plan for replacing the current home screen (`apps/web/src/routes/index.tsx`) with an insanely futuristic, psychedelic ASCII art experience that runs at 120fps using WebGPU, pure JavaScript (no React), with isomorphic SSR support via TanStack Start and Bun APIs.

---

## 1. Design Vision: "Enter the Mindscape"

### Core Aesthetic
Transform the static ASCII title into a **living, breathing, psychovisual gateway** that embodies ALFRED's "Signal in the Void" philosophy. The experience should feel like:

- **Dimensional collapse:** ASCII characters emerge from infinite depth, converging into the ALFRED logo
- **Bioluminescent flow:** Characters pulse, morph, and flow like neural pathways
- **Temporal distortion:** Time-based animations that create a sense of entering another dimension
- **Mathematical beauty:** Fractal patterns, Lissajous curves, and wave interference patterns rendered as ASCII
- **Interactive resonance:** Mouse/touch movements create ripples and distortions in the ASCII field

### ALFRED Design System Constraints

**Color Palette (OKLCH):**
- `--color-void`: `oklch(0.05 0 0)` - Deepest void background
- `--color-void-surface`: `oklch(0.14 0 0)` - Subtle surface layers
- `--color-biolum`: `oklch(0.99 0 0)` - Pure white signal (primary)
- `--color-biolum-dim`: `oklch(0.70 0 0)` - Dimmed signal (secondary)
- `--color-biolum-faint`: `oklch(0.40 0 0)` - Faint signal (tertiary)

**Typography:**
- Font: "Inter Tight", "Geist Sans", "San Francisco" (monospace variant for ASCII)
- Tracking: `-0.04em` (tight, technical)
- Weight: Light to medium (avoid heavy weights)

**Physics:**
- No drop shadows (self-illuminated elements)
- Outer glows: `shadow-[color]/20`
- Static noise texture overlay at 2-3% opacity
- Fluid easing: `cubic-bezier(0.25, 0.4, 0.25, 1)`

---

## 2. Technical Requirements

### Performance Targets
- **Frame Rate:** Consistent 120fps (8.33ms per frame budget)
- **Initial Load:** <100ms to first frame
- **Memory:** <50MB GPU memory footprint
- **CPU:** <5% CPU usage on modern hardware
- **Battery:** Optimized for mobile devices (throttle to 60fps on battery)

### Technology Stack
- **Rendering:** WebGPU compute shaders + canvas 2D/WebGL fallback
- **Language:** Pure JavaScript (ES2024), no React, no frameworks
- **SSR:** Isomorphic functions compatible with TanStack Start SSR
- **Runtime:** Bun APIs for server-side rendering and asset optimization
- **Build:** Vite for client bundling, Bun for server execution

### Architecture Constraints

**Isomorphic Design:**
```javascript
// Server-side (Bun)
export async function renderASCIIArtSSR(params) {
  // Generate initial frame server-side
  // Return HTML with canvas + WebGPU initialization
}

// Client-side
export async function initASCIIArtClient(canvas) {
  // Initialize WebGPU context
  // Start 120fps render loop
}
```

**Integration Points:**
- Replace `apps/web/src/routes/index.tsx` component
- Maintain TanStack Start route structure
- Preserve health check API integration
- Keep "Enter the Mindscape" button functionality
- Support SSR hydration without React

---

## 3. Mathematical & Visual Specifications

### ASCII Rendering Techniques

**1. Depth-Based ASCII Mapping**
- Use signed distance fields (SDF) to create 3D ASCII characters
- Map depth values to ASCII character density: `█ ▓ ▒ ░ ` (dark to light)
- Apply perspective projection with configurable FOV
- Implement depth-of-field blur for out-of-focus characters

**2. Wave Interference Patterns**
- Multiple sine waves with different frequencies create interference
- Map wave amplitude to ASCII character selection
- Use Lissajous curves for orbital motion
- Implement Fourier transform visualization as ASCII spectrum

**3. Fractal ASCII Generation**
- Mandelbrot/Julia sets rendered as ASCII density maps
- Recursive subdivision for infinite detail
- Color mapping via OKLCH gradients
- Zoom/pan interactions with smooth interpolation

**4. Particle System ASCII**
- Thousands of particles forming ASCII characters
- Physics simulation: gravity, repulsion, attraction
- Trail rendering for motion blur effect
- Collision detection for character formation

**5. Neural Network Visualization**
- ASCII representation of neural activations
- Real-time forward pass visualization
- Connection weights as character brightness
- Animated propagation through layers

### Animation Mathematics

**Time-Based Functions:**
```javascript
// Breathing effect (sine wave with slow frequency)
breathing(t) = 0.5 + 0.5 * sin(t * 0.5) * exp(-t * 0.001)

// Morphing (smooth interpolation between states)
morph(t, a, b) = lerp(a, b, smoothstep(0, 1, sin(t * 0.3)))

// Pulse (exponential decay with periodic triggers)
pulse(t, trigger) = exp(-(t - trigger) * 10) * sin((t - trigger) * 20)
```

**Spatial Transformations:**
- Perspective projection matrix
- Quaternion rotations for 3D orientation
- Homogeneous coordinates for transformations
- Matrix interpolation for smooth transitions

**Color Mathematics:**
- OKLCH color space for perceptual uniformity
- Gradient interpolation along curves
- Color temperature shifts (cool to warm)
- Chromatic aberration effects

---

## 4. WebGPU Implementation Strategy

### Compute Shader Architecture

**Shader Pipeline:**
1. **Compute Pass 1:** Generate ASCII character positions and attributes
   - Input: Time, mouse position, parameters
   - Output: Character grid with position, char, color, depth
   - Workgroup size: 16x16 (256 threads)

2. **Compute Pass 2:** Apply effects (blur, glow, distortion)
   - Input: Character grid from Pass 1
   - Output: Processed character grid
   - Effects: Gaussian blur, outer glow, chromatic aberration

3. **Render Pass:** Draw ASCII characters to canvas
   - Input: Processed character grid
   - Output: Canvas 2D or WebGL texture
   - Font rendering: Pre-rendered character atlas

### Performance Optimizations

**GPU Optimizations:**
- Use `storageTexture` for intermediate buffers
- Minimize texture reads/writes
- Batch character rendering
- Use instanced rendering for repeated characters
- Implement level-of-detail (LOD) for distant characters

**CPU Optimizations:**
- Offload all computation to GPU
- Use `requestAnimationFrame` with high-precision timestamps
- Implement frame skipping for battery mode
- Cache computed values where possible
- Use Web Workers for non-GPU tasks

**Memory Management:**
- Reuse buffers instead of allocating
- Implement object pooling for particles
- Use `ArrayBuffer` for efficient data transfer
- Minimize JavaScript object creation in hot loops

---

## 5. Isomorphic SSR Implementation

### Server-Side Rendering (Bun)

**Requirements:**
- Generate initial frame server-side for SEO and initial paint
- Use Bun's native WebGPU support (if available) or CPU fallback
- Return HTML with canvas element and initialization script
- Include critical CSS inline
- Preload WebGPU shaders

**Implementation Pattern:**
```javascript
// apps/web/src/routes/index.server.ts
import { createServerFn } from '@tanstack/start/server';

export const renderASCIIArt = createServerFn()
  .inputValidator(z.object({ /* params */ }))
  .handler(async ({ input }) => {
    // Generate initial ASCII art frame
    // Return HTML string with canvas + initialization
    return { html, initialFrame, shaders };
  });
```

### Client-Side Hydration

**Requirements:**
- Detect WebGPU support
- Fallback to WebGL or Canvas 2D if WebGPU unavailable
- Seamlessly transition from SSR frame to live animation
- Preserve scroll position and state
- Handle route navigation without reinitialization

**Hydration Pattern:**
```javascript
// apps/web/src/routes/index.client.ts
export async function hydrateASCIIArt(canvas, initialFrame) {
  // Check WebGPU support
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    return initWebGLFallback(canvas, initialFrame);
  }
  
  // Initialize WebGPU context
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  
  // Transition from SSR frame to live animation
  await transitionToLive(context, device, initialFrame);
  
  // Start 120fps render loop
  startRenderLoop(context, device);
}
```

---

## 6. User Interaction Design

### Mouse/Touch Interactions

**Proximity Effects:**
- Mouse position creates "gravity wells" in ASCII field
- Characters are attracted/repelled based on distance
- Smooth interpolation for responsive feel
- Multi-touch support for mobile

**Click/Tap Actions:**
- Click on "Enter the Mindscape" button triggers:
  - Explosive particle effect
  - Dimensional transition animation
  - Route navigation to `/mindscape`
- Hover effects on interactive elements
- Keyboard shortcuts (preserve Cmd+M toggle)

### Responsive Behavior

**Breakpoints:**
- Desktop (>1024px): Full ASCII art experience, 120fps
- Tablet (768-1024px): Reduced particle count, 60fps
- Mobile (<768px): Simplified animation, 30fps, touch-optimized

**Adaptive Quality:**
- Detect device capabilities (GPU, battery)
- Automatically adjust quality settings
- Provide manual quality selector
- Graceful degradation for low-end devices

---

## 7. Integration Requirements

### TanStack Start Route Integration

**File Structure:**
```
apps/web/src/routes/
  index.tsx          # Route definition (minimal React wrapper)
  index.server.ts    # SSR function (Bun)
  index.client.ts    # Client initialization (WebGPU)
  index.css          # Critical CSS (inline)
```

**Route Component:**
```typescript
// Minimal React wrapper that mounts pure JS canvas
export const Route = createFileRoute("/")({
  component: ASCIIArtHome,
  loader: async () => {
    // Pre-render initial frame server-side
    return await renderASCIIArtSSR();
  },
});
```

### Bun API Usage

**Server-Side:**
- Use `Bun.file()` for shader loading
- Use `Bun.serve()` for asset serving (if needed)
- Use Bun's native performance APIs for timing
- Leverage Bun's fast JavaScript execution for CPU fallback

**Asset Optimization:**
- Pre-compile shaders with Bun
- Optimize font atlas generation
- Cache computed frames for SSR
- Use Bun's bundler for efficient code splitting

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up WebGPU context initialization
- [ ] Create basic ASCII character rendering pipeline
- [ ] Implement compute shader for character generation
- [ ] Achieve 120fps with static ASCII art
- [ ] Create isomorphic SSR function structure

### Phase 2: Animation (Week 2)
- [ ] Implement time-based animations (breathing, pulsing)
- [ ] Add wave interference patterns
- [ ] Create particle system for dynamic effects
- [ ] Implement depth-based rendering
- [ ] Add mouse/touch interaction

### Phase 3: Visual Effects (Week 3)
- [ ] Implement fractal ASCII generation
- [ ] Add neural network visualization
- [ ] Create transition effects (entrance, exit)
- [ ] Implement color gradients and OKLCH mapping
- [ ] Add static noise texture overlay

### Phase 4: Integration (Week 4)
- [ ] Integrate with TanStack Start route
- [ ] Implement SSR hydration
- [ ] Add health check API integration
- [ ] Implement "Enter the Mindscape" button
- [ ] Add responsive breakpoints and adaptive quality

### Phase 5: Polish (Week 5)
- [ ] Performance optimization and profiling
- [ ] Battery mode detection and throttling
- [ ] Accessibility improvements (reduced motion, screen reader)
- [ ] Error handling and fallbacks
- [ ] Documentation and code comments

---

## 9. Success Criteria

### Performance Metrics
- ✅ Consistent 120fps on desktop (RTX 3060 or equivalent)
- ✅ <100ms initial load time
- ✅ <50MB GPU memory usage
- ✅ <5% CPU usage during animation
- ✅ Graceful degradation to 60fps on battery

### Visual Quality
- ✅ Smooth, fluid animations without jank
- ✅ Accurate OKLCH color rendering
- ✅ Crisp ASCII character rendering at all zoom levels
- ✅ Responsive to user interactions
- ✅ Matches ALFRED design system aesthetic

### Technical Excellence
- ✅ Zero React dependencies in rendering code
- ✅ Full SSR support with seamless hydration
- ✅ WebGPU with WebGL/Canvas 2D fallbacks
- ✅ Bun API integration for server-side
- ✅ TypeScript type safety throughout

### User Experience
- ✅ Intuitive interaction model
- ✅ Clear "Enter the Mindscape" call-to-action
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Mobile-friendly touch interactions
- ✅ Preserves existing functionality (health check, navigation)

---

## 10. Mathematical Challenges to Solve

### Challenge 1: Real-Time ASCII Density Mapping
**Problem:** Convert 3D depth information to ASCII character selection in real-time.

**Approach:**
- Use SDF (signed distance field) for character shapes
- Map depth to character density: `depth → char_index`
- Implement lookup table for character selection
- Optimize with texture sampling in GPU

### Challenge 2: Smooth Interpolation Between States
**Problem:** Transition between different ASCII patterns without visual artifacts.

**Approach:**
- Use Hermite interpolation for smooth curves
- Implement state machine for pattern transitions
- Use easing functions for natural motion
- Cross-fade between character sets

### Challenge 3: Efficient Particle Physics
**Problem:** Simulate thousands of particles forming ASCII characters at 120fps.

**Approach:**
- Use GPU compute shaders for physics simulation
- Implement spatial partitioning for collision detection
- Use instanced rendering for particle drawing
- Optimize with compute shader workgroups

### Challenge 4: Perceptual Color Uniformity
**Problem:** Maintain consistent visual appearance across OKLCH color space.

**Approach:**
- Use OKLCH for all color calculations
- Implement proper gamma correction
- Map OKLCH to sRGB for display
- Test color perception across different displays

### Challenge 5: Frame Rate Stability
**Problem:** Maintain consistent 120fps despite varying computational load.

**Approach:**
- Implement adaptive quality system
- Use frame time budgeting (8.33ms per frame)
- Skip frames if budget exceeded
- Profile and optimize hot paths

---

## 11. Reference Inspirations

### Visual References
- **Matrix (1999):** Falling green ASCII characters
- **Tron (1982):** Neon grid aesthetics
- **Blade Runner (1982):** Cyberpunk atmosphere
- **Ex Machina (2014):** Minimalist tech aesthetic
- **Her (2013):** Warm, organic technology

### Technical References
- **Shadertoy:** WebGL shader examples
- **Three.js:** 3D rendering techniques
- **Regl:** Functional WebGL library
- **WebGPU Samples:** Official WebGPU examples
- **ASCII Art Generators:** Character mapping algorithms

### Mathematical References
- **Fractal Geometry:** Mandelbrot, Julia sets
- **Wave Interference:** Fourier analysis, Lissajous curves
- **Particle Systems:** Physics simulation, collision detection
- **Signed Distance Fields:** Ray marching, SDF rendering
- **Color Science:** OKLCH color space, perceptual uniformity

---

## 12. Deliverables

### Code Artifacts
1. **Pure JavaScript rendering engine** (`apps/web/src/lib/ascii-art/`)
   - WebGPU initialization and context management
   - Compute shader pipeline
   - Render loop and frame timing
   - Interaction handlers

2. **Isomorphic SSR functions** (`apps/web/src/routes/index.server.ts`)
   - Server-side frame generation
   - HTML template generation
   - Shader preloading
   - Asset optimization

3. **Client hydration** (`apps/web/src/routes/index.client.ts`)
   - WebGPU context initialization
   - SSR frame transition
   - Render loop startup
   - Fallback handling

4. **Route integration** (`apps/web/src/routes/index.tsx`)
   - Minimal React wrapper
   - Canvas mounting
   - Route loader integration
   - Error boundaries

### Documentation
1. **Architecture document:** System design and component interactions
2. **Performance guide:** Optimization techniques and profiling
3. **Shader reference:** Compute shader algorithms and parameters
4. **Integration guide:** TanStack Start and Bun API usage

### Assets
1. **Font atlas:** Pre-rendered ASCII character textures
2. **Shader files:** WGSL compute and render shaders
3. **Configuration:** Quality presets and performance profiles

---

## 13. Constraints & Considerations

### Browser Compatibility
- **WebGPU:** Chrome 113+, Edge 113+, Safari 18+ (experimental)
- **Fallback:** WebGL 2.0 for older browsers
- **Mobile:** iOS Safari, Chrome Android
- **Progressive enhancement:** Graceful degradation

### Accessibility
- **Reduced motion:** Respect `prefers-reduced-motion`
- **Screen readers:** Provide text alternative
- **Keyboard navigation:** Preserve keyboard shortcuts
- **Color contrast:** Maintain WCAG AA compliance

### Security
- **CSP:** Content Security Policy compatibility
- **XSS:** Sanitize user inputs
- **CORS:** Proper cross-origin handling
- **WebGPU:** Secure context requirements

### Performance Budgets
- **Initial Load:** <100ms to first frame
- **Frame Time:** <8.33ms per frame (120fps)
- **Memory:** <50MB GPU, <20MB CPU
- **Battery:** Throttle to 60fps on battery power

---

## 14. Questions to Answer

1. **Shader Complexity:** What's the optimal balance between shader complexity and performance?
2. **Character Set:** Which ASCII characters provide the best visual density mapping?
3. **Animation Timing:** How to synchronize multiple animation layers smoothly?
4. **SSR Strategy:** How much of the initial frame should be pre-rendered server-side?
5. **Fallback Strategy:** What's the minimum viable experience for WebGPU-unsupported browsers?
6. **Mobile Optimization:** How to maintain visual quality while reducing computational load?
7. **Color Mapping:** What's the best algorithm for mapping depth/values to OKLCH colors?
8. **Interaction Design:** How to make interactions feel responsive without lag?

---

## 15. Final Notes

This implementation should push the boundaries of what's possible with WebGPU and ASCII art, creating a **psychovisual gateway** that embodies ALFRED's philosophy of computational austerity and cognitive precision. The experience should feel like entering another dimension—a spatial canvas where thoughts become reality.

**Remember:** Every frame is a mathematical expression. Every character is a signal in the void. Every interaction is a resonance with the mindscape.

**Create something that makes users say:** "I've never seen anything like this before."

---

**Ready to begin?** Start with Phase 1: Foundation, and iterate rapidly. Measure everything. Optimize relentlessly. Create beauty through mathematics.

