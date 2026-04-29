import { CONFIG, type AppState } from "./config";
import { PALETTES } from "./palettes";
import { Particle } from "./particle";

function findNearestParticle(
  particles: Particle[],
  mx: number,
  my: number,
  maxDist: number,
): number {
  let minD = maxDist * maxDist;
  let idx = -1;
  for (let i = 0; i < particles.length; i++) {
    const dx = particles[i].x - mx;
    const dy = particles[i].y - my;
    const d = dx * dx + dy * dy;
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return idx;
}

function updateGUIDisplay(state: AppState): void {
  if (state.gui) {
    state.gui.updateDisplay();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleMousePressed(q5: any, state: AppState): void {
  // Track mouse state
  state.mouseIsDown = true;
  state.mouseX = q5.mouseX;
  state.mouseY = q5.mouseY;
  state.mouseShiftIsDown = q5.keyIsDown(q5.SHIFT);

  // Check if clicking on exclusion zone handle
  if (CONFIG.attractorExclusionEnabled && state.exclusionZones.length > 0) {
    const zoneHit = findNearestZoneHandle(state, q5.mouseX, q5.mouseY);
    if (zoneHit.index >= 0) {
      state.draggingZoneIndex = zoneHit.index;
      state.draggingZoneHandle = zoneHit.handle;
      state.draggingZoneCornerIndex = zoneHit.cornerIndex;
      return;
    }
  }

  // Check if clicking on existing particle (for dragging)
  const hitRadius = Math.max(CONFIG.pointSize * 2, 15);
  const idx = findNearestParticle(
    state.particles,
    q5.mouseX,
    q5.mouseY,
    hitRadius,
  );

  // Drag existing particle
  if (idx >= 0) {
    state.draggingIndex = idx;
    return;
  }

  // Add point with Shift+Click (only when attractors disabled or motion inactive)
  if (q5.keyIsDown(q5.SHIFT) && (!CONFIG.attractorEnabled || CONFIG.motion === "none" || state.paused)) {
    const p = new Particle(q5.mouseX, q5.mouseY);
    state.particles.push(p);
    CONFIG.count = state.particles.length;
    updateGUIDisplay(state);
    return;
  }

  // Remove particle with Alt+Click
  if (q5.keyIsDown(q5.ALT) || q5.keyIsDown(18)) {
    const removeIdx = findNearestParticle(
      state.particles,
      q5.mouseX,
      q5.mouseY,
      Infinity,
    );
    if (removeIdx >= 0) {
      state.particles.splice(removeIdx, 1);
      CONFIG.count = state.particles.length;
      updateGUIDisplay(state);
    }
    return;
  }

  // Add point on regular click (when not using attractors)
  if (!CONFIG.attractorEnabled || CONFIG.motion === "none" || state.paused) {
    const p = new Particle(q5.mouseX, q5.mouseY);
    state.particles.push(p);
    CONFIG.count = state.particles.length;
    updateGUIDisplay();
  }
  // If attractors are enabled and motion is active, the attractor effect
  // will be applied during particle updates via the mouse state
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleMouseDragged(q5: any, state: AppState): void {
  // Update mouse position for attractor effect
  state.mouseX = q5.mouseX;
  state.mouseY = q5.mouseY;

  // Drag exclusion zone
  if (state.draggingZoneIndex >= 0 && state.draggingZoneIndex < state.exclusionZones.length) {
    const zone = state.exclusionZones[state.draggingZoneIndex];

    if (state.draggingZoneHandle === "center") {
      if (zone.type === "circle") {
        zone.x = q5.mouseX;
        zone.y = q5.mouseY;
      } else {
        // For rect/ellipse, move by center
        const oldCenterX = zone.x + zone.width / 2;
        const oldCenterY = zone.y + zone.height / 2;
        const dx = q5.mouseX - oldCenterX;
        const dy = q5.mouseY - oldCenterY;
        zone.x += dx;
        zone.y += dy;
      }
    } else if (state.draggingZoneHandle === "corner" && zone.type === "rectangle") {
      // Resize rectangle from corner
      const corners = [
        { x: zone.x, y: zone.y }, // 0: top-left
        { x: zone.x + zone.width, y: zone.y }, // 1: top-right
        { x: zone.x, y: zone.y + zone.height }, // 2: bottom-left
        { x: zone.x + zone.width, y: zone.y + zone.height }, // 3: bottom-right
      ];

      if (state.draggingZoneCornerIndex === 0) {
        // Top-left corner
        zone.width += zone.x - q5.mouseX;
        zone.height += zone.y - q5.mouseY;
        zone.x = q5.mouseX;
        zone.y = q5.mouseY;
      } else if (state.draggingZoneCornerIndex === 1) {
        // Top-right corner
        zone.width = q5.mouseX - zone.x;
        zone.height += zone.y - q5.mouseY;
        zone.y = q5.mouseY;
      } else if (state.draggingZoneCornerIndex === 2) {
        // Bottom-left corner
        zone.width += zone.x - q5.mouseX;
        zone.x = q5.mouseX;
        zone.height = q5.mouseY - zone.y;
      } else if (state.draggingZoneCornerIndex === 3) {
        // Bottom-right corner
        zone.width = q5.mouseX - zone.x;
        zone.height = q5.mouseY - zone.y;
      }

      // Minimum size constraint
      zone.width = Math.max(20, zone.width);
      zone.height = Math.max(20, zone.height);
    }

    return;
  }

  // Drag particle
  if (
    state.draggingIndex >= 0 &&
    state.draggingIndex < state.particles.length
  ) {
    const p = state.particles[state.draggingIndex];
    p.x = q5.mouseX;
    p.y = q5.mouseY;
    p.vx = 0;
    p.vy = 0;
    p.anchorX = p.x;
    p.anchorY = p.y;
  }
}

export function handleMouseReleased(state: AppState): void {
  state.mouseIsDown = false;
  state.mouseShiftIsDown = false;
  state.draggingIndex = -1;
  state.draggingZoneIndex = -1;
  state.draggingZoneHandle = null;
  state.draggingZoneCornerIndex = -1;
}

/**
 * Find if mouse is over an exclusion zone handle
 */
function findNearestZoneHandle(
  state: AppState,
  mx: number,
  my: number,
): { index: number; handle: "center" | "corner" | null; cornerIndex: number } {
  const handleRadius = 12;

  for (let i = 0; i < state.exclusionZones.length; i++) {
    const zone = state.exclusionZones[i];

    if (zone.type === "circle") {
      const dx = mx - zone.x;
      const dy = my - zone.y;
      if (dx * dx + dy * dy < handleRadius * handleRadius) {
        return { index: i, handle: "center", cornerIndex: -1 };
      }
    } else {
      // Check center handle
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      const dx = mx - centerX;
      const dy = my - centerY;
      if (dx * dx + dy * dy < handleRadius * handleRadius) {
        return { index: i, handle: "center", cornerIndex: -1 };
      }

      // Check corner handles for rectangles
      if (zone.type === "rectangle") {
        const corners = [
          { x: zone.x, y: zone.y },
          { x: zone.x + zone.width, y: zone.y },
          { x: zone.x, y: zone.y + zone.height },
          { x: zone.x + zone.width, y: zone.y + zone.height },
        ];

        for (let j = 0; j < corners.length; j++) {
          const c = corners[j];
          const cdx = mx - c.x;
          const cdy = my - c.y;
          if (cdx * cdx + cdy * cdy < handleRadius * handleRadius) {
            return { index: i, handle: "corner", cornerIndex: j };
          }
        }
      }
    }
  }

  return { index: -1, handle: null, cornerIndex: -1 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleDoubleClick(q5: any, state: AppState): void {
  const p = new Particle(q5.mouseX, q5.mouseY);
  state.particles.push(p);
  CONFIG.count = state.particles.length;
  updateGUIDisplay(state);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleKeyPressed(q5: any, state: AppState): void {
  if (q5.key === " ") {
    state.paused = !state.paused;
  } else if (q5.key === "e" || q5.key === "E") {
    CONFIG.exportSVG();
  } else if (q5.key === "r" || q5.key === "R") {
    CONFIG.randomize();
  } else if (q5.key === "a" || q5.key === "A") {
    previousPalette();
  } else if (q5.key === "s" || q5.key === "S") {
    nextPalette();
  } else if (q5.key === "v" || q5.key === "V") {
    toggleHUD(state);
  } else if (q5.key === "f" || q5.key === "F") {
    toggleFullscreen();
  }
}

function nextPalette(): void {
  const names = Object.keys(PALETTES);
  const currentIndex = names.indexOf(CONFIG.palette);
  const nextIndex = (currentIndex + 1) % names.length;
  CONFIG.palette = names[nextIndex];
  if (CONFIG.gui) {
    CONFIG.gui.updateDisplay();
  }
}

function previousPalette(): void {
  const names = Object.keys(PALETTES);
  const currentIndex = names.indexOf(CONFIG.palette);
  const prevIndex = (currentIndex - 1 + names.length) % names.length;
  CONFIG.palette = names[prevIndex];
  if (CONFIG.gui) {
    CONFIG.gui.updateDisplay();
  }
}

function toggleHUD(state: AppState): void {
  state.hudVisible = !state.hudVisible;

  const guiContainer = document.querySelector(".dg.ac") as HTMLElement;
  if (guiContainer) {
    guiContainer.style.display = state.hudVisible ? "" : "none";
  }

  // Hide all HUD elements
  const hudSelectors = [
    ".settings-toggle-btn",
    ".upload-hint-btn",
    ".image-mode-indicator",
    ".help-toggle",
  ];

  hudSelectors.forEach((selector) => {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      el.style.display = state.hudVisible ? "" : "none";
    }
  });
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// ========================================
// Cursor Auto-Hide Functionality
// ========================================

let cursorIdleTime = 0;
let lastTimestamp = 0;
const CURSOR_HIDE_DELAY = 2000; // 2 seconds of inactivity

let isCursorAutoHideEnabled = false;

export function initCursorAutoHide(): void {
  if (isCursorAutoHideEnabled) return;
  isCursorAutoHideEnabled = true;

  // Track mouse/keyboard activity
  document.addEventListener("mousemove", resetCursorIdle);
  document.addEventListener("mousedown", resetCursorIdle);
  document.addEventListener("keydown", resetCursorIdle);
  document.addEventListener("touchstart", resetCursorIdle);
  document.addEventListener("touchmove", resetCursorIdle);

  // Start the idle timer loop
  requestAnimationFrame(updateCursorIdle);
}

function resetCursorIdle(): void {
  cursorIdleTime = 0;
  const canvas = document.querySelector("canvas");
  if (canvas) {
    canvas.style.cursor = "default";
  }
}

function updateCursorIdle(timestamp: number): void {
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
  }

  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  cursorIdleTime += dt;

  if (cursorIdleTime >= CURSOR_HIDE_DELAY) {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.style.cursor = "none";
    }
  }

  requestAnimationFrame(updateCursorIdle);
}
