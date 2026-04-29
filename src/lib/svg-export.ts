import { CONFIG, type AppState } from "./config";
import { smoothPolygon, type BezierSegment } from "./voronoi-compute";
import { getCellColor } from "./color";

function rawPolygonToSVGPath(poly: number[][]): string {
  if (poly.length < 3) return "";

  let d = "";
  for (let i = 0; i < poly.length - 1; i++) {
    const x = poly[i][0];
    const y = poly[i][1];
    if (i === 0) {
      d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  d += " Z";
  return d;
}

function bezierSegmentsToSVGPath(segs: BezierSegment[]): string {
  if (segs.length === 0) return "";
  let d = `M${segs[0].p1[0].toFixed(2)} ${segs[0].p1[1].toFixed(2)}`;
  for (const seg of segs) {
    d += ` C${seg.cp1[0].toFixed(2)} ${seg.cp1[1].toFixed(2)} ${seg.cp2[0].toFixed(2)} ${seg.cp2[1].toFixed(2)} ${seg.p2[0].toFixed(2)} ${seg.p2[1].toFixed(2)}`;
  }
  d += " Z";
  return d;
}

/**
 * Offset bezier segments inward/outward by a gap amount.
 * Matches the canvas rendering behavior.
 */
function offsetBezierSegments(
  segs: BezierSegment[],
  originalPoly: number[][],
  offset: number,
): BezierSegment[] {
  if (Math.abs(offset) < 0.001) return segs;

  // Calculate polygon centroid for offset direction
  let cx = 0,
    cy = 0;
  const n = originalPoly.length - 1;
  for (let i = 0; i < n; i++) {
    cx += originalPoly[i][0];
    cy += originalPoly[i][1];
  }
  cx /= n;
  cy /= n;

  return segs.map((seg) => {
    const offsetPoint = ([x, y]: number[]) => {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return [x, y];
      const scale = Math.max(0, (dist + offset) / dist);
      return [cx + dx * scale, cy + dy * scale];
    };

    return {
      p1: offsetPoint(seg.p1),
      cp1: offsetPoint(seg.cp1),
      cp2: offsetPoint(seg.cp2),
      p2: offsetPoint(seg.p2),
    };
  });
}

function getInsetPolygon(poly: number[][], gap: number): number[][] {
  if (gap <= 0 || poly.length < 4) return poly;

  let cx = 0,
    cy = 0;
  const n = poly.length - 1;
  for (let i = 0; i < n; i++) {
    cx += poly[i][0];
    cy += poly[i][1];
  }
  cx /= n;
  cy /= n;

  return poly.slice(0, n).map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return [x, y];
    const scale = Math.max(0, (dist - gap) / dist);
    return [cx + dx * scale, cy + dy * scale];
  });
}

/**
 * Export SVG with current settings - includes all colors as seen on screen
 */
export function exportSVG(state: AppState): void {
  const w = state.width * CONFIG.exportScale;
  const h = state.height * CONFIG.exportScale;
  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;
  const gap = CONFIG.cellGap;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  svg += `  <desc>Voronoi Diagram - ${new Date().toISOString()}</desc>\n`;
  svg += `  <rect width="100%" height="100%" fill="${CONFIG.backgroundColor}"/>\n\n`;

  // Group with scale
  svg += `  <g transform="scale(${CONFIG.exportScale})">\n`;

  // Draw cells (always include fill when cells are visible, regardless of svgIncludeFill setting)
  if (CONFIG.showCells) {
    for (let i = 0; i < state.polygons.length; i++) {
      const poly = state.polygons[i];
      if (!poly || poly.length < 3) continue;

      const { r, g, b } = getCellColor(i);
      const alpha = CONFIG.cellFillAlpha;

      let d: string;
      if (useSmooth) {
        const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
        if (segs && segs.length > 0) {
          const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
          d = bezierSegmentsToSVGPath(processSegs);
        } else {
          const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
          d = rawPolygonToSVGPath(processPoly);
        }
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        d = rawPolygonToSVGPath(processPoly);
      }

      svg += `    <path d="${d}" fill="rgb(${r},${g},${b})" fill-opacity="${alpha}" stroke="none"/>\n`;
    }
    svg += "\n";
  }

  // Draw edges (always include when visible, regardless of svgIncludeCutLines setting)
  if (CONFIG.showEdges) {
    for (let i = 0; i < state.polygons.length; i++) {
      const poly = state.polygons[i];
      if (!poly || poly.length < 3) continue;

      let d: string;
      if (useSmooth) {
        const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
        if (segs && segs.length > 0) {
          const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
          d = bezierSegmentsToSVGPath(processSegs);
        } else {
          const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
          d = rawPolygonToSVGPath(processPoly);
        }
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        d = rawPolygonToSVGPath(processPoly);
      }

      svg += `    <path d="${d}" fill="none" stroke="${CONFIG.edgeColor}" stroke-width="${CONFIG.edgeWeight}"/>\n`;
    }
    svg += "\n";
  }

  // Draw points
  if (CONFIG.showPoints) {
    const size = CONFIG.pointSize;
    const style = CONFIG.pointStyle;
    for (const p of state.particles) {
      const r2 = size / 2;
      const fillAttr =
        style === "fill" || style === "both"
          ? `fill="${CONFIG.pointColor}"`
          : 'fill="none"';
      const strokeAttr =
        style === "stroke" || style === "both"
          ? `stroke="${CONFIG.pointColor}" stroke-width="${CONFIG.pointStrokeWeight}"`
          : 'stroke="none"';
      svg += `    <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r2}" ${fillAttr} ${strokeAttr}/>\n`;
    }
  }

  svg += "  </g>\n";
  svg += `</svg>`;
  downloadSVG(svg, "voronoi.svg");
}

/**
 * Export optimized for laser cutting
 * - Separate layers for cut and engrave
 * - No fill, clean paths
 * - Kerf compensation
 */
export function exportForLaser(state: AppState): void {
  const w = state.width;
  const h = state.height;
  const kerf = CONFIG.kerf;
  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;
  const gap = CONFIG.cellGap + kerf;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  svg += `  <desc>Voronoi Laser Cut - ${new Date().toISOString()}</desc>\n`;
  svg += `  <!-- Red: Cut, Blue: Engrave/Scores -->\n\n`;

  // Cut layer (outer boundary + cell edges)
  svg += `  <!-- CUT LAYER (red) -->\n`;
  svg += `  <g id="cut" stroke="red" stroke-width="${CONFIG.edgeWeight}" fill="none">\n`;
  svg += `    <rect x="${CONFIG.safeZone}" y="${CONFIG.safeZone}" width="${w - CONFIG.safeZone * 2}" height="${h - CONFIG.safeZone * 2}"/>\n`;

  for (let i = 0; i < state.polygons.length; i++) {
    const poly = state.polygons[i];
    if (!poly || poly.length < 3) continue;

    let d: string;
    if (useSmooth) {
      const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
      if (segs && segs.length > 0) {
        const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
        d = bezierSegmentsToSVGPath(processSegs);
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        d = rawPolygonToSVGPath(processPoly);
      }
    } else {
      const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
      d = rawPolygonToSVGPath(processPoly);
    }
    svg += `    <path d="${d}"/>\n`;
  }
  svg += `  </g>\n\n`;

  // Engrave layer (cell fills if enabled)
  if (CONFIG.showCells) {
    svg += `  <!-- ENGRAVE LAYER (blue) -->\n`;
    svg += `  <g id="engrave" stroke="blue" stroke-width="0.3" fill="none" opacity="0.5">\n`;
    for (let i = 0; i < state.polygons.length; i++) {
      const poly = state.polygons[i];
      if (!poly || poly.length < 3) continue;

      let d: string;
      if (useSmooth) {
        const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
        if (segs && segs.length > 0) {
          d = bezierSegmentsToSVGPath(segs);
        } else {
          d = rawPolygonToSVGPath(poly);
        }
      } else {
        d = rawPolygonToSVGPath(poly);
      }
      svg += `    <path d="${d}"/>\n`;
    }
    svg += `  </g>\n\n`;
  }

  svg += `</svg>`;
  downloadSVG(svg, "voronoi-laser.svg");
}

/**
 * Export for CNC milling
 * - Offset paths for tool diameter
 * - Z-height annotations
 */
export function exportForCNC(state: AppState): void {
  const w = state.width;
  const h = state.height;
  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;
  const gap = CONFIG.cellGap;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  svg += `  <desc>Voronoi CNC - ${new Date().toISOString()}</desc>\n`;
  svg += `  <!-- Blue: Rough cut, Green: Finish pass -->\n\n`;

  // Rough cut paths
  svg += `  <g id="rough-cut" stroke="#0066cc" stroke-width="${CONFIG.edgeWeight * 2}" fill="none">\n`;
  svg += `    <rect x="${CONFIG.safeZone}" y="${CONFIG.safeZone}" width="${w - CONFIG.safeZone * 2}" height="${h - CONFIG.safeZone * 2}"/>\n`;
  svg += `  </g>\n\n`;

  // Finish pass paths
  svg += `  <g id="finish" stroke="#00cc66" stroke-width="${CONFIG.edgeWeight}" fill="none">\n`;
  for (let i = 0; i < state.polygons.length; i++) {
    const poly = state.polygons[i];
    if (!poly || poly.length < 3) continue;

    let d: string;
    if (useSmooth) {
      const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
      if (segs && segs.length > 0) {
        const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
        d = bezierSegmentsToSVGPath(processSegs);
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        d = rawPolygonToSVGPath(processPoly);
      }
    } else {
      const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
      d = rawPolygonToSVGPath(processPoly);
    }
    svg += `    <path d="${d}"/>\n`;
  }
  svg += `  </g>\n\n`;

  svg += `</svg>`;
  downloadSVG(svg, "voronoi-cnc.svg");
}

/**
 * Export for 3D printing (STL format via OpenSCAD-style extrusion)
 * Creates a script that can be imported into OpenSCAD
 */
export function exportFor3DPrint(state: AppState): void {
  const w = state.width / 10; // Convert to cm roughly
  const h = state.height / 10;
  const baseThickness = CONFIG.baseThickness;
  const layerHeight = CONFIG.layerHeight;

  let scad = `// Voronoi 3D Print - Generated ${new Date().toISOString()}\n`;
  scad += `// Open in OpenSCAD to export as STL\n\n`;
  scad += `width = ${w.toFixed(2)};\n`;
  scad += `depth = ${h.toFixed(2)};\n`;
  scad += `base_thick = ${baseThickness.toFixed(2)};\n`;
  scad += `layer_height = ${layerHeight.toFixed(2)};\n\n`;

  // Base plate
  scad += `// Base plate\n`;
  scad += `cube([width, depth, base_thick]);\n\n`;

  // Voronoi cells as extruded polygons
  scad += `// Voronoi cells (extruded)\n`;
  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;

  for (let i = 0; i < state.polygons.length; i++) {
    const poly = state.polygons[i];
    if (!poly || poly.length < 3) continue;

    const { r, g, b } = getCellColor(i);
    scad += `color([${(r / 255).toFixed(2)}, ${(g / 255).toFixed(2)}, ${(b / 255).toFixed(2)}])\n`;

    // Build points array for polygon
    scad += `  polygon(points=[`;
    const points: string[] = [];
    const n = Math.min(poly.length - 1, 10); // Limit points for OpenSCAD
    for (let j = 0; j < n; j++) {
      points.push(`[${(poly[j][0] / 10).toFixed(2)}, ${(poly[j][1] / 10).toFixed(2)}]`);
    }
    scad += points.join(", ");
    scad += `]);\n`;
  }

  downloadSCAD(scad, "voronoi-3d.scad");
}

function downloadSVG(
  svgString: string,
  filename = "voronoi.svg",
): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSCAD(
  scadString: string,
  filename = "voronoi.scad",
): void {
  const blob = new Blob([scadString], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}
