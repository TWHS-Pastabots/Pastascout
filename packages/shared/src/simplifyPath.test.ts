import { describe, expect, it } from "vitest";
import { simplifyPath } from "./simplifyPath";

describe("simplifyPath", () => {
  it("collapses collinear points to just the endpoints", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.25 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.75 },
      { x: 1, y: 1 },
    ];
    expect(simplifyPath(line, 0.01)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it("keeps a corner that defines the shape", () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
    ];
    const result = simplifyPath(corner, 0.01);
    expect(result).toContainEqual({ x: 1, y: 0 });
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 1, y: 1 });
  });

  it("always preserves the first and last point", () => {
    const noisy = Array.from({ length: 50 }, (_, i) => ({ x: i / 49, y: Math.sin(i) * 0.001 }));
    const result = simplifyPath(noisy, 0.05);
    expect(result[0]).toEqual(noisy[0]);
    expect(result[result.length - 1]).toEqual(noisy[noisy.length - 1]);
  });

  it("substantially thins a dense drag while keeping the route recognizable", () => {
    // ~200 points along an L-shaped route, like a real finger drag.
    const dense = [
      ...Array.from({ length: 100 }, (_, i) => ({ x: i / 99, y: 0 })),
      ...Array.from({ length: 100 }, (_, i) => ({ x: 1, y: i / 99 })),
    ];
    const result = simplifyPath(dense, 0.01);
    expect(result.length).toBeLessThan(10);
    expect(result).toContainEqual({ x: 1, y: 0 });
  });

  it("preserves extra properties like timestamps on kept points", () => {
    const timed = [
      { x: 0, y: 0, t: 0 },
      { x: 0.5, y: 0.5, t: 1 },
      { x: 1, y: 1, t: 2 },
    ];
    expect(simplifyPath(timed, 0.01)).toEqual([
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 2 },
    ]);
  });

  it("returns short paths untouched", () => {
    expect(simplifyPath([{ x: 0, y: 0 }], 0.01)).toEqual([{ x: 0, y: 0 }]);
    expect(simplifyPath([], 0.01)).toEqual([]);
  });
});
