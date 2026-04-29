import { Delaunay } from "d3-delaunay";
import type { AppState } from "./config";

export interface BezierSegment {
  p1: number[];
  cp1: number[];
  cp2: number[];
  p2: number[];
}

export function computeVoronoi(state: AppState): void {
  if (state.particles.length === 0) {
    state.polygons = [];
    return;
  }
  const delaunay = Delaunay.from(state.particles, (p) => p.x, (p) => p.y);
  state.voronoi = delaunay.voronoi([0, 0, state.width, state.height]);
  state.polygons = state.particles
    .map((_, i) => {
      try {
        return state.voronoi!.cellPolygon(i);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as number[][][];
}

export function smoothPolygon(
  poly: number[][],
  tension: number,
): BezierSegment[] | null {
  const n = poly.length - 1; // exclude closing dupe
  if (n < 3) return null;

  const midpoints: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    midpoints.push([
      (poly[i][0] + poly[j][0]) / 2,
      (poly[i][1] + poly[j][1]) / 2,
    ]);
  }

  const segments: BezierSegment[] = [];
  const m = midpoints.length;
  for (let i = 0; i < m; i++) {
    const p0 = midpoints[(i - 1 + m) % m];
    const p1 = midpoints[i];
    const p2 = midpoints[(i + 1) % m];
    const p3 = midpoints[(i + 2) % m];

    const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;

    segments.push({
      p1: p1,
      cp1: [cp1x, cp1y],
      cp2: [cp2x, cp2y],
      p2: p2,
    });
  }
  return segments;
}
