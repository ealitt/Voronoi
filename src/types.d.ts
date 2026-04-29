declare module "q5" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Q5SketchFn = (q5: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class Q5 {
    constructor(sketch: Q5SketchFn, container?: HTMLElement);
  }
  export default Q5;
}

declare module "d3-delaunay" {
  export class Delaunay {
    static from(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      points: any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fx?: (p: any) => number, // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fy?: (p: any) => number, // eslint-disable-line @typescript-eslint/no-explicit-any
    ): Delaunay;
    voronoi(bounds: [number, number, number, number]): Voronoi;
  }

  export class Voronoi {
    cellPolygon(i: number): Array<[number, number]>;
  }
}
