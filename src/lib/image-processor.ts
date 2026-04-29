import type { AppState } from "./config";
import { CONFIG } from "./config";
import { createParticles, Particle } from "./particle";

/**
 * Load an image from a file and extract its data for Voronoi coloring
 */
export async function loadImageFromFile(
  file: File,
  state: AppState,
): Promise<void> {
  // Validate file type
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/heic", "image/heif"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid image type. Please use PNG, JPG, or HEIC.");
  }

  // Create an image element
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  // Create canvas to extract image data
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Scale image to fit while maintaining aspect ratio
  const maxWidth = state.width || 800;
  const maxHeight = state.height || 600;
  let width = img.width;
  let height = img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width *= ratio;
    height *= ratio;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Store image data
  state.imageData = ctx.getImageData(0, 0, width, height);
  state.imageCanvas = canvas;

  // Enable image modes
  CONFIG.useImageColors = true;
  CONFIG.imagePointDensity = false;

  // Show cells so users can see the colored image
  CONFIG.showCells = true;
  CONFIG.showEdges = false;
  CONFIG.showPoints = false;

  // Stop animation by storing previous speed and setting to 0
  state.previousSpeed = CONFIG.speed;
  CONFIG.speed = 0;
  state.paused = true;

  // Clear any previous image cell colors - they will be recomputed in the draw loop
  state.imageCellColors = null;

  URL.revokeObjectURL(url);
}

/**
 * Compute cell colors based on the loaded image
 * Each cell's color is determined by sampling the image at the cell's centroid
 */
export function computeImageCellColors(state: AppState): void {
  if (!state.imageData || !state.imageCanvas) return;

  const { width: imgWidth, height: imgHeight, data } = state.imageData;
  const canvasWidth = state.width;
  const canvasHeight = state.height;

  // Check if polygons are available
  if (!state.polygons || state.polygons.length === 0) {
    console.warn("No polygons available for image color computation");
    return;
  }

  // Scale factors to map canvas coordinates to image coordinates
  const scaleX = imgWidth / canvasWidth;
  const scaleY = imgHeight / canvasHeight;

  const colors: string[] = [];

  for (let i = 0; i < state.polygons.length; i++) {
    const poly = state.polygons[i];
    if (!poly || poly.length < 3) {
      colors.push("#ffffff");
      continue;
    }

    // Calculate polygon centroid
    let cx = 0,
      cy = 0;
    const n = poly.length - 1;
    for (let j = 0; j < n; j++) {
      cx += poly[j][0];
      cy += poly[j][1];
    }
    cx /= n;
    cy /= n;

    // Map to image coordinates
    const imgX = Math.floor(cx * scaleX);
    const imgY = Math.floor(cy * scaleY);

    // Clamp to image bounds
    const x = Math.max(0, Math.min(imgWidth - 1, imgX));
    const y = Math.max(0, Math.min(imgHeight - 1, imgY));

    // Get color from image data
    const idx = (y * imgWidth + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // Skip transparent pixels
    if (a < 128) {
      colors.push("#ffffff");
    } else {
      colors.push(`rgb(${r},${g},${b})`);
    }
  }

  state.imageCellColors = colors;
}

/**
 * Generate particle positions based on image brightness
 * Brighter areas get more particles
 */
export function distributeParticlesByImage(state: AppState): void {
  if (!state.imageData || !state.imageCanvas) return;

  const { width: imgWidth, height: imgHeight, data } = state.imageData;
  const canvasWidth = state.width;
  const canvasHeight = state.height;

  const scaleX = imgWidth / canvasWidth;
  const scaleY = imgHeight / canvasHeight;

  // Clear existing particles and redistribute
  state.particles = [];
  const targetCount = CONFIG.count;

  // Create a grid-based sampling of the image
  const gridSize = Math.floor(Math.sqrt((imgWidth * imgHeight) / targetCount));
  const candidates: { x: number; y: number; brightness: number }[] = [];

  for (let y = 0; y < imgHeight; y += gridSize) {
    for (let x = 0; x < imgWidth; x += gridSize) {
      const idx = (y * imgWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 128) continue; // Skip transparent areas

      const brightness = (r + g + b) / 3;

      // Only add if above threshold
      if (brightness > CONFIG.imageBrightnessThreshold) {
        candidates.push({
          x: x / scaleX,
          y: y / scaleY,
          brightness,
        });
      }
    }
  }

  // Sort by brightness and pick the brightest areas
  candidates.sort((a, b) => b.brightness - a.brightness);

  // Take top candidates, but add some randomness
  const count = Math.min(targetCount, candidates.length);
  for (let i = 0; i < count; i++) {
    // Add some jitter for more organic distribution
    const idx = i + Math.floor(Math.random() * Math.max(1, candidates.length / count / 2));
    const candidate = candidates[Math.min(idx, candidates.length - 1)];

    const jitter = gridSize * 0.5;
    const x = candidate.x + (Math.random() - 0.5) * jitter;
    const y = candidate.y + (Math.random() - 0.5) * jitter;

    state.particles.push(new Particle(x, y));
  }

  CONFIG.count = state.particles.length;
}

/**
 * Clear the loaded image and return to normal mode
 */
export function clearImage(state: AppState): void {
  state.imageData = null;
  state.imageCanvas = null;
  state.imageCellColors = null;
  CONFIG.useImageColors = false;
  CONFIG.imagePointDensity = false;

  // Restore previous speed
  CONFIG.speed = state.previousSpeed;
  state.paused = false;
}

/**
 * Check if an image is currently loaded
 */
export function hasImage(state: AppState): boolean {
  return state.imageData !== null;
}
