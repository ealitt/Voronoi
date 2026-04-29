# Voronoi Viewer - Complete Technical Specification

## Executive Summary

The Voronoi Viewer is an interactive web application for creating, animating, and exporting Voronoi diagrams. It features real-time computation, multiple particle motion systems, exclusion zones, image-based color extraction, and fabrication-ready export options for laser cutting, CNC, and 3D printing.

---

## 1. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend Framework | Preact 10.x | Lightweight React alternative for UI |
| Canvas Library | Q5 2.x | p5.js compatible creative coding library |
| Build Tool | Vite 7.x | Fast development and optimized builds |
| Voronoi Computation | D3-Delaunay 6.x | Efficient Delaunay triangulation & Voronoi diagrams |
| GUI Controls | dat.gui 0.7.x | Floating control panel for settings |
| Styling | Tailwind CSS 4.x | Utility-first CSS framework |
| PWA | vite-plugin-pwa 1.x | Offline support and installability |
| Language | TypeScript 5.x | Type-safe development |

---

## 2. Application Architecture

### File Structure

```
src/
├── main.tsx                   # Entry point, mounts Preact app
├── app.tsx                    # Root component, manages global state
├── index.css                  # Global styles and CSS variables
├── types.d.ts                 # TypeScript module declarations
│
├── components/
│   ├── voronoi-canvas.tsx     # Main canvas container component
│   ├── keyboard-help.tsx      # Help overlay with shortcuts
│   ├── settings-modal.tsx     # GUI settings (ranges, presets)
│   └── image-dropzone.tsx     # Drag-and-drop image upload UI
│
├── lib/
│   ├── config.ts              # CONFIG object, AppState interface, constants
│   ├── particle.ts            # Particle class with all motion algorithms
│   ├── voronoi-compute.ts     # Voronoi computation & smoothing
│   ├── render.ts              # All drawing functions (cells, edges, etc.)
│   ├── color.ts               # Color utilities (hexToRGB, getCellColor)
│   ├── palettes.ts            # 20 built-in color palettes
│   ├── gui.ts                 # dat.GUI setup and controller management
│   ├── input.ts               # Mouse/keyboard input handling
│   ├── image-processor.ts     # Image color extraction & density
│   ├── lloyd-relaxation.ts    # Lloyd relaxation algorithm
│   ├── polygon-clip.ts        # Exclusion zone clipping
│   ├── preset.ts              # Save/load configuration presets
│   ├── svg-export.ts          # SVG export functionality
│   ├── png-export.ts          # PNG export functionality
│   └── base-path.ts           # GitHub Pages base path utilities
│
└── sketches/
    └── voronoi.ts             # Q5 sketch (setup, draw loop)
```

### Data Flow

1. **State Management**: Centralized `AppState` object contains:
   - Particles array
   - Computed polygons
   - Canvas dimensions
   - Mouse/keyboard state
   - GUI reference
   - Exclusion zones
   - Image data (when loaded)

2. **Render Loop** (60fps via Q5):
   ```
   updateParticles() → computeVoronoi() → render()
   ```

3. **Event Flow**:
   - User input → dat.GUI changes CONFIG
   - Mouse/keyboard → input handlers modify AppState
   - CONFIG changes trigger reactive updates

---

## 3. Core Algorithms

### 3.1 Voronoi Computation

**Algorithm**: Fortune's algorithm (via D3-Delaunay)

```typescript
// 1. Create Delaunay triangulation from particle positions
const delaunay = Delaunay.from(particles, p => p.x, p => p.y)

// 2. Generate Voronoi diagram with canvas bounds
const voronoi = delaunay.voronoi([0, 0, width, height])

// 3. Extract polygon for each particle
const cell = voronoi.cellPolygon(i)
```

**Output**: Array of coordinate arrays `[[x1,y1], [x2,y2], ...]` for each cell

### 3.2 Polygon Smoothing

**Algorithm**: Chaikin's corner cutting via cubic bezier curves

1. Calculate midpoints of each edge
2. For each midpoint, calculate control points using neighboring midpoints
3. Control point formula:
   ```
   cp1 = p1 + (p2 - p0) / 6 * tension
   cp2 = p2 - (p3 - p1) / 6 * tension
   ```
4. Render cubic bezier curves between midpoints

**Tension Range**: 0-1, where 0 = original polygon, 1 = maximum smoothing

### 3.3 Lloyd Relaxation

**Purpose**: Evenly distribute particles by moving them toward Voronoi cell centroids

```typescript
// 1. Calculate centroid of each cell using polygon area formula
// 2. Move particle toward centroid by amount (default 0.5)
particle.x += (centroid.x - particle.x) * amount
particle.y += (centroid.y - particle.y) * amount
```

**Centroid Formula** (shoelace method):
```
cx = Σ(xi + xi+1) * cross(xi, yi+1) / (6 * area)
cy = Σ(yi + yi+1) * cross(xi, yi+1) / (6 * area)
```

### 3.4 Particle Motion Algorithms

#### Vector Field
- Samples 3D Perlin noise at `(noiseX * scale, noiseY * scale, time)`
- Maps noise (-1 to 1) to angle (0 to 2π)
- Converts angle to velocity vector
- Optional curl noise component
- Optional Brownian jitter

#### Perlin Drift
- Each particle has unique seed
- Samples 1D noise over time: `noise(seed + time * 0.2 * speed)`
- Two samples for x/y independence

#### Curl Noise
- Approximates curl of noise field
- `vx = noise(y + ε) - noise(y - ε)`
- `vy = -(noise(x + ε) - noise(x - ε))`

#### Brownian Motion
- Random velocity changes: `vx += (random() - 0.5) * speed * 2`
- Velocity decay: `vx *= 0.95`

#### Orbital Motion
- Particles orbit around anchor point
- `x = anchorX + cos(time * freq * speed + phase) * radius`
- `y = anchorY + sin(time * freq * speed * 1.3 + phase) * radius`

#### Wave Motion
- Sine wave flow pattern
- `vx = sin(noiseY * 0.01 + time * speed + offset)`
- `vy = cos(noiseX * 0.01 + time * speed + offset)`

#### Boid Flocking
Three rules (Reynolds, 1986):
1. **Separation**: Steer away from nearby boids
2. **Alignment**: Match velocity of neighbors
3. **Cohesion**: Steer toward center of neighbors

With wrapping distance calculation for toroidal space.

### 3.5 Exclusion Zone Clipping

**Algorithm**: Sutherland-Hodgman polygon clipping

For each cell polygon and each exclusion zone:
1. Test each polygon edge against zone boundary
2. Keep vertices inside, clip to boundary for edges crossing
3. For circles, calculate intersection points
4. Return array of resulting polygons (may be empty)

---

## 4. Configuration Reference

### Particle Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| count | number | 1-5000 | 100 |
| motion | enum | vectorfield, perlin, curl, brownian, orbit, wave, boid, none | none |
| speed | number | 0-20 | 1 |
| edgeBehavior | enum | wrap, bounce, clamp | wrap |

### Motion Parameters

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| vectorFieldScale | number | 0.001-0.02 | 0.005 |
| vectorFieldTimeScale | number | 0-5 | 1 |
| curlNoiseAmount | number | 0-5 | 1 |
| brownianAmount | number | 0-5 | 0.5 |
| orbitSpeed | number | 0-10 | 1 |
| orbitRadius | number | 5-200 | 30 |
| boidSeparation | number | 0-10 | 2 |
| boidAlignment | number | 0-10 | 1 |
| boidCohesion | number | 0-10 | 1 |
| boidPerception | number | 10-500 | 100 |
| boidMaxSpeed | number | 0.1-20 | 2 |
| boidMaxForce | number | 0.001-2 | 0.1 |

### Attractor Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| attractorEnabled | boolean | - | false |
| attractorStrength | number | 10-200 | 50 |
| attractorRadius | number | 20-500 | 150 |
| attractorDecay | number | 0.9-0.999 | 0.98 |
| showAttractorField | boolean | - | true |

### Display Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| showPoints | boolean | - | true |
| showEdges | boolean | - | true |
| showCells | boolean | - | true |
| showVectorField | boolean | - | false |
| showCellIndices | boolean | - | false |
| showExclusionOutlines | boolean | - | true |
| smoothCells | boolean | - | false |
| smoothing | number | 0-1 | 0.5 |
| cellGap | number | 0-10 | 0 |
| cellFillAlpha | number | 0-1 | 0.8 |

### Style Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| palette | string | 21 palettes + "Random" | "Sunset" |
| backgroundColor | hex color | - | "#111111" |
| edgeColor | hex color | - | "#333333" |
| edgeWeight | number | 0.5-20 | 1 |
| pointSize | number | 1-50 | 4 |
| pointStyle | enum | fill, stroke, both, none | fill |
| pointColor | hex color | - | "#ffffff" |
| pointStrokeWeight | number | 0.5-5 | 1 |
| blendMode | enum | 12 modes (BLEND, MULTIPLY, etc.) | BLEND |

### Gradient Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| useGradientFill | boolean | - | false |
| gradientType | enum | linear, radial, conical | linear |
| gradientAngle | number | 0-360 | 0 |
| gradientStops | number | 2-6 | 3 |

### Vector Field Visualization

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| vectorGridSize | number | 10-100 | 40 |
| vectorLineLength | number | 5-50 | 15 |

### Fabrication Settings

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| fabricationMode | enum | none, laser-cut, laser-engrave, cnc, 3d-print | none |
| kerfOffset | number | -0.5 to 0.5 | 0 |
| safeZone | number | 0-50 | 5 |
| layerHeight | number | 0.1-1 | 0.2 |
| baseThickness | number | 0.5-10 | 2 |

---

## 5. Color Palettes

Built-in palettes (21 total):

| Name | Colors |
|------|--------|
| Sunset | #ff6b6b, #feca57, #ff9ff3, #54a0ff, #5f27cd |
| Ocean | #0fb9b1, #2bcbba, #45aaf2, #4b7bec, #3867d6 |
| Forest | #26de81, #20bf6b, #0fb9b1, #2d98da, #4b6584 |
| Mono | #222222, #444444, #666666, #888888, #aaaaaa, #cccccc |
| Candy | #ffafcc, #ffc8dd, #cdb4db, #bde0fe, #a2d2ff |
| Neon | #f72585, #7209b7, #3a0ca3, #4361ee, #4cc9f0 |
| Aurora | #00d4ff, #00ff9f, #ffeb3b, #ff6b6b, #c56cf0 |
| Ember | #ff9f43, #ff6b6b, #ee5a6f, #c44569, #6c5ce7 |
| Oceanic | #0077b6, #00b4d8, #90e0ef, #caf0f8, #03045e |
| Desert | #e07a5f, #3d405b, #81b29a, #f2cc8f, #f4f1de |
| Grape | #7b2cbf, #9d4edd, #c77dff, #e0aaff, #f0e6ff |
| Berry | #880d1e, #c9184a, #ff4d6d, #ff758f, #ff8fa3 |
| ForestDark | #1b4332, #2d6a4f, #40916c, #52b788, #74c69d |
| Sunset2 | #ff595e, #ff924c, #ffca3a, #c5ca30, #8ac926 |
| Cool | #0081a7, #00afb9, #00cdc2, #a8ebf0, #f0f3bd |
| Heatmap | #0000ff, #00ffff, #00ff00, #ffff00, #ff0000 |
| Plasma | #0d0887, #6a00a8, #b12a90, #e16462, #fca636 |
| Viridis | #440154, #482878, #3e4989, #31688e, #26828e |
| Solar | #5e3c58, #874c77, #b86786, #e891a3, #fbc4a6 |
| Magma | #000004, #1c1144, #641c75, #c33f55, #feaf2d |

**Color Assignment**: Each cell is assigned a color from the palette using: `palette[cellIndex % palette.length]`

---

## 6. User Interactions

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle pause/resume animation |
| A | Previous color palette |
| S | Next color palette |
| R | Randomize particle positions |
| V | Toggle HUD (GUI visibility) |
| F | Toggle fullscreen |
| E | Export as SVG |
| H | Show/hide keyboard help |
| Enter | Close help overlay |

### Mouse Interactions

| Action | Behavior |
|--------|----------|
| Click + Drag | Move nearest particle |
| Double Click | Add new particle at cursor |
| Alt + Click | Remove nearest particle |
| Shift + Click | Add particle (when attractors disabled) |
| Click (motion active, attractors enabled) | Place attractor |
| Shift + Click (motion active, attractors enabled) | Place repeller |
| Drag zone center | Move exclusion zone |
| Drag zone corner | Resize exclusion zone |

### Cursor Behavior

- Auto-hides after 2 seconds of inactivity
- Reappears on any input event
- Shows "grab" cursor when hovering over draggable elements

---

## 7. Rendering Pipeline

Each frame (60fps):

```
1. Clear canvas (background color)
2. Update particle positions (if not paused)
3. Recompute Voronoi diagram
4. Draw elements in order:
   a. Vector field (if enabled)
   b. Exclusion zones (if outlines enabled)
   c. Attractor/repeller indicator (if mouse down)
   d. Cells (with fill, smoothing, gap)
   e. Edges (stroke)
   f. Points (vertices)
   g. Cell indices (if enabled)
```

### Blend Modes

Supported blend modes (via canvas globalCompositeOperation):
- BLEND (default)
- MULTIPLY
- SCREEN
- OVERLAY
- DARKEN
- LIGHTEN
- COLOR_DODGE
- COLOR_BURN
- HARD_LIGHT
- SOFT_LIGHT
- DIFFERENCE
- EXCLUSION

---

## 8. Export Functionality

### SVG Export

**Features**:
- Configurable scale (0.5x to 4x)
- Separate layers for cuts, engravings, fills
- Smooth bezier curves when smoothing enabled
- Kerf compensation for laser cutting
- Safe zone padding

**Output Structure**:
```xml
<svg viewBox="0 0 width height">
  <!-- Cut layer -->
  <g id="cut">...</g>
  <!-- Engrave layer -->
  <g id="engrave">...</g>
  <!-- Fill layer -->
  <g id="fill">...</g>
</svg>
```

### Fabrication Modes

#### Laser Cut
- Cut lines: Cell boundaries
- Engrave lines: Optional interior details
- Kerf offset applied to cut paths
- Optimized path order for efficiency

#### Laser Engrave
- Score lines only (no through cuts)
- Variable stroke weights based on settings
- Single layer output

#### CNC
- Rough cut: Offset outward paths
- Finish pass: Exact boundaries
- Tab generation for part retention

#### 3D Print
- Generates OpenSCAD script
- Each cell becomes extruded polygon
- Variable layer heights
- Base plate generation

**OpenSCAD Output Example**:
```openscad
// Cell 0
color([r/255, g/255, b/255])
linear_extrude(height=layerHeight)
polygon(points=[[x1,y1], [x2,y2], ...]);
```

### PNG Export

- High-resolution canvas capture
- Optional 2x scale for retina displays
- Preserves all visual effects (blend modes, etc.)
- Transparent background option

---

## 9. PWA Features

### Manifest

```json
{
  "name": "Voronoi Viewer",
  "short_name": "Voronoi",
  "description": "Interactive animated Voronoi diagram viewer.",
  "theme_color": "#111111",
  "background_color": "#111111",
  "display": "standalone",
  "icons": [
    {"src": "pwa-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "pwa-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "pwa-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
```

### Service Worker

- Precaches essential assets
- Offline functionality for core features
- Network-first strategy for updates
- Cache versioning for busting

---

## 10. Image Processing Features

### Supported Formats
- PNG, JPG, HEIC (via browser support)

### Color Extraction

1. Image is drawn to hidden canvas
2. For each Voronoi cell, sample pixel colors at cell centroid
3. Extract average RGB value
4. Assign as cell color override

### Point Density Mode

When image loaded:
- Add particles preferentially in darker/brighter regions
- Threshold-based placement
- Density control via particle count

### Image State Management

- Image displayed in background when active
- "Clear Image" button returns to normal mode
- Image mode indicator in corner of screen

---

## 11. Performance Considerations

### Optimization Strategies

1. **Polygon Caching**: Smooth polygons cached when not changing
2. **Lazy Clipping**: Exclusion zones only applied when enabled
3. **Conditional Rendering**: Skip drawing disabled elements
4. **Efficient Boid Search**: Distance-squared checks avoid sqrt
5. **Noise Space Continuity**: Separate noiseX/Y prevents sampling jumps

### Recommended Limits

| Setting | Recommended Max | Notes |
|---------|-----------------|-------|
| Particle Count | 1000 | Above 2000 may lag on mobile |
| Exclusion Zones | 5 | Each adds clipping overhead |
| Smoothing | 0.5 | Higher values more expensive |
| Cell Gap | 5 | Gap calculation is O(vertices) |

---

## 12. Build & Deployment

### Development
```bash
bun install
bun run dev  # Hot reload at localhost:5173
```

### Production Build
```bash
bun run build              # Regular build
bun run test:pages-build   # GitHub Pages build
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| VITE_BASE_PATH | Base URL for deployment (default: "/") |
| VITE_ENABLE_PWA | Enable PWA features ("true"/"false") |

### GitHub Actions

Two workflows:
1. **CI**: Runs TypeScript check and builds on push to main
2. **Deploy**: Builds and deploys to GitHub Pages on push to main

---

## 13. Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core functionality | ✓ | ✓ | ✓ | ✓ |
| PWA | ✓ | ✓ | ✓ | ✓ |
| File input (HEIC) | ✗ | ✗ | ✓ | ✗ |
| WebGL blend modes | ✓ | ✓ | ✓ | ✓ |

**Minimum Versions**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## 14. Accessibility

- Keyboard shortcuts for all major functions
- High contrast option (via palette selection)
- Full keyboard navigation of dat.GUI controls
- Screen reader support for exported SVG (title/desc tags)

---

## 15. Future Enhancement Ideas

While not in current implementation, potential additions:
- Audio reactivity for motion
- Custom palette editor
- Voronoi cell animation (individual color cycling)
- Export to other formats (DXF, PDF)
- Collaborative editing (real-time sync)
- VR/AR viewing mode
- Cellular automaton integration
- 3D Voronoi visualization

---

## Appendix: Quick Start for Recreation

### Minimal Implementation Steps

1. **Setup project**: `npm init` and install dependencies
2. **Create canvas**: Initialize Q5 sketch
3. **Particle system**: Implement Particle class with position/velocity
4. **Voronoi computation**: Use D3-Delaunay
5. **Render loop**: Draw cells, edges, points
6. **Controls**: Add dat.GUI for basic settings
7. **Add features incrementally**: motion, smoothing, exclusions, etc.

### Key Code Snippets

**Voronoi Computation**:
```typescript
import { Delaunay } from "d3-delaunay";

const delaunay = Delaunay.from(particles, p => p.x, p => p.y);
const voronoi = delaunay.voronoi([0, 0, width, height]);
const cell = voronoi.cellPolygon(i);
```

**Q5 Sketch Setup**:
```typescript
import Q5 from "q5";

new Q5((q5) => {
  q5.setup = () => {
    q5.createCanvas(window.innerWidth, window.innerHeight);
  };

  q5.draw = () => {
    // Update and render
  };
});
```

---

*This specification is current as of April 2026. For the latest code, visit: https://github.com/ealitt/Voronoi*
