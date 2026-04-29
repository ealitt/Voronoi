import type { ExclusionZone } from "./config";

/**
 * Clip a polygon against all exclusion zones.
 * Returns a new polygon (or array of polygons if the result is disconnected)
 * that represents the original polygon with the exclusion zones removed.
 *
 * @param polygon - The polygon to clip (array of [x, y] points, closed with first point repeated)
 * @param exclusionZones - Array of exclusion zones to clip against
 * @returns Array of clipped polygons (may be empty if polygon is fully excluded)
 */
export function clipPolygonAgainstExclusions(
  polygon: number[][],
  exclusionZones: ExclusionZone[],
): number[][][] {
  if (exclusionZones.length === 0) {
    return [polygon];
  }

  let results: number[][][] = [polygon];

  for (const zone of exclusionZones) {
    const zonePoly = zoneToPolygon(zone);
    const newResults: number[][][] = [];

    for (const poly of results) {
      const clipped = clipPolygonDifference(poly, zonePoly);
      newResults.push(...clipped);
    }

    results = newResults;
    if (results.length === 0) {
      return []; // Polygon completely excluded
    }
  }

  return results;
}

/**
 * Convert an exclusion zone to a polygon representation.
 */
function zoneToPolygon(zone: ExclusionZone): number[][] {
  if (zone.type === "circle") {
    return circleToPolygon(zone.x, zone.y, zone.radius!);
  } else {
    // For rectangle and ellipse, approximate with a polygon
    // For rectangle, it's exact (4 corners)
    // For ellipse, we approximate with many points
    if (zone.type === "rectangle") {
      return [
        [zone.x, zone.y],
        [zone.x + zone.width, zone.y],
        [zone.x + zone.width, zone.y + zone.height],
        [zone.x, zone.y + zone.height],
        [zone.x, zone.y], // Close the polygon
      ];
    } else {
      // Ellipse - approximate with polygon
      return ellipseToPolygon(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width / 2,
        zone.height / 2,
      );
    }
  }
}

/**
 * Approximate a circle as a polygon with 32 segments.
 */
function circleToPolygon(cx: number, cy: number, radius: number): number[][] {
  const segments = 32;
  const poly: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    poly.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return poly;
}

/**
 * Approximate an ellipse as a polygon.
 */
function ellipseToPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments = 32,
): number[][] {
  const poly: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    poly.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return poly;
}

/**
 * Compute the difference of two polygons: subject - clip.
 * Returns the portion of the subject polygon that lies outside the clip polygon.
 * Uses the Weiler-Atherton algorithm for general polygon clipping.
 *
 * For simplicity, we use a different approach:
 * 1. If the subject polygon doesn't intersect the clip polygon, return it as-is
 * 2. If it's completely inside, return empty
 * 3. If it intersects, use a simpler clipping approach
 *
 * Since computing the exact difference is complex, we use a point-based approach:
 * - Triangulate the subject polygon
 * - Keep only triangles whose centroids are outside the clip polygon
 * - Merge back (simplified - just return the triangles)
 */
function clipPolygonDifference(
  subject: number[][],
  clip: number[][],
): number[][][] {
  // Check if subject is completely outside clip
  const subjectOutside = isPolygonOutside(subject, clip);
  if (subjectOutside) {
    return [subject];
  }

  // Check if subject is completely inside clip
  const subjectInside = isPolygonInside(subject, clip);
  if (subjectInside) {
    return []; // Completely excluded
  }

  // Partial intersection - use Sutherland-Hodgman to keep outside
  return clipPolygonOutside(subject, clip);
}

/**
 * Check if all vertices of polygon are outside the clip polygon.
 */
function isPolygonOutside(polygon: number[][], clip: number[][]): boolean {
  for (const point of polygon) {
    if (pointInPolygon(point, clip)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if all vertices of polygon are inside the clip polygon.
 */
function isPolygonInside(polygon: number[][], clip: number[][]): boolean {
  for (const point of polygon) {
    if (!pointInPolygon(point, clip)) {
      return false;
    }
  }
  return true;
}

/**
 * Point-in-polygon test using ray casting.
 */
function pointInPolygon(point: number[], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Clip a polygon to keep only the parts OUTSIDE the clip polygon.
 * This is a modified Sutherland-Hodgman that inverts the clipping logic.
 */
function clipPolygonOutside(subject: number[][], clip: number[][]): number[][][] {
  let result = subject;

  // For each edge of the clip polygon, keep points on the OUTSIDE
  for (let i = 0; i < clip.length - 1; i++) {
    const clipStart = clip[i];
    const clipEnd = clip[i + 1];
    result = clipAgainstEdgeOutside(result, clipStart, clipEnd);

    if (result.length === 0) {
      return [];
    }
  }

  return [result];
}

/**
 * Clip polygon against a single edge, keeping points on the OUTSIDE.
 */
function clipAgainstEdgeOutside(
  polygon: number[][],
  edgeStart: number[],
  edgeEnd: number[],
): number[][] {
  const result: number[][] = [];

  if (polygon.length === 0) return result;

  // Calculate edge normal (pointing inward to the clip polygon)
  const edgeX = edgeEnd[0] - edgeStart[0];
  const edgeY = edgeEnd[1] - edgeStart[1];
  // Normal pointing left of the edge direction (assuming counter-clockwise winding)
  const normalX = -edgeY;
  const normalY = edgeX;

  // Normalize
  const len = Math.sqrt(normalX * normalX + normalY * normalY);
  const normX = len > 0 ? normalX / len : 0;
  const normY = len > 0 ? normalY / len : 0;

  for (let i = 0; i < polygon.length - 1; i++) {
    const current = polygon[i];
    const next = polygon[i + 1];

    const currentInside = isPointInsideEdge(current, edgeStart, normX, normY);
    const nextInside = isPointInsideEdge(next, edgeStart, normX, normY);

    if (!currentInside && !nextInside) {
      // Both outside - keep next
      result.push(next);
    } else if (!currentInside && nextInside) {
      // Leaving the inside region - add intersection
      const intersection = lineIntersection(
        current,
        next,
        edgeStart,
        edgeEnd,
      );
      if (intersection) {
        result.push(intersection);
      }
    } else if (currentInside && !nextInside) {
      // Entering the outside region - add intersection and next
      const intersection = lineIntersection(
        current,
        next,
        edgeStart,
        edgeEnd,
      );
      if (intersection) {
        result.push(intersection);
        result.push(next);
      }
    }
    // If both inside, add nothing (we're removing the inside part)
  }

  if (result.length > 0 && result.length < 3) {
    return [];
  }

  // Close the polygon if needed
  if (result.length > 0) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      result.push([...first]);
    }
  }

  return result;
}

/**
 * Check if a point is on the "inside" side of an edge.
 * Inside means on the side the normal points to.
 */
function isPointInsideEdge(
  point: number[],
  edgeStart: number[],
  normalX: number,
  normalY: number,
): boolean {
  const dx = point[0] - edgeStart[0];
  const dy = point[1] - edgeStart[1];
  return dx * normalX + dy * normalY >= 0;
}

/**
 * Find the intersection of two line segments.
 */
function lineIntersection(
  p1: number[],
  p2: number[],
  p3: number[],
  p4: number[],
): number[] | null {
  const x1 = p1[0],
    y1 = p1[1];
  const x2 = p2[0],
    y2 = p2[1];
  const x3 = p3[0],
    y3 = p3[1];
  const x4 = p4[0],
    y4 = p4[1];

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) {
    return null; // Parallel or collinear
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}
