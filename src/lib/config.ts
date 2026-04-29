import type { Particle } from "./particle";

// Comprehensive configuration for Voronoi Viewer
export const CONFIG = {
  // === PARTICLES ===
  count: 80,
  motion: "vectorfield" as MotionType,
  speed: 1.0,
  vectorFieldScale: 0.003,
  vectorFieldTimeScale: 0.5,
  curlNoiseAmount: 0.0,
  brownianAmount: 0.1,
  orbitSpeed: 0.5,
  orbitRadius: 40,
  edgeBehavior: "wrap" as EdgeBehaviorType,

  // === BOID PARAMETERS ===
  boidSeparation: 1.5,    // Weight for separation rule
  boidAlignment: 1.0,     // Weight for alignment rule
  boidCohesion: 1.0,      // Weight for cohesion rule
  boidPerception: 50,     // Perception radius in pixels
  boidMaxSpeed: 3,        // Maximum speed
  boidMaxForce: 0.1,      // Maximum steering force

  // === ATTRACTOR/REPELLER ===
  attractorEnabled: false,     // Enable attractor/repeller system
  attractorStrength: 50,       // Strength of attraction/repulsion
  attractorRadius: 150,        // Radius of influence
  attractorDecay: 0.98,        // Decay factor for influence over distance
  attractorMode: "click" as AttractorModeType,  // Click or shape-based
  attractorShape: "circle" as AttractorShapeType,  // Shape for regions
  showAttractorField: true,    // Show attractor field visualization
  attractorExclusionEnabled: false,  // Enable exclusion shapes
  showExclusionOutlines: true,  // Show exclusion zone outlines
  // Default exclusion zone sizes
  newCircleRadius: 80,
  newRectWidth: 150,
  newRectHeight: 100,
  newEllipseWidth: 160,
  newEllipseHeight: 100,

  // === IMAGE MODE ===
  useImageColors: false,
  imagePointDensity: false,
  imageBrightnessThreshold: 128,
  imageMinPointSize: 1,
  imageMaxPointSize: 10,

  // === DISPLAY ===
  showPoints: false,
  showEdges: true,
  showCells: true,
  showVectorField: false,
  showCellIndices: false,
  smoothCells: false,
  smoothing: 0.5,
  cellGap: 0,

  // === STYLING ===
  palette: "Sunset",
  backgroundColor: "#111111",
  cellFillAlpha: 0.85,
  edgeColor: "#ffffff",
  edgeWeight: 1.5,
  pointSize: 4,
  pointStyle: "fill" as PointStyleType,
  pointColor: "#ffffff",
  pointStrokeWeight: 1,
  blendMode: "source-over" as BlendMode,

  // === GRADIENTS ===
  useGradientFill: false,
  gradientType: "radial" as GradientType,
  gradientAngle: 0,
  gradientStops: 2,

  // === FABRICATION ===
  fabricationMode: "none" as FabricationMode,
  kerf: 0.0,
  safeZone: 10,
  layerHeight: 0.2,
  baseThickness: 2,

  // === VECTOR FIELD VISUALIZATION ===
  vectorGridSize: 20,
  vectorLineLength: 15,

  // === EXPORT ===
  exportScale: 1,
  svgIncludeCutLines: true,
  svgIncludeEngraveLines: true,
  svgIncludeFill: false,
  svgOptimizePaths: true,

  // === ANIMATION ===
  autoAnimate: true,
  animationSpeed: 1.0,

  // === ACTIONS (wired later) ===
  addPoint: () => {},
  removePoint: () => {},
  randomize: () => {},
  togglePause: () => {},
  exportSVG: () => {},
  exportPNG: () => {},
  exportForLaser: () => {},
  exportForCNC: () => {},
  exportFor3DPrint: () => {},
  relaxLloyd: () => {},
  relaxLloydSteps: 1,
  shufflePalette: () => {},
  randomPalette: () => {},
  invertColors: () => {},
  resetToDefault: () => {},
  clearImage: () => {},
  savePreset: () => {},
  loadPreset: () => {},
  addCircleExclusion: () => {},
  addRectExclusion: () => {},
  addEllipseExclusion: () => {},
  clearExclusionZones: () => {},
  resetRangeSettings: () => {},
};

export type MotionType =
  | "vectorfield"
  | "perlin"
  | "curl"
  | "brownian"
  | "orbit"
  | "wave"
  | "boid"
  | "none";
export type EdgeBehaviorType = "wrap" | "bounce" | "clamp";
export type PointStyleType = "fill" | "stroke" | "both" | "none";
export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";
export type GradientType = "linear" | "radial" | "conical";
export type FabricationMode = "none" | "laser-cut" | "laser-engrave" | "cnc" | "3d-print";
export type AttractorModeType = "click" | "shape";
export type AttractorShapeType = "circle" | "rectangle" | "ellipse";

// Runtime state
export interface AppState {
  particles: Particle[];
  voronoi: import("d3-delaunay").Voronoi | null;
  polygons: number[][][];
  paused: boolean;
  draggingIndex: number;
  width: number;
  height: number;
  time: number;
  gui: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  q5: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  vectorField: Vector2[] | null;
  // Image mode state
  imageData: ImageData | null;
  imageCanvas: HTMLCanvasElement | null;
  imageCellColors: string[] | null; // Pre-computed colors for each cell
  previousSpeed: number; // Store speed before image load
  // HUD state
  hudVisible: boolean;
  // Attractor/Repeller state
  mouseIsDown: boolean;
  mouseShiftIsDown: boolean;
  mouseX: number;
  mouseY: number;
  exclusionZones: ExclusionZone[];
  draggingZoneIndex: number;
  draggingZoneHandle: "center" | "corner" | null;
  draggingZoneCornerIndex: number;
}

export interface ExclusionZone {
  type: AttractorShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number; // For circle
}

export interface Vector2 {
  x: number;
  y: number;
}

// Default values for reset
export const DEFAULT_CONFIG = { ...CONFIG };
