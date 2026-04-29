import { CONFIG, type AppState } from "./config";
import { smoothPolygon, type BezierSegment } from "./voronoi-compute";
import { hexToRGB, getCellColor } from "./color";
import { PALETTES } from "./palettes";
import { clipPolygonAgainstExclusions } from "./polygon-clip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawCells(q5: any, state: AppState): void {
  const alpha = CONFIG.cellFillAlpha;
  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;
  const useGradient = CONFIG.useGradientFill;
  const gap = CONFIG.cellGap;
  const useExclusions = CONFIG.attractorExclusionEnabled && state.exclusionZones.length > 0;

  // Apply blend mode
  q5.push();
  q5.blendMode(q5[CONFIG.blendMode] || q5.BLEND);

  for (let i = 0; i < state.polygons.length; i++) {
    let polys = [state.polygons[i]];

    // Apply exclusion zone clipping if enabled
    if (useExclusions) {
      const poly = state.polygons[i];
      if (!poly || poly.length < 3) continue;
      polys = clipPolygonAgainstExclusions(poly, state.exclusionZones);
      if (polys.length === 0) continue; // Cell fully excluded
    }

    for (const poly of polys) {
      if (!poly || poly.length < 3) continue;

      // Get base color
      const { r, g, b } = getCellColor(i, state);

      // Apply gradient if enabled
      if (useGradient) {
        applyGradientFill(q5, i, poly, r, g, b, alpha);
      } else {
        q5.fill(r, g, b, alpha * 255);
      }
      q5.noStroke();

      if (useSmooth) {
        // Smooth first, then apply gap if needed
        const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
        if (segs && segs.length > 0) {
          const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
          drawSmoothSegments(q5, processSegs);
        } else {
          const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
          drawRawPolygon(q5, processPoly);
        }
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        drawRawPolygon(q5, processPoly);
      }
    }
  }

  q5.pop();
}

/**
 * Draw bezier segments from smooth polygon
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawSmoothSegments(q5: any, segs: BezierSegment[]): void {
  if (segs.length === 0) return;
  q5.beginShape();
  q5.vertex(segs[0].p1[0], segs[0].p1[1]);
  for (const seg of segs) {
    q5.bezierVertex(
      seg.cp1[0],
      seg.cp1[1],
      seg.cp2[0],
      seg.cp2[1],
      seg.p2[0],
      seg.p2[1],
    );
  }
  q5.endShape(q5.CLOSE);
}

/**
 * Offset bezier segments inward/outward by a gap amount.
 * This preserves smooth curves while adding spacing between cells.
 */
function offsetBezierSegments(
  segs: BezierSegment[],
  originalPoly: number[][],
  offset: number,
): BezierSegment[] {
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

function applyGradientFill(
  q5: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  index: number,
  poly: number[][],
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  // Calculate polygon bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of poly) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Get colors for gradient
  const palette = PALETTES[CONFIG.palette] || PALETTES.Sunset;
  const numStops = CONFIG.gradientStops;
  const colors: number[] = [];
  for (let i = 0; i < numStops; i++) {
    const colorIdx = (index + i) % palette.length;
    const { r: pr, g: pg, b: pb } = hexToRGB(palette[colorIdx]);
    colors.push(pr, pg, pb, alpha * 255);
  }

  // For now, use the first color (Q5 doesn't have easy gradient fill)
  // A full implementation would create a gradient pattern
  q5.fill(colors[0], colors[1], colors[2], colors[3]);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawRawPolygon(q5: any, poly: number[][]): void {
  q5.beginShape();
  for (let j = 0; j < poly.length - 1; j++) {
    q5.vertex(poly[j][0], poly[j][1]);
  }
  q5.endShape(q5.CLOSE);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawEdges(q5: any, state: AppState): void {
  const { r, g, b } = hexToRGB(CONFIG.edgeColor);
  q5.stroke(r, g, b);
  q5.strokeWeight(CONFIG.edgeWeight);
  q5.noFill();

  const useSmooth = CONFIG.smoothCells && CONFIG.smoothing > 0;
  const gap = CONFIG.cellGap;
  const useExclusions = CONFIG.attractorExclusionEnabled && state.exclusionZones.length > 0;

  for (let i = 0; i < state.polygons.length; i++) {
    let polys = [state.polygons[i]];

    // Apply exclusion zone clipping if enabled
    if (useExclusions) {
      const poly = state.polygons[i];
      if (!poly || poly.length < 3) continue;
      polys = clipPolygonAgainstExclusions(poly, state.exclusionZones);
      if (polys.length === 0) continue; // Cell fully excluded
    }

    for (const poly of polys) {
      if (!poly || poly.length < 3) continue;

      if (useSmooth) {
        const segs = smoothPolygon(poly, CONFIG.smoothing * 2);
        if (segs && segs.length > 0) {
          const processSegs = gap > 0 ? offsetBezierSegments(segs, poly, -gap) : segs;
          drawSmoothSegments(q5, processSegs);
        } else {
          const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
          drawRawPolyEdges(q5, processPoly);
        }
      } else {
        const processPoly = gap > 0 ? getInsetPolygon(poly, gap) : poly;
        drawRawPolyEdges(q5, processPoly);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawRawPolyEdges(q5: any, poly: number[][]): void {
  q5.beginShape();
  for (let j = 0; j < poly.length - 1; j++) {
    q5.vertex(poly[j][0], poly[j][1]);
  }
  q5.endShape(q5.CLOSE);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawPoints(q5: any, state: AppState): void {
  const size = CONFIG.pointSize;
  const { r, g, b } = hexToRGB(CONFIG.pointColor);
  const style = CONFIG.pointStyle;
  const sw = CONFIG.pointStrokeWeight;

  for (const p of state.particles) {
    if (style === "fill" || style === "both") {
      q5.fill(r, g, b);
      q5.noStroke();
      q5.circle(p.x, p.y, size);
    }
    if (style === "stroke" || style === "both") {
      q5.noFill();
      q5.stroke(r, g, b);
      q5.strokeWeight(sw);
      q5.circle(p.x, p.y, size);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawCellIndices(q5: any, state: AppState): void {
  q5.fill(255, 255, 255, 150);
  q5.noStroke();
  q5.textSize(10);
  q5.textAlign(q5.CENTER, q5.CENTER);

  for (let i = 0; i < state.polygons.length; i++) {
    const poly = state.polygons[i];
    if (!poly || poly.length < 3) continue;

    let cx = 0,
      cy = 0;
    const n = poly.length - 1;
    for (let j = 0; j < n; j++) {
      cx += poly[j][0];
      cy += poly[j][1];
    }
    cx /= n;
    cy /= n;

    q5.text(i.toString(), cx, cy);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawVectorField(q5: any, state: AppState): void {
  const gridSize = CONFIG.vectorGridSize;
  const lineLength = CONFIG.vectorLineLength;
  const scale = CONFIG.vectorFieldScale;
  const t = state.time * CONFIG.vectorFieldTimeScale * 0.1;

  q5.stroke(255, 255, 255, 50);
  q5.strokeWeight(1);

  for (let x = gridSize / 2; x < state.width; x += gridSize) {
    for (let y = gridSize / 2; y < state.height; y += gridSize) {
      const nx = q5.noise(x * scale, y * scale, t);
      const ny = q5.noise(x * scale + 1000, y * scale, t + 1000);
      const angle = nx * Math.PI * 2;

      const x1 = x;
      const y1 = y;
      const x2 = x + Math.cos(angle) * lineLength;
      const y2 = y + Math.sin(angle) * lineLength;

      q5.line(x1, y1, x2, y2);

      // Draw arrow head
      const arrowSize = 3;
      q5.push();
      q5.translate(x2, y2);
      q5.rotate(angle);
      q5.triangle(0, 0, -arrowSize, -arrowSize / 2, -arrowSize, arrowSize / 2);
      q5.pop();
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawExclusionZones(q5: any, state: AppState): void {
  if (state.exclusionZones.length === 0 || !CONFIG.showExclusionOutlines) return;

  q5.push();
  q5.noFill();
  q5.stroke(255, 100, 100, 150);
  q5.strokeWeight(2);

  for (const zone of state.exclusionZones) {
    if (zone.type === "circle") {
      q5.circle(zone.x, zone.y, zone.radius! * 2);
      // Draw center point (draggable handle)
      q5.fill(255, 100, 100, 200);
      q5.noStroke();
      q5.circle(zone.x, zone.y, 10);
      q5.noFill();
      q5.stroke(255, 100, 100, 150);
    } else if (zone.type === "rectangle" || zone.type === "ellipse") {
      if (zone.type === "ellipse") {
        q5.ellipse(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width, zone.height);
      } else {
        q5.rect(zone.x, zone.y, zone.width, zone.height);
      }
      // Draw center point (draggable handle)
      q5.fill(255, 100, 100, 200);
      q5.noStroke();
      q5.circle(zone.x + zone.width / 2, zone.y + zone.height / 2, 10);
      q5.noFill();
      q5.stroke(255, 100, 100, 150);

      // Draw corner handles for rectangles/ellipses
      if (zone.type === "rectangle") {
        q5.fill(255, 150, 150, 180);
        q5.noStroke();
        q5.circle(zone.x, zone.y, 8); // Top-left
        q5.circle(zone.x + zone.width, zone.y, 8); // Top-right
        q5.circle(zone.x, zone.y + zone.height, 8); // Bottom-left
        q5.circle(zone.x + zone.width, zone.y + zone.height, 8); // Bottom-right
      }
    }
  }

  q5.pop();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawAttractors(q5: any, state: AppState): void {
  // Draw temporary attractor/repeller around cursor when mouse is down
  if (!state.mouseIsDown || !CONFIG.attractorEnabled || CONFIG.motion === "none" || !CONFIG.showAttractorField) return;

  const isRepel = state.mouseShiftIsDown;
  const radius = CONFIG.attractorRadius;
  const alpha = 150;

  q5.push();
  if (isRepel) {
    // Repeller: red circle with outward arrows
    q5.noFill();
    q5.stroke(255, 100, 100, alpha);
    q5.strokeWeight(2);
    q5.circle(state.mouseX, state.mouseY, radius * 2);

    // Draw outward arrows
    q5.fill(255, 100, 100, alpha);
    q5.noStroke();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = radius * 0.8;
      const ax = state.mouseX + Math.cos(angle) * dist;
      const ay = state.mouseY + Math.sin(angle) * dist;
      q5.push();
      q5.translate(ax, ay);
      q5.rotate(angle);
      q5.triangle(0, 0, -6, -3, -6, 3);
      q5.pop();
    }

    // Center dot
    q5.fill(255, 100, 100, 255);
    q5.circle(state.mouseX, state.mouseY, 10);
  } else {
    // Attractor: green circle with inward arrows
    q5.noFill();
    q5.stroke(100, 255, 100, alpha);
    q5.strokeWeight(2);
    q5.circle(state.mouseX, state.mouseY, radius * 2);

    // Draw inward arrows
    q5.fill(100, 255, 100, alpha);
    q5.noStroke();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = radius * 0.8;
      const ax = state.mouseX + Math.cos(angle) * dist;
      const ay = state.mouseY + Math.sin(angle) * dist;
      q5.push();
      q5.translate(ax, ay);
      q5.rotate(angle + Math.PI);
      q5.triangle(0, 0, -6, -3, -6, 3);
      q5.pop();
    }

    // Center dot
    q5.fill(100, 255, 100, 255);
    q5.circle(state.mouseX, state.mouseY, 10);
  }
  q5.pop();
}
