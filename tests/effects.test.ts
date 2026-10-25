import { describe, expect, it } from "vitest";
import { effectiveOutlineWidth, OUTLINE_MAX_RATIO } from "@/features/editor/effects";

describe("outline width sizing", () => {
  it("keeps the requested width on normal-sized layers", () => {
    expect(effectiveOutlineWidth(4, 400, 400)).toBe(4);
    expect(effectiveOutlineWidth(4, 100, 100)).toBe(4);
    expect(effectiveOutlineWidth(8, 360, 240)).toBe(8);
  });

  it("caps outlines relative to the shortest side on small layers", () => {
    expect(effectiveOutlineWidth(4, 32, 32)).toBeCloseTo(32 * OUTLINE_MAX_RATIO, 5);
    expect(effectiveOutlineWidth(8, 48, 32)).toBeCloseTo(32 * OUTLINE_MAX_RATIO, 5);
    expect(effectiveOutlineWidth(4, 24, 24)).toBeCloseTo(1.44, 5);
  });

  it("never returns a sub-pixel or disabled outline", () => {
    expect(effectiveOutlineWidth(0, 100, 100)).toBe(0);
    expect(effectiveOutlineWidth(-2, 100, 100)).toBe(0);
    expect(effectiveOutlineWidth(0.25, 100, 100)).toBe(1);
    expect(effectiveOutlineWidth(4, 4, 4)).toBe(1);
  });
});
