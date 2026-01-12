# Desktop Spatial UX & Motion

## Purpose
ALFRED's "Desktop-Inspired" UI is designed to feel spatial and mechanical. It transitions seamlessly between a traditional tiled/floating desktop and an infinite Mindscape canvas.

## Architectural Patterns

### 1. Motion Orchestration
We use `Framer Motion` for all physics-based UI.
- **Layout Persistence**: Windows use the `layoutId` prop matching their `windowId`. This allows them to animate smoothly when the desktop mode toggles or when they are minimized to the taskbar.
- **Presence**: All window spawning and closing must be wrapped in `<AnimatePresence>` to ensure exit animations are honored.
- **Spring Physics**: Use spring-based transitions for spatial movement (moving, resizing, tiling) but keep them tight (Stiffness: 400, Damping: 30) to feel like physical hardware.

### 2. Focus Gravity
Focus is handled as a "gravitational" effect rather than a binary state.
- **useFocusGravity**: Background windows are dimmed (`opacity: 0.6`) and blurred (`blur: 2px`) to guide the user's attention.
- **Z-Index**: Focused windows automatically move to the top of the stack (`WINDOWS_MAX` tier).

### 3. Tiling and Snapping
The Tiling Window Manager (TWM) provides high-fidelity feedback.
- **Ghost Previews**: Dragging a window over a snap zone triggers a `TileZonePreview`. This preview uses a pulsing bioluminescent border to indicate the target area.
- **Mechanical Snapping**: Transitions into tiles use the same spring physics as spawning, ensuring the UI feels cohesive.

### 4. Accessibility and Reduced Motion
Spatial UX must not exclude users with motion sensitivity.
- **useReducedMotion**: Every spring-based animation must have a fallback. Typically, this means replacing `scale` and `y` offsets with simple `opacity` cross-fades.
- **Keyboard-First**: The desktop shell is fully navigable via `Cmd+Tab` (cycle), `Cmd+Arrows` (tile), and `Cmd+1-9` (direct focus).

## Layering Model
1. **Overlay**: Modals and Command Palette.
2. **Taskbar/Menu**: System chrome.
3. **Windows**: The active application surface.
4. **Widgets**: HUD elements pinned to the background.
5. **Background**: The bioluminescent void surface.
