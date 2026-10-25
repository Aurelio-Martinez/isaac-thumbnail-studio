import { beforeEach, describe, expect, it } from "vitest";
import { resetEditorStore, useEditorStore, getSelectedLayers } from "@/features/editor/store";
import {
  createDefaultBackground,
  createImageLayer,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  makeId,
  type ImageLayer,
} from "@/features/editor/types";
import { effectiveOutlineWidth } from "@/features/editor/effects";
import type { AssetCategory } from "@/features/assets/types";
import { makeAssetRef, makeText } from "./fixtures";
import { createProject } from "@/features/projects/serialize";

function asset(id: string, name: string, category: AssetCategory = "collectibles") {
  return makeAssetRef({ id, name, category });
}

beforeEach(() => {
  resetEditorStore();
});

describe("editor scene operations", () => {
  it("adds and deletes image layers", () => {
    const store = useEditorStore.getState();
    const first = store.addAsset(asset("a", "Lucky Coin"));
    const second = store.addAsset(asset("b", "Bone Charm", "trinkets"));
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(useEditorStore.getState().scene.layers).toHaveLength(2);
    expect(useEditorStore.getState().selectedIds).toEqual([second]);
    expect(useEditorStore.getState().dirty).toBe(true);

    const removed = useEditorStore.getState().deleteSelected();
    expect(removed).toBe(1);
    expect(useEditorStore.getState().scene.layers.map((layer) => layer.name)).toEqual([
      "Lucky Coin",
    ]);
  });

  it("moves, resizes, and rotates a layer with undo and redo", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;

    useEditorStore
      .getState()
      .updateLayer(id, { x: 500, y: 300, width: 200, height: 180, rotation: 15 });
    let layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer).toMatchObject({ x: 500, y: 300, width: 200, height: 180, rotation: 15 });

    useEditorStore.getState().undo();
    layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.x).not.toBe(500);

    useEditorStore.getState().redo();
    layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.x).toBe(500);
    expect(layer.rotation).toBe(15);
  });

  it("coalesces rapid edits to the same field into one undo step", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;
    const original = useEditorStore.getState().scene.layers[0]!.x;

    useEditorStore.getState().updateLayer(id, { x: 700 });
    useEditorStore.getState().updateLayer(id, { x: 800 });
    expect(useEditorStore.getState().past).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.layers[0]!.x).toBe(original);
  });

  it("reorders layers in z-order", () => {
    const store = useEditorStore.getState();
    store.addAsset(asset("a", "A"));
    store.addAsset(asset("b", "B"));
    store.addAsset(asset("c", "C"));
    const [a, b] = useEditorStore.getState().scene.layers;

    useEditorStore.getState().reorderLayer(a!.id, 1);
    expect(useEditorStore.getState().scene.layers.map((layer) => layer.name)).toEqual([
      "B",
      "A",
      "C",
    ]);

    useEditorStore.getState().bringLayerToFront(b!.id);
    expect(useEditorStore.getState().scene.layers.map((layer) => layer.name)).toEqual([
      "A",
      "C",
      "B",
    ]);

    useEditorStore.getState().sendLayerToBack(b!.id);
    expect(useEditorStore.getState().scene.layers.map((layer) => layer.name)).toEqual([
      "B",
      "A",
      "C",
    ]);
  });

  it("duplicates selected layers with new ids and an offset", () => {
    const store = useEditorStore.getState();
    store.addAsset(asset("a", "Lucky Coin", "trinkets"));
    const original = useEditorStore.getState().scene.layers[0]!;
    const count = useEditorStore.getState().duplicateSelected();
    expect(count).toBe(1);
    const layers = useEditorStore.getState().scene.layers;
    expect(layers).toHaveLength(2);
    expect(layers[1]!.id).not.toBe(original.id);
    expect(layers[1]!.x).toBe(original.x + 24);
    expect(layers[1]!.name).toContain("copy");
    expect(useEditorStore.getState().selectedIds).toEqual([layers[1]!.id]);
  });

  it("respects locked layers when deleting", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;
    useEditorStore.getState().toggleLock(id);
    expect(useEditorStore.getState().deleteSelected()).toBe(0);
    expect(useEditorStore.getState().scene.layers).toHaveLength(1);
    useEditorStore.getState().toggleLock(id);
    expect(useEditorStore.getState().deleteSelected()).toBe(1);
  });

  it("adds and edits text layers, including automatic height", () => {
    const id = useEditorStore.getState().addText({ text: "SHORT" });
    expect(id).toBeTruthy();
    const before = useEditorStore.getState().scene.layers[0] as ReturnType<typeof makeText>;
    useEditorStore.getState().updateLayer(id!, {
      text: "A MUCH LONGER HEADLINE THAT WRAPS ACROSS SEVERAL LINES",
      fontSize: 120,
      fontFamily: "Bangers",
      fontWeight: 400,
      color: "#d5aa4a",
      align: "left",
      lineHeight: 1.1,
      letterSpacing: 3,
    });
    const layer = useEditorStore.getState().scene.layers[0] as ReturnType<typeof makeText>;
    expect(layer.text).toContain("MUCH LONGER");
    expect(layer.fontFamily).toBe("Bangers");
    expect(layer.color).toBe("#d5aa4a");
    expect(layer.height).toBeGreaterThan(before.height);
    expect(getSelectedLayers(useEditorStore.getState())).toHaveLength(1);
  });

  it("deep-merges effect changes", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;
    useEditorStore.getState().updateLayer(id, {
      effects: { glow: { enabled: true, color: "#8b6fd1" } },
    });
    const layer = useEditorStore.getState().scene.layers[0]!;
    expect(layer.effects.glow.enabled).toBe(true);
    expect(layer.effects.glow.color).toBe("#8b6fd1");
    expect(layer.effects.outline.enabled).toBe(true);
  });

  it("scales an outline when the layer is resized and re-anchors on width edits", () => {
    useEditorStore.getState().addLayer(
      createImageLayer(makeAssetRef(), {
        width: 360,
        height: 360,
      }),
    );
    const id = useEditorStore.getState().scene.layers[0]!.id;
    let layer = useEditorStore.getState().scene.layers[0] as ImageLayer;
    expect(layer.effects.outline.referenceSize).toBe(360);

    useEditorStore.getState().updateLayer(id, { width: 180, height: 180 });
    layer = useEditorStore.getState().scene.layers[0] as ImageLayer;
    expect(layer.effects.outline.referenceSize).toBe(360);
    expect(
      effectiveOutlineWidth(
        layer.effects.outline.width,
        layer.width,
        layer.height,
        layer.effects.outline.referenceSize,
      ),
    ).toBe(2);

    useEditorStore.getState().updateLayer(id, { effects: { outline: { width: 6 } } });
    layer = useEditorStore.getState().scene.layers[0] as ImageLayer;
    expect(layer.effects.outline.referenceSize).toBe(180);
    expect(
      effectiveOutlineWidth(
        layer.effects.outline.width,
        layer.width,
        layer.height,
        layer.effects.outline.referenceSize,
      ),
    ).toBe(6);
  });

  it("starts transparent, sets a wiki background, and supports undo", () => {
    expect(useEditorStore.getState().scene.background.mode).toBe("transparent");
    const bgAsset = asset("bg", "Basement", "backgrounds");
    useEditorStore.getState().setBackgroundAsset(bgAsset);
    expect(useEditorStore.getState().scene.background.mode).toBe("image");
    expect(useEditorStore.getState().scene.background.asset?.name).toBe("Basement");
    useEditorStore.getState().setTransparentBackground();
    expect(useEditorStore.getState().scene.background.mode).toBe("transparent");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.background.mode).toBe("image");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.background.mode).toBe("transparent");
  });

  it("snapshots a drag interaction as a single history entry", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;
    useEditorStore.getState().beginInteraction();
    useEditorStore.getState().endInteraction((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => (layer.id === id ? { ...layer, x: 555, y: 222 } : layer)),
    }));
    expect(useEditorStore.getState().scene.layers[0]).toMatchObject({ x: 555, y: 222 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.layers[0]!.x).not.toBe(555);
  });

  it("applies composition presets without losing assets and supports undo", () => {
    const store = useEditorStore.getState();
    store.addAsset(asset("char", "Pip", "characters"));
    store.addAsset(asset("i1", "Lucky Coin"));
    store.addAsset(asset("i2", "Bone Charm", "trinkets"));
    store.addText({ text: "MY RUN" });
    const before = useEditorStore.getState().scene;

    const warnings = useEditorStore.getState().applyPreset("hero-left", {
      itemScale: 1,
      itemSpacing: 1,
      characterScale: 1,
      textPosition: "auto",
    });
    expect(warnings).toEqual([]);
    const after = useEditorStore.getState().scene;
    const character = after.layers.find(
      (layer): layer is ImageLayer =>
        layer.type === "image" && layer.asset.category === "characters",
    )!;
    const items = after.layers.filter(
      (layer) => layer.type === "image" && layer.asset.category !== "characters",
    );
    expect(character.x).toBeLessThan(CANVAS_WIDTH / 2);
    expect(items.every((item) => item.x > CANVAS_WIDTH / 2)).toBe(true);
    expect(items.every((item) => item.y > 0 && item.y < CANVAS_HEIGHT)).toBe(true);
    expect(after.layers.map((layer) => (layer.type === "image" ? layer.asset.id : null))).toEqual(
      expect.arrayContaining(["char", "i1", "i2"]),
    );

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene).toEqual(before);
  });

  it("reports missing characters, items, and text in presets", () => {
    useEditorStore.getState().addAsset(asset("i1", "Lucky Coin"));
    const warnings = useEditorStore.getState().applyPreset("hero-center", {
      itemScale: 1,
      itemSpacing: 1,
      characterScale: 1,
      textPosition: "top",
    });
    expect(warnings.join(" ")).toContain("character");
    expect(warnings.join(" ")).toContain("text");
  });

  it("limits history growth", () => {
    useEditorStore.getState().addAsset(asset("a", "Lucky Coin"));
    const id = useEditorStore.getState().scene.layers[0]!.id;
    for (let i = 0; i < 70; i += 1) {
      useEditorStore.getState().updateLayer(id, { x: 100 + i }, { coalesceKey: `step-${i}` });
    }
    expect(useEditorStore.getState().past.length).toBeLessThanOrEqual(60);
  });

  it("selects multiple layers with additive selection", () => {
    useEditorStore.getState().addAsset(asset("a", "A"));
    useEditorStore.getState().addAsset(asset("b", "B"));
    const [a, b] = useEditorStore.getState().scene.layers;
    useEditorStore.getState().select(a!.id);
    useEditorStore.getState().select(b!.id, true);
    expect(useEditorStore.getState().selectedIds).toEqual([a!.id, b!.id]);
    useEditorStore.getState().select(a!.id, true);
    expect(useEditorStore.getState().selectedIds).toEqual([b!.id]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selectedIds).toEqual([]);
  });

  it("replaces projects and clears history", () => {
    useEditorStore.getState().addAsset(asset("a", "A"));
    const project = createProject({ name: "Fresh", scene: useEditorStore.getState().scene });
    useEditorStore.getState().replaceProject({ ...project, id: makeId("project") });
    const state = useEditorStore.getState();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.dirty).toBe(false);
    expect(state.projectName).toBe("Fresh");
    expect(state.lastSavedAt).toBe(project.updatedAt);
  });

  it("saves and hydrates a scene without adding history", () => {
    const scene = {
      version: 1 as const,
      background: createDefaultBackground(),
      layers: [makeText({ text: "A" })],
    };
    useEditorStore.getState().hydrateScene(scene);
    expect(useEditorStore.getState().scene.layers).toHaveLength(1);
    expect(useEditorStore.getState().past).toEqual([]);
  });
});
