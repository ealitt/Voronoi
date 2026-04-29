import type { AppState } from "./config";

/**
 * Export the current canvas state as a PNG image.
 * @param q5 - The Q5 instance with canvas
 */
export function exportPNG(q5: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const canvas = q5.canvas;
  if (!canvas) return;

  // Use canvas.toBlob to get PNG data
  canvas.toBlob((blob: Blob | null) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `voronoi-${Date.now()}.png`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/**
 * Export the current canvas state at a higher resolution.
 * @param q5 - The Q5 instance
 * @param scale - Resolution multiplier (e.g., 2 for 2x)
 */
export function exportPNGHighRes(q5: any, scale = 2): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const canvas = q5.canvas;
  if (!canvas) return;

  // Create a temporary high-res canvas
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width * scale;
  tempCanvas.height = canvas.height * scale;
  const ctx = tempCanvas.getContext("2d");
  if (!ctx) return;

  // Draw the original canvas scaled up
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

  // Export as PNG
  tempCanvas.toBlob((blob: Blob | null) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `voronoi-${scale}x-${Date.now()}.png`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
