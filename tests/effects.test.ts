import { describe, expect, it } from "vitest";
import {
  effectiveOutlineWidth,
  ensureOutlineReferences,
  OUTLINE_MAX_RATIO,
} from "@/features/editor/effects";
import { createImageLayer } from "@/features/editor/types";
import { makeAssetRef } from "./fixtures";

describe("outline width sizing", () => {
  it("keeps the requested width on normal-sized layers and when enlarged", () => {
    expect(effectiveOutlineWidth(4, 400, 400, 400)).toBe(4);
    expect(effectiveOutlineWidth(4, 100, 100, 100)).toBe(4);
    expect(effectiveOutlineWidth(8, 360, 240, 240)).toBe(8);
    expect(effectiveOutlineWidth(4, 720, 720, 360)).toBe(4);
  });

  it("scales the outline down when the layer shrinks", () => {
    expect(effectiveOutlineWidth(4, 180, 180, 360)).toBe(2);
    expect(effectiveOutlineWidth(4, 90, 90, 360)).toBe(1);
    expect(effectiveOutlineWidth(6, 120, 120, 360)).toBe(2);
  });

  it("caps outlines relative to the shortest side on small layers", () => {
    expect(effectiveOutlineWidth(8, 48, 32, 32)).toBeCloseTo(32 * OUTLINE_MAX_RATIO, 5);
    expect(effectiveOutlineWidth(8, 64, 64, 64)).toBeCloseTo(3.84, 5);
  });

  it("never returns a sub-pixel or disabled outline", () => {
    expect(effectiveOutlineWidth(0, 100, 100)).toBe(0);
    expect(effectiveOutlineWidth(-2, 100, 100)).toBe(0);
    expect(effectiveOutlineWidth(0.25, 100, 100)).toBe(1);
    expect(effectiveOutlineWidth(4, 4, 4, 100)).toBe(1);
  });

  it("backfills reference sizes for older image layers", () => {
    const layer = createImageLayer(makeAssetRef(), { id: "image" });
    layer.effects.outline.referenceSize = undefined;
    const scene = {
      version: 1 as const,
      background: {
        mode: "transparent" as const,
        color: "#000000",
        asset: null,
        opacity: 1,
        fit: "cover" as const,
        dim: 0,
        vignette: false,
      },
      layers: [layer],
    };
    const ensured = ensureOutlineReferences(scene);
    expect(ensured.layers[0]?.type).toBe("image");
    if (ensured.layers[0]?.type === "image") {
      expect(ensured.layers[0].effects.outline.referenceSize).toBe(
        Math.min(layer.width, layer.height),
      );
    }
  });
});
