import { CONFIG, type AppState } from "./config";
import { PALETTES } from "./palettes";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface CellColor extends RGB {
  hex: string;
}

export function hexToRGB(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Get color for a cell, accounting for image mode
 */
export function getCellColor(index: number, state?: AppState): CellColor {
  // If using image colors and image data is available
  if (CONFIG.useImageColors && state?.imageCellColors) {
    const colorStr = state.imageCellColors[index] || "#ffffff";
    if (colorStr.startsWith("rgb(")) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          hex: rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3])),
        };
      }
    }
    const { r, g, b } = hexToRGB(colorStr);
    return { r, g, b, hex: colorStr };
  }

  // Default palette-based coloring
  const palette = PALETTES[CONFIG.palette] || PALETTES.Sunset;
  const hex = palette[index % palette.length];
  const { r, g, b } = hexToRGB(hex);
  return { r, g, b, hex };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
