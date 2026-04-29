import * as dat from "dat.gui";
import { CONFIG, DEFAULT_CONFIG, type AppState } from "./config";
import { PALETTES, shufflePalette } from "./palettes";
import { Particle, createParticles, syncParticleCount } from "./particle";
import { exportSVG, exportForLaser, exportForCNC, exportFor3DPrint } from "./svg-export";
import { exportPNG } from "./png-export";
import { relaxLloyd } from "./lloyd-relaxation";
import { clearImage, distributeParticlesByImage, computeImageCellColors } from "./image-processor";
import {
  savePreset,
  loadPresets,
  applyPreset,
  saveCurrentState,
  restoreCurrentState,
  type Preset,
} from "./preset";

const SETTINGS_KEY = "voronoi-gui-settings";

interface RangeSetting {
  min: number;
  max: number;
  step: number;
}

interface SettingsData {
  count: RangeSetting;
  speed: RangeSetting;
  cellFillAlpha: RangeSetting;
  edgeWeight: RangeSetting;
  pointSize: RangeSetting;
  vectorFieldScale: RangeSetting;
  smoothing: RangeSetting;
  cellGap: RangeSetting;
  gradientAngle: RangeSetting;
  exportScale: RangeSetting;
}

const DEFAULT_SETTINGS: SettingsData = {
  count: { min: 1, max: 5000, step: 1 },
  speed: { min: 0, max: 20, step: 0.1 },
  cellFillAlpha: { min: 0, max: 1, step: 0.05 },
  edgeWeight: { min: 0.5, max: 20, step: 0.5 },
  pointSize: { min: 1, max: 50, step: 1 },
  vectorFieldScale: { min: 0.001, max: 0.02, step: 0.001 },
  smoothing: { min: 0, max: 1, step: 0.05 },
  cellGap: { min: 0, max: 10, step: 0.5 },
  gradientAngle: { min: 0, max: 360, step: 15 },
  exportScale: { min: 0.5, max: 4, step: 0.5 },
};

function loadSettings(): SettingsData {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: SettingsData): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export { type SettingsData, saveSettings };

// Store preset name for saving
let presetName = "My Preset";
let selectedPreset = "";

/**
 * Setup dat.gui with comprehensive controls
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupGUI(q5: any, state: AppState): dat.GUI {
  // Restore previous state
  restoreCurrentState(state, (count) => {
    syncParticleCount(state.particles, count, state.width, state.height);
  });

  // Load custom settings for ranges
  const settings = loadSettings();

  const gui = new dat.GUI({ autoPlace: true, width: 420 });
  state.gui = gui;

  // Position GUI
  const guiContainer = document.querySelector(".dg.ac") as HTMLElement;
  if (guiContainer) {
    guiContainer.style.position = "fixed";
    guiContainer.style.top = "8px";
    guiContainer.style.right = "8px";
  }

  const updateGUIDisplay = () => {
    gui.updateDisplay();
  };

  const saveState = () => {
    saveCurrentState(state);
  };

  // === PARTICLES FOLDER ===
  const fParticles = gui.addFolder("Particles");
  fParticles
    .add(CONFIG, "count", settings.count.min, settings.count.max, settings.count.step)
    .name("Count")
    .onChange((v: number) => {
      syncParticleCount(state.particles, v, state.width, state.height);
      saveState();
    });
  // Store controller references for conditional visibility
  const controllers: { [key: string]: any } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

  let updateControllerVisibility = () => {
    const motion = CONFIG.motion;
    const show = (controller: any, visible: boolean) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (controller) {
        // Find the parent li.cr element and hide that
        let el = controller.domElement as HTMLElement;
        // Walk up to find the li.cr or li element
        while (el && !el.classList.contains('cr') && el.tagName !== 'LI') {
          el = el.parentElement as HTMLElement;
        }
        if (el) {
          el.style.display = visible ? '' : 'none';
        }
      }
    };

    // Always show
    show(controllers.motion, true);
    show(controllers.speed, true);
    show(controllers.edgeBehavior, true);

    // Motion-specific controls
    const isVectorField = motion === 'vectorfield' || motion === 'curl';
    show(controllers.vectorFieldScale, isVectorField);
    show(controllers.vectorFieldTimeScale, isVectorField);
    show(controllers.curlNoiseAmount, motion === 'vectorfield');
    show(controllers.brownianAmount, motion === 'vectorfield' || motion === 'brownian');

    show(controllers.orbitSpeed, motion === 'orbit');
    show(controllers.orbitRadius, motion === 'orbit');

    show(controllers.boidSeparation, motion === 'boid');
    show(controllers.boidAlignment, motion === 'boid');
    show(controllers.boidCohesion, motion === 'boid');
    show(controllers.boidPerception, motion === 'boid');
    show(controllers.boidMaxSpeed, motion === 'boid');
    show(controllers.boidMaxForce, motion === 'boid');
  };

  const cMotion = fParticles
    .add(CONFIG, "motion", [
      "vectorfield",
      "perlin",
      "curl",
      "brownian",
      "orbit",
      "wave",
      "boid",
      "none",
    ])
    .name("Motion")
    .onChange((v: string) => {
      saveState();
      updateControllerVisibility();
    });
  controllers.motion = cMotion;

  const cSpeed = fParticles.add(CONFIG, "speed", settings.speed.min, settings.speed.max, settings.speed.step).name("Speed").onChange(saveState);
  controllers.speed = cSpeed;

  const cVectorFieldScale = fParticles
    .add(CONFIG, "vectorFieldScale", settings.vectorFieldScale.min, settings.vectorFieldScale.max, settings.vectorFieldScale.step)
    .name("Noise Scale")
    .onChange(saveState);
  controllers.vectorFieldScale = cVectorFieldScale;

  const cVectorFieldTimeScale = fParticles
    .add(CONFIG, "vectorFieldTimeScale", 0, 5, 0.1)
    .name("Time Scale")
    .onChange(saveState);
  controllers.vectorFieldTimeScale = cVectorFieldTimeScale;

  const cCurlNoiseAmount = fParticles
    .add(CONFIG, "curlNoiseAmount", 0, 5, 0.1)
    .name("Curl Amount")
    .onChange(saveState);
  controllers.curlNoiseAmount = cCurlNoiseAmount;

  const cBrownianAmount = fParticles
    .add(CONFIG, "brownianAmount", 0, 5, 0.1)
    .name("Jitter")
    .onChange(saveState);
  controllers.brownianAmount = cBrownianAmount;

  const cOrbitSpeed = fParticles
    .add(CONFIG, "orbitSpeed", 0, 10, 0.1)
    .name("Orbit Speed")
    .onChange(saveState);
  controllers.orbitSpeed = cOrbitSpeed;

  const cOrbitRadius = fParticles
    .add(CONFIG, "orbitRadius", 5, 200, 5)
    .name("Orbit Radius")
    .onChange(saveState);
  controllers.orbitRadius = cOrbitRadius;

  // Boid-specific controls with expanded ranges
  const cBoidSeparation = fParticles
    .add(CONFIG, "boidSeparation", 0, 10, 0.1)
    .name("Separation")
    .onChange(saveState);
  controllers.boidSeparation = cBoidSeparation;

  const cBoidAlignment = fParticles
    .add(CONFIG, "boidAlignment", 0, 10, 0.1)
    .name("Alignment")
    .onChange(saveState);
  controllers.boidAlignment = cBoidAlignment;

  const cBoidCohesion = fParticles
    .add(CONFIG, "boidCohesion", 0, 10, 0.1)
    .name("Cohesion")
    .onChange(saveState);
  controllers.boidCohesion = cBoidCohesion;

  const cBoidPerception = fParticles
    .add(CONFIG, "boidPerception", 10, 500, 10)
    .name("Perception")
    .onChange(saveState);
  controllers.boidPerception = cBoidPerception;

  const cBoidMaxSpeed = fParticles
    .add(CONFIG, "boidMaxSpeed", 0.1, 20, 0.1)
    .name("Max Speed")
    .onChange(saveState);
  controllers.boidMaxSpeed = cBoidMaxSpeed;

  const cBoidMaxForce = fParticles
    .add(CONFIG, "boidMaxForce", 0.001, 2, 0.001)
    .name("Max Force")
    .onChange(saveState);
  controllers.boidMaxForce = cBoidMaxForce;

  const cEdgeBehavior = fParticles
    .add(CONFIG, "edgeBehavior", ["wrap", "bounce", "clamp"])
    .name("Edges")
    .onChange(saveState);
  controllers.edgeBehavior = cEdgeBehavior;

  // Initial visibility update
  setTimeout(updateControllerVisibility, 100);

  fParticles.open();

  // === ATTRACTORS FOLDER ===
  const fAttractors = gui.addFolder("Attractors");

  fAttractors
    .add(CONFIG, "attractorEnabled")
    .name("Enable")
    .onChange(saveState);

  const cAttractorEnabled = fAttractors.__controllers[fAttractors.__controllers.length - 1];

  fAttractors
    .add(CONFIG, "showAttractorField")
    .name("Show Field")
    .onChange(saveState);
  controllers.showAttractorField = fAttractors.__controllers[fAttractors.__controllers.length - 1];

  fAttractors
    .add(CONFIG, "attractorStrength", 10, 200, 5)
    .name("Strength")
    .onChange(saveState);
  controllers.attractorStrength = fAttractors.__controllers[fAttractors.__controllers.length - 1];

  fAttractors
    .add(CONFIG, "attractorRadius", 20, 500, 10)
    .name("Radius")
    .onChange(saveState);
  controllers.attractorRadius = fAttractors.__controllers[fAttractors.__controllers.length - 1];

  fAttractors
    .add(CONFIG, "attractorDecay", 0.9, 0.999, 0.001)
    .name("Decay")
    .onChange(saveState);
  controllers.attractorDecay = fAttractors.__controllers[fAttractors.__controllers.length - 1];

  // Update visibility to show attractors when enabled
  const updateAttractorVisibility = () => {
    const show = CONFIG.attractorEnabled;
    show(controllers.showAttractorField, show);
    show(controllers.attractorStrength, show);
    show(controllers.attractorRadius, show);
    show(controllers.attractorDecay, show);
  };

  // Also update visibility when motion changes
  const originalUpdateVisibility = updateControllerVisibility;
  updateControllerVisibility = () => {
    originalUpdateVisibility();
    updateAttractorVisibility();
  };

  // === EXCLUSION ZONES FOLDER ===
  const fExclusion = gui.addFolder("Exclusion Zones");

  // Enable/disable exclusion zones
  fExclusion
    .add(CONFIG, "attractorExclusionEnabled")
    .name("Enable Exclusions")
    .onChange(saveState);

  fExclusion
    .add(CONFIG, "showExclusionOutlines")
    .name("Show Outlines")
    .onChange(saveState);

  // Display exclusion zone count
  const exclusionCountObj = { count: state.exclusionZones.length };

  fExclusion
    .add(exclusionCountObj, "count")
    .name("Zone Count")
    .listen();

  // Default size controls
  fExclusion
    .add(CONFIG, "newCircleRadius", 20, 300, 10)
    .name("New Circle Radius")
    .onChange(saveState);

  fExclusion
    .add(CONFIG, "newRectWidth", 30, 500, 10)
    .name("New Rect Width")
    .onChange(saveState);

  fExclusion
    .add(CONFIG, "newRectHeight", 30, 500, 10)
    .name("New Rect Height")
    .onChange(saveState);

  fExclusion
    .add(CONFIG, "newEllipseWidth", 30, 500, 10)
    .name("New Ellipse Width")
    .onChange(saveState);

  fExclusion
    .add(CONFIG, "newEllipseHeight", 30, 500, 10)
    .name("New Ellipse Height")
    .onChange(saveState);

  // Add circle exclusion zone
  CONFIG.addCircleExclusion = () => {
    state.exclusionZones.push({
      type: "circle",
      x: state.width / 2,
      y: state.height / 2,
      radius: CONFIG.newCircleRadius,
    });
    exclusionCountObj.count = state.exclusionZones.length;
    saveState();
  };

  // Add rectangle exclusion zone
  CONFIG.addRectExclusion = () => {
    state.exclusionZones.push({
      type: "rectangle",
      x: state.width / 2 - CONFIG.newRectWidth / 2,
      y: state.height / 2 - CONFIG.newRectHeight / 2,
      width: CONFIG.newRectWidth,
      height: CONFIG.newRectHeight,
    });
    exclusionCountObj.count = state.exclusionZones.length;
    saveState();
  };

  // Add ellipse exclusion zone
  CONFIG.addEllipseExclusion = () => {
    state.exclusionZones.push({
      type: "ellipse",
      x: state.width / 2 - CONFIG.newEllipseWidth / 2,
      y: state.height / 2 - CONFIG.newEllipseHeight / 2,
      width: CONFIG.newEllipseWidth,
      height: CONFIG.newEllipseHeight,
    });
    exclusionCountObj.count = state.exclusionZones.length;
    saveState();
  };

  // Clear all exclusion zones
  CONFIG.clearExclusionZones = () => {
    state.exclusionZones = [];
    exclusionCountObj.count = 0;
    saveState();
  };

  fExclusion.add(CONFIG, "addCircleExclusion").name("Add Circle");
  fExclusion.add(CONFIG, "addRectExclusion").name("Add Rectangle");
  fExclusion.add(CONFIG, "addEllipseExclusion").name("Add Ellipse");
  fExclusion.add(CONFIG, "clearExclusionZones").name("Clear All Zones");

  // === DISPLAY FOLDER ===
  const fDisplay = gui.addFolder("Display");
  fDisplay.add(CONFIG, "showPoints").name("Points").onChange(saveState);
  fDisplay.add(CONFIG, "showEdges").name("Edges").onChange(saveState);
  fDisplay.add(CONFIG, "showCells").name("Cells").onChange(saveState);
  fDisplay.add(CONFIG, "showVectorField").name("Vector Field").onChange(saveState);
  fDisplay
    .add(CONFIG, "showCellIndices")
    .name("Cell Indices")
    .onChange(saveState);
  fDisplay.add(CONFIG, "smoothCells").name("Smooth").onChange(saveState);
  fDisplay
    .add(CONFIG, "smoothing", settings.smoothing.min, settings.smoothing.max, settings.smoothing.step)
    .name("Smooth Amount")
    .onChange(saveState);
  fDisplay
    .add(CONFIG, "cellGap", settings.cellGap.min, settings.cellGap.max, settings.cellGap.step)
    .name("Cell Gap")
    .onChange(saveState);
  fDisplay.open();

  // === IMAGE FOLDER ===
  const fImage = gui.addFolder("Image");
  fImage
    .add(CONFIG, "useImageColors")
    .name("Use Image Colors")
    .onChange((v: boolean) => {
      if (v && state.imageData && !state.imageCellColors) {
        computeImageCellColors(state);
      }
      saveState();
    });
  fImage
    .add(CONFIG, "imagePointDensity")
    .name("Points from Brightness")
    .onChange((v: boolean) => {
      if (v && state.imageData) {
        distributeParticlesByImage(state);
        computeImageCellColors(state);
        updateGUIDisplay();
      }
      saveState();
    });
  fImage
    .add(CONFIG, "imageBrightnessThreshold", 0, 255, 1)
    .name("Brightness Threshold")
    .onChange(() => {
      if (CONFIG.imagePointDensity && state.imageData) {
        distributeParticlesByImage(state);
        computeImageCellColors(state);
      }
      saveState();
    });

  // Wire up clearImage action
  CONFIG.clearImage = () => {
    clearImage(state);
  };

  fImage.add(CONFIG, "clearImage").name("Clear Image");

  // === STYLE FOLDER ===
  const fStyle = gui.addFolder("Style");
  fStyle
    .add(CONFIG, "palette", [...Object.keys(PALETTES), "Random"])
    .name("Palette")
    .onChange((v: string) => {
      if (v === "Random") {
        const names = Object.keys(PALETTES);
        CONFIG.palette = names[Math.floor(Math.random() * names.length)];
        updateGUIDisplay();
      }
      saveState();
    });
  fStyle
    .addColor(CONFIG, "backgroundColor")
    .name("Background")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "cellFillAlpha", settings.cellFillAlpha.min, settings.cellFillAlpha.max, settings.cellFillAlpha.step)
    .name("Cell Opacity")
    .onChange(saveState);
  fStyle
    .addColor(CONFIG, "edgeColor")
    .name("Edge Color")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "edgeWeight", settings.edgeWeight.min, settings.edgeWeight.max, settings.edgeWeight.step)
    .name("Edge Weight")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "pointSize", settings.pointSize.min, settings.pointSize.max, settings.pointSize.step)
    .name("Point Size")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "pointStyle", ["fill", "stroke", "both", "none"])
    .name("Point Style")
    .onChange(saveState);
  fStyle
    .addColor(CONFIG, "pointColor")
    .name("Point Color")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "pointStrokeWeight", 0.5, 5, 0.5)
    .name("Point Stroke")
    .onChange(saveState);
  fStyle
    .add(CONFIG, "blendMode", [
      "source-over",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
    ])
    .name("Blend Mode")
    .onChange(saveState);

  // === GRADIENT FOLDER ===
  const fGradient = fStyle.addFolder("Gradients");
  fGradient
    .add(CONFIG, "useGradientFill")
    .name("Use Gradient")
    .onChange(saveState);
  fGradient
    .add(CONFIG, "gradientType", ["linear", "radial", "conical"])
    .name("Gradient Type")
    .onChange(saveState);
  fGradient
    .add(CONFIG, "gradientAngle", settings.gradientAngle.min, settings.gradientAngle.max, settings.gradientAngle.step)
    .name("Angle")
    .onChange(saveState);
  fGradient
    .add(CONFIG, "gradientStops", 2, 6, 1)
    .name("Color Stops")
    .onChange(saveState);

  // === FABRICATION FOLDER ===
  const fFab = gui.addFolder("Fabrication");
  fFab
    .add(CONFIG, "fabricationMode", ["none", "laser-cut", "laser-engrave", "cnc", "3d-print"])
    .name("Mode")
    .onChange((v: string) => {
      // Auto-adjust settings for fabrication modes
      switch (v) {
        case "laser-cut":
          CONFIG.showEdges = true;
          CONFIG.showCells = false;
          CONFIG.showPoints = false;
          CONFIG.cellGap = 0.5;
          CONFIG.edgeWeight = 0.5;
          break;
        case "laser-engrave":
          CONFIG.showEdges = true;
          CONFIG.showCells = true;
          CONFIG.cellFillAlpha = 0.3;
          break;
        case "cnc":
          CONFIG.showEdges = true;
          CONFIG.edgeWeight = 3;
          CONFIG.cellGap = 1;
          break;
      }
      updateGUIDisplay();
      saveState();
    });
  fFab.add(CONFIG, "kerf", -0.5, 0.5, 0.01).name("Kerf Offset").onChange(saveState);
  fFab
    .add(CONFIG, "safeZone", 0, 50, 5)
    .name("Safe Zone (px)")
    .onChange(saveState);
  fFab
    .add(CONFIG, "layerHeight", 0.1, 1, 0.1)
    .name("Layer Height")
    .onChange(saveState);
  fFab
    .add(CONFIG, "baseThickness", 0.5, 10, 0.5)
    .name("Base Thickness")
    .onChange(saveState);

  // === VECTOR FIELD VIS FOLDER ===
  const fVectorVis = gui.addFolder("Vector Field Vis");
  fVectorVis
    .add(CONFIG, "vectorGridSize", 10, 50, 5)
    .name("Grid Size")
    .onChange(saveState);
  fVectorVis
    .add(CONFIG, "vectorLineLength", 5, 40, 5)
    .name("Line Length")
    .onChange(saveState);

  // === EXPORT FOLDER ===
  const fExport = gui.addFolder("Export");
  fExport
    .add(CONFIG, "exportScale", settings.exportScale.min, settings.exportScale.max, settings.exportScale.step)
    .name("Scale")
    .onChange(saveState);
  fExport
    .add(CONFIG, "svgIncludeCutLines")
    .name("Cut Lines")
    .onChange(saveState);
  fExport
    .add(CONFIG, "svgIncludeEngraveLines")
    .name("Engrave Lines")
    .onChange(saveState);
  fExport
    .add(CONFIG, "svgIncludeFill")
    .name("Include Fill")
    .onChange(saveState);
  fExport
    .add(CONFIG, "svgOptimizePaths")
    .name("Optimize Paths")
    .onChange(saveState);

  // === ACTIONS FOLDER ===
  const fActions = gui.addFolder("Actions");

  // Point actions
  CONFIG.addPoint = () => {
    const p = new Particle(q5.mouseX, q5.mouseY);
    state.particles.push(p);
    CONFIG.count = state.particles.length;
    updateGUIDisplay();
    saveState();
  };
  CONFIG.removePoint = () => {
    if (state.particles.length === 0) return;
    let minD = Infinity;
    let idx = 0;
    for (let i = 0; i < state.particles.length; i++) {
      const dx = state.particles[i].x - q5.mouseX;
      const dy = state.particles[i].y - q5.mouseY;
      const d = dx * dx + dy * dy;
      if (d < minD) {
        minD = d;
        idx = i;
      }
    }
    state.particles.splice(idx, 1);
    CONFIG.count = state.particles.length;
    updateGUIDisplay();
    saveState();
  };
  CONFIG.randomize = () => {
    state.particles = createParticles(
      CONFIG.count,
      state.width,
      state.height,
    );
    for (const p of state.particles) {
      p.anchorX = p.x;
      p.anchorY = p.y;
    }
    saveState();
  };
  CONFIG.togglePause = () => {
    state.paused = !state.paused;
  };

  // Export actions
  CONFIG.exportSVG = () => exportSVG(state);
  CONFIG.exportPNG = () => exportPNG(q5);
  CONFIG.exportForLaser = () => exportForLaser(state);
  CONFIG.exportForCNC = () => exportForCNC(state);
  CONFIG.exportFor3DPrint = () => exportFor3DPrint(state);

  // Lloyd relaxation
  CONFIG.relaxLloyd = () => {
    for (let i = 0; i < CONFIG.relaxLloydSteps; i++) {
      relaxLloyd(state, 0.5);
    }
    saveState();
  };

  // Palette actions
  CONFIG.shufflePalette = () => {
    const current = CONFIG.palette;
    const newColors = shufflePalette(current);
    PALETTES[current] = newColors;
  };
  CONFIG.randomPalette = () => {
    const names = Object.keys(PALETTES);
    const randomName = names[Math.floor(Math.random() * names.length)];
    CONFIG.palette = randomName;
    updateGUIDisplay();
    saveState();
  };
  CONFIG.invertColors = () => {
    // Invert background
    const bg = CONFIG.backgroundColor;
    const r = (255 - parseInt(bg.slice(1, 3), 16)).toString(16).padStart(2, "0");
    const g = (255 - parseInt(bg.slice(3, 5), 16)).toString(16).padStart(2, "0");
    const b = (255 - parseInt(bg.slice(5, 7), 16)).toString(16).padStart(2, "0");
    CONFIG.backgroundColor = `#${r}${g}${b}`;

    // Invert edge color
    const ec = CONFIG.edgeColor;
    const re = (255 - parseInt(ec.slice(1, 3), 16)).toString(16).padStart(2, "0");
    const ge = (255 - parseInt(ec.slice(3, 5), 16)).toString(16).padStart(2, "0");
    const be = (255 - parseInt(ec.slice(5, 7), 16)).toString(16).padStart(2, "0");
    CONFIG.edgeColor = `#${re}${ge}${be}`;

    // Invert cell fill alpha
    CONFIG.cellFillAlpha = 1 - CONFIG.cellFillAlpha;
    updateGUIDisplay();
    saveState();
  };
  CONFIG.resetToDefault = () => {
    Object.assign(CONFIG, DEFAULT_CONFIG);
    syncParticleCount(
      state.particles,
      CONFIG.count,
      state.width,
      state.height,
    );
    updateGUIDisplay();
    saveState();
  };

  // Add action controllers
  fActions.add(CONFIG, "addPoint").name("Add Point (Shift+Click)");
  fActions.add(CONFIG, "removePoint").name("Remove Point (Alt+Click)");
  fActions.add(CONFIG, "randomize").name("Randomize (R)");
  fActions.add(CONFIG, "togglePause").name("Pause/Resume (Space)");
  fActions.add(CONFIG, "relaxLloyd").name("Lloyd Relaxation");
  fActions
    .add(CONFIG, "relaxLloydSteps", 1, 10, 1)
    .name("Relax Steps")
    .onChange(saveState);

  fActions.add(CONFIG, "shufflePalette").name("Shuffle Colors");
  fActions.add(CONFIG, "randomPalette").name("Random Palette");
  fActions.add(CONFIG, "invertColors").name("Invert Colors");
  fActions.add(CONFIG, "resetToDefault").name("Reset to Default");

  // Export buttons
  fActions.add(CONFIG, "exportSVG").name("Export SVG (E)");
  fActions.add(CONFIG, "exportPNG").name("Export PNG");
  fActions.add(CONFIG, "exportForLaser").name("Export for Laser Cutter");
  fActions.add(CONFIG, "exportForCNC").name("Export for CNC");
  fActions.add(CONFIG, "exportFor3DPrint").name("Export 3D Print (STL)");

  // === PRESETS FOLDER ===
  const fPresets = gui.addFolder("Presets");

  CONFIG.savePreset = () => {
    if (!presetName) {
      presetName = `Preset ${Date.now()}`;
    }
    savePreset(state, presetName);
    refreshPresetList();
    // Show brief notification
    const notification = document.createElement("div");
    notification.className = "dat-gui-notification";
    notification.textContent = `Saved: ${presetName}`;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 1000;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
  };

  CONFIG.loadPreset = () => {
    if (!selectedPreset) return;
    const presets = loadPresets();
    const preset = presets.find((p) => p.name === selectedPreset);
    if (preset) {
      applyPreset(preset, state, (count) => {
        syncParticleCount(state.particles, count, state.width, state.height);
      });
      updateGUIDisplay();
    }
  };

  const refreshPresetList = () => {
    const presets = loadPresets();
    const presetController = fPresets.__controllers.find(
      (c: any) => c.property === "selectedPreset", // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    if (presetController) {
      presetController.options(presets.map((p) => p.name));
      if (presets.length > 0 && !selectedPreset) {
        selectedPreset = presets[0].name;
        presetController.updateDisplay();
      }
    }
  };

  fPresets
    .add({ presetName }, "presetName")
    .name("Preset Name")
    .onChange((v: string) => {
      presetName = v;
    });
  fPresets
    .add({ selectedPreset }, "selectedPreset", [])
    .name("Load Preset")
    .onChange((v: string) => {
      selectedPreset = v;
    });
  fPresets.add(CONFIG, "savePreset").name("Save Preset");
  fPresets.add(CONFIG, "loadPreset").name("Load Selected");

  setTimeout(refreshPresetList, 100);

  // Open folders by default
  fParticles.open();
  fDisplay.open();

  // === SETTINGS FOLDER (Range Min/Max/Step) ===
  const fSettings = gui.addFolder("Range Settings");

  // Helper to create a subfolder for a setting
  const createRangeFolder = (name: string, key: keyof SettingsData) => {
    const folder = fSettings.addFolder(name);
    folder
      .add(settings[key], "min")
      .name("Min")
      .onChange(() => {
        saveSettings(settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      });
    folder
      .add(settings[key], "max")
      .name("Max")
      .onChange(() => {
        saveSettings(settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      });
    folder
      .add(settings[key], "step")
      .name("Step")
      .onChange(() => {
        saveSettings(settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      });
    return folder;
  };

  // Create range folders for each setting
  createRangeFolder("Particle Count", "count");
  createRangeFolder("Speed", "speed");
  createRangeFolder("Vector Field Scale", "vectorFieldScale");
  createRangeFolder("Cell Fill Alpha", "cellFillAlpha");
  createRangeFolder("Edge Weight", "edgeWeight");
  createRangeFolder("Point Size", "pointSize");
  createRangeFolder("Smoothing", "smoothing");
  createRangeFolder("Cell Gap", "cellGap");
  createRangeFolder("Gradient Angle", "gradientAngle");
  createRangeFolder("Export Scale", "exportScale");

  // Add a button to reset to defaults
  CONFIG.resetRangeSettings = () => {
    Object.assign(settings, DEFAULT_SETTINGS);
    saveSettings(settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    alert("Range settings reset to defaults. Reload the page to apply.");
  };

  fSettings.add(CONFIG, "resetRangeSettings").name("Reset to Defaults");

  return gui;
}
