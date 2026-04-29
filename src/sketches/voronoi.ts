import "q5";
import type { AppState } from "../lib/config";
import { CONFIG } from "../lib/config";
import { createParticles } from "../lib/particle";
import { computeVoronoi } from "../lib/voronoi-compute";
import { drawCells, drawEdges, drawPoints, drawCellIndices, drawVectorField, drawExclusionZones, drawAttractors } from "../lib/render";
import { setupGUI } from "../lib/gui";
import {
  handleMousePressed,
  handleMouseDragged,
  handleMouseReleased,
  handleDoubleClick,
  handleKeyPressed,
  initCursorAutoHide,
} from "../lib/input";
import { clearImage, computeImageCellColors } from "../lib/image-processor";

export function createVoronoiSketch(container: HTMLElement): {
  state: AppState;
  destroy: () => void;
} {
  const state: AppState = {
    particles: [],
    voronoi: null,
    polygons: [],
    paused: false,
    draggingIndex: -1,
    width: 0,
    height: 0,
    time: 0,
    gui: null,
    q5: null,
    vectorField: null,
    imageData: null,
    imageCanvas: null,
    imageCellColors: null,
    previousSpeed: CONFIG.speed,
    hudVisible: true,
    mouseIsDown: false,
    mouseShiftIsDown: false,
    mouseX: 0,
    mouseY: 0,
    exclusionZones: [],
    draggingZoneIndex: -1,
    draggingZoneHandle: null,
    draggingZoneCornerIndex: -1,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sketch = function (q5: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    q5.setup = function () {
      q5.createCanvas(q5.windowWidth, q5.windowHeight);
      q5.pixelDensity(1);
      state.width = q5.width;
      state.height = q5.height;
      state.q5 = q5;

      state.particles = createParticles(
        CONFIG.count,
        state.width,
        state.height,
      );
      setupGUI(q5, state);
      initCursorAutoHide();
    };

    q5.draw = function () {
      const dt = q5.deltaTime / 1000;

      if (CONFIG.autoAnimate && !state.paused) {
        state.time += dt * CONFIG.animationSpeed;
        for (const p of state.particles) {
          p.update(dt, q5, state);
        }
      }

      computeVoronoi(state);

      // Recompute image colors if needed (when polygons change or image is loaded)
      if (CONFIG.useImageColors && state.imageData) {
        // Recompute if colors haven't been computed yet or if polygon count changed
        if (!state.imageCellColors || state.imageCellColors.length !== state.polygons.length) {
          computeImageCellColors(state);
        }
      }

      q5.background(CONFIG.backgroundColor);

      // Draw vector field if enabled
      if (CONFIG.showVectorField) {
        drawVectorField(q5, state);
      }

      // Draw exclusion zones (behind everything else)
      if (CONFIG.attractorExclusionEnabled) {
        drawExclusionZones(q5, state);
      }

      // Draw attractors/repellers (behind cells, on top of vector field)
      if (CONFIG.attractorEnabled) {
        drawAttractors(q5, state);
      }

      if (CONFIG.showCells) drawCells(q5, state);
      if (CONFIG.showEdges) drawEdges(q5, state);
      if (CONFIG.showPoints) drawPoints(q5, state);
      if (CONFIG.showCellIndices) drawCellIndices(q5, state);
    };

    q5.windowResized = function () {
      q5.resizeCanvas(q5.windowWidth, q5.windowHeight);
      state.width = q5.width;
      state.height = q5.height;
    };

    q5.mousePressed = function () {
      if (
        q5.mouseX < 0 ||
        q5.mouseX > state.width ||
        q5.mouseY < 0 ||
        q5.mouseY > state.height
      )
        return;
      handleMousePressed(q5, state);
    };

    q5.mouseDragged = function () {
      handleMouseDragged(q5, state);
    };

    q5.mouseReleased = function () {
      handleMouseReleased(state);
    };

    q5.doubleClicked = function () {
      handleDoubleClick(q5, state);
    };

    q5.keyPressed = function () {
      handleKeyPressed(q5, state);
    };
  };

  // Q5 is loaded as a global by the q5 package
  const instance = new (window as any).Q5(sketch, container); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Wire up clearImage action
  CONFIG.clearImage = () => {
    clearImage(state);
  };

  return {
    state,
    destroy: () => {
      if (state.gui) {
        state.gui.destroy();
        state.gui = null;
      }
      // Q5 doesn't have a standard destroy, remove the canvas
      const canvas = container.querySelector("canvas");
      if (canvas) canvas.remove();
      // Remove dat.gui root elements
      const guiRoot = document.querySelector(".dg.ac");
      if (guiRoot) guiRoot.remove();
    },
  };
}
