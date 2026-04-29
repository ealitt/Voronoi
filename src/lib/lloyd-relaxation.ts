import type { AppState } from "./config";
import { Particle } from "./particle";

/**
 * Lloyd relaxation: move each particle toward the centroid of its Voronoi cell.
 * Repeating this process causes particles to distribute more evenly.
 * @param state - The app state containing particles and polygons
 * @param amount - How far to move toward centroid (0-1), default 0.5
 */
export function relaxLloyd(state: AppState, amount = 0.5): void {
  if (state.particles.length === 0) return;

  for (let i = 0; i < state.particles.length; i++) {
    const poly = state.polygons[i];
    const particle = state.particles[i];

    if (!poly || poly.length < 3) continue;

    // Compute centroid of the cell polygon
    let cx = 0;
    let cy = 0;
    let area = 0;

    for (let j = 0; j < poly.length - 1; j++) {
      const x0 = poly[j][0];
      const y0 = poly[j][1];
      const x1 = poly[j + 1][0];
      const y1 = poly[j + 1][1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }

    if (Math.abs(area) < 0.001) continue;

    area /= 2;
    cx /= 6 * area;
    cy /= 6 * area;

    // Move particle toward centroid by the specified amount
    particle.x += (cx - particle.x) * amount;
    particle.y += (cy - particle.y) * amount;

    // Update anchor for orbit mode
    particle.anchorX = particle.x;
    particle.anchorY = particle.y;

    // Reset velocity
    particle.vx = 0;
    particle.vy = 0;
  }
}
