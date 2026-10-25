import { create } from "zustand";
import { APP_CONFIG } from "@/config";
import type { AssetRef } from "@/features/assets/types";
import {
  applyLayoutPreset,
  type LayoutPresetId,
  type PresetOptions,
} from "@/features/editor/presets";
import {
  addLayerToScene,
  alignLayer,
  bringToFront,
  duplicateLayersInScene,
  fitLayerToCanvas,
  isOverLayerLimit,
  moveLayerToIndex,
  removeLayersFromScene,
  reorderLayerInScene,
  sendToBack,
  toggleLayerFlag,
  updateLayerInScene,
  type AlignEdge,
  type LayerPatch,
} from "@/features/editor/sceneOps";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  SCENE_VERSION,
  createDefaultBackground,
  createImageLayer,
  createTextLayer,
  type ImageLayer,
  type Layer,
  type ProjectFile,
  type Scene,
  type SceneBackground,
  type TextLayer,
} from "@/features/editor/types";
import { clamp, normalizeRotation } from "@/lib/utils";

export interface HistorySnapshot {
  scene: Scene;
  selectedIds: string[];
}

interface CommitOptions {
  select?: string[];
  coalesceKey?: string;
  history?: boolean;
}

export interface EditorStore {
  projectId: string;
  projectName: string;
  createdAt: string;
  scene: Scene;
  selectedIds: string[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  interactionBase: HistorySnapshot | null;
  historyKey: string | null;
  historyAt: number;
  zoom: number;
  snapEnabled: boolean;
  dirty: boolean;
  lastSavedAt: string | null;
  saveError: string | null;

  replaceProject: (project: ProjectFile) => void;
  hydrateScene: (scene: Scene) => void;
  setProjectName: (name: string) => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;

  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  addLayer: (layer: Layer) => string | null;
  addAsset: (asset: AssetRef, options?: { x?: number; y?: number }) => string | null;
  addText: (overrides?: Partial<TextLayer>) => string | null;
  setBackgroundAsset: (asset: AssetRef) => void;
  setTransparentBackground: () => void;
  clearBackgroundImage: () => void;
  setBackground: (patch: Partial<SceneBackground>) => void;

  updateLayer: (id: string, patch: LayerPatch, options?: { coalesceKey?: string }) => boolean;
  deleteSelected: () => number;
  deleteLayer: (id: string) => boolean;
  duplicateSelected: () => number;
  reorderLayer: (id: string, delta: number) => void;
  moveLayer: (id: string, index: number) => void;
  bringLayerToFront: (id: string) => void;
  sendLayerToBack: (id: string) => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  alignSelected: (edge: AlignEdge) => void;
  fitSelected: () => void;
  centerSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  rotateSelectedBy: (delta: number) => void;

  applyPreset: (presetId: LayoutPresetId, options: PresetOptions) => string[];

  beginInteraction: () => void;
  endInteraction: (mutate: (scene: Scene) => Scene) => boolean;
  cancelInteraction: () => void;

  undo: () => void;
  redo: () => void;
  markSaved: (timestamp?: string) => void;
  markSaveError: (message: string | null) => void;
}

const HISTORY_LIMIT = APP_CONFIG.historyLimit;
const COALESCE_MS = 700;

function initialScene(): Scene {
  return {
    version: SCENE_VERSION,
    background: createDefaultBackground(),
    layers: [],
  };
}

export function createInitialEditorState(): Pick<
  EditorStore,
  | "projectId"
  | "projectName"
  | "createdAt"
  | "scene"
  | "selectedIds"
  | "past"
  | "future"
  | "interactionBase"
  | "historyKey"
  | "historyAt"
  | "zoom"
  | "snapEnabled"
  | "dirty"
  | "lastSavedAt"
  | "saveError"
> {
  return {
    projectId: "draft-project",
    projectName: "Untitled thumbnail",
    createdAt: new Date().toISOString(),
    scene: initialScene(),
    selectedIds: [],
    past: [],
    future: [],
    interactionBase: null,
    historyKey: null,
    historyAt: 0,
    zoom: 0.6,
    snapEnabled: true,
    dirty: false,
    lastSavedAt: null,
    saveError: null,
  };
}

function filterSelection(scene: Scene, ids: string[]): string[] {
  const existing = new Set(scene.layers.map((layer) => layer.id));
  return ids.filter((id) => existing.has(id));
}

export const useEditorStore = create<EditorStore>()((set, get) => {
  const snapshot = (): HistorySnapshot => ({
    scene: get().scene,
    selectedIds: [...get().selectedIds],
  });

  const commit = (mutate: (scene: Scene) => Scene, options: CommitOptions = {}): boolean => {
    const state = get();
    const nextScene = mutate(state.scene);
    if (nextScene === state.scene) return false;
    const now = Date.now();
    const coalesceKey = options.coalesceKey ?? null;
    const coalescing =
      options.history !== false &&
      coalesceKey !== null &&
      state.historyKey === coalesceKey &&
      now - state.historyAt < COALESCE_MS;
    const past =
      options.history === false || coalescing
        ? state.past
        : [...state.past, snapshot()].slice(-HISTORY_LIMIT);
    const selected = filterSelection(nextScene, options.select ?? state.selectedIds);
    set({
      scene: nextScene,
      past,
      future: options.history === false ? state.future : [],
      selectedIds: selected,
      historyKey: coalesceKey,
      historyAt: now,
      dirty: true,
    });
    return true;
  };

  return {
    ...createInitialEditorState(),

    replaceProject: (project) =>
      set({
        projectId: project.id,
        projectName: project.name.slice(0, 80),
        createdAt: project.createdAt,
        scene: structuredClone(project.scene),
        selectedIds: [],
        past: [],
        future: [],
        interactionBase: null,
        historyKey: null,
        historyAt: 0,
        dirty: false,
        lastSavedAt: project.updatedAt,
        saveError: null,
      }),

    hydrateScene: (scene) =>
      set((state) => ({
        scene: filterSelection(scene, state.selectedIds) === state.selectedIds ? scene : scene,
        selectedIds: filterSelection(scene, state.selectedIds),
      })),

    setProjectName: (name) => set({ projectName: name.slice(0, 80), dirty: true }),

    setZoom: (zoom) =>
      set({
        zoom: clamp(Number.isFinite(zoom) ? zoom : 0.6, APP_CONFIG.minZoom, APP_CONFIG.maxZoom),
      }),

    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

    select: (id, additive = false) =>
      set((state) => {
        if (!state.scene.layers.some((layer) => layer.id === id)) return state;
        if (!additive) return { selectedIds: [id] };
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((entry) => entry !== id)
            : [...state.selectedIds, id],
        };
      }),

    selectMany: (ids) => set({ selectedIds: filterSelection(get().scene, ids) }),
    clearSelection: () => set({ selectedIds: [] }),

    addLayer: (layer) => {
      const state = get();
      if (isOverLayerLimit(state.scene, APP_CONFIG.maxLayers)) return null;
      const ok = commit((scene) => addLayerToScene(scene, layer), { select: [layer.id] });
      return ok ? layer.id : null;
    },

    addAsset: (asset, options) => {
      const state = get();
      if (isOverLayerLimit(state.scene, APP_CONFIG.maxLayers)) return null;
      const cascade = (state.scene.layers.length % 5) * 18 - 36;
      const layer = createImageLayer(asset, {
        x: options?.x ?? CANVAS_WIDTH / 2 + cascade,
        y: options?.y ?? CANVAS_HEIGHT / 2 + cascade,
        ...(asset.category === "backgrounds"
          ? {
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              x: CANVAS_WIDTH / 2,
              y: CANVAS_HEIGHT / 2,
            }
          : {}),
      });
      if (asset.category === "backgrounds") {
        layer.effects = {
          shadow: { ...layer.effects.shadow, enabled: false },
          outline: { ...layer.effects.outline, enabled: false },
          glow: { ...layer.effects.glow, enabled: false },
        };
        const ok = commit((scene) => ({ ...scene, layers: [layer, ...scene.layers] }), {
          select: [layer.id],
        });
        return ok ? layer.id : null;
      }
      const ok = commit((scene) => addLayerToScene(scene, layer), { select: [layer.id] });
      return ok ? layer.id : null;
    },

    addText: (overrides) => {
      const state = get();
      if (isOverLayerLimit(state.scene, APP_CONFIG.maxLayers)) return null;
      const cascade = (state.scene.layers.length % 5) * 18 - 36;
      const layer = createTextLayer({
        x: CANVAS_WIDTH / 2 + cascade,
        y: 120 + cascade,
        ...overrides,
      });
      const ok = commit((scene) => addLayerToScene(scene, layer), { select: [layer.id] });
      return ok ? layer.id : null;
    },

    setBackgroundAsset: (asset) =>
      commit(
        (scene) => ({
          ...scene,
          background: { ...scene.background, mode: "image", asset, fit: "cover" },
        }),
        { coalesceKey: "background-set-image" },
      ),

    setTransparentBackground: () =>
      commit(
        (scene) => ({
          ...scene,
          background: { ...scene.background, mode: "transparent", asset: null },
        }),
        { coalesceKey: "background-transparent" },
      ),

    clearBackgroundImage: () =>
      commit(
        (scene) => ({
          ...scene,
          background: { ...scene.background, mode: "transparent", asset: null },
        }),
        { coalesceKey: "background-clear-image" },
      ),

    setBackground: (patch) =>
      commit((scene) => ({ ...scene, background: { ...scene.background, ...patch } }), {
        coalesceKey: `background:${Object.keys(patch).sort().join(",")}`,
      }),

    updateLayer: (id, patch, options) => {
      const state = get();
      if (!state.scene.layers.some((layer) => layer.id === id)) return false;
      const key =
        options?.coalesceKey ?? `layer:${id}:${Object.keys(patch).sort().join(",") || "all"}`;
      return commit((scene) => updateLayerInScene(scene, id, patch), { coalesceKey: key });
    },

    deleteSelected: () => {
      const state = get();
      const ids = state.scene.layers
        .filter((layer) => state.selectedIds.includes(layer.id) && !layer.locked)
        .map((layer) => layer.id);
      if (ids.length === 0) return 0;
      commit((scene) => removeLayersFromScene(scene, ids), { select: [] });
      return ids.length;
    },

    deleteLayer: (id) => {
      const layer = get().scene.layers.find((entry) => entry.id === id);
      if (!layer || layer.locked) return false;
      return commit((scene) => removeLayersFromScene(scene, [id]), {
        select: get().selectedIds.filter((entry) => entry !== id),
      });
    },

    duplicateSelected: () => {
      const state = get();
      const selected = state.scene.layers.filter((layer) => state.selectedIds.includes(layer.id));
      if (selected.length === 0) return 0;
      if (state.scene.layers.length + selected.length > APP_CONFIG.maxLayers) return 0;
      let newIds: string[] = [];
      const ok = commit(
        (scene) => {
          const result = duplicateLayersInScene(
            scene,
            selected.map((layer) => layer.id),
          );
          newIds = result.ids;
          return result.scene;
        },
        { select: [] },
      );
      if (!ok) return 0;
      set({ selectedIds: newIds });
      return newIds.length;
    },

    reorderLayer: (id, delta) => {
      commit((scene) => reorderLayerInScene(scene, id, delta), { coalesceKey: undefined });
    },

    moveLayer: (id, index) => {
      commit((scene) => moveLayerToIndex(scene, id, index), { coalesceKey: undefined });
    },

    bringLayerToFront: (id) => {
      commit((scene) => bringToFront(scene, id), { coalesceKey: undefined });
    },

    sendLayerToBack: (id) => {
      commit((scene) => sendToBack(scene, id), { coalesceKey: undefined });
    },

    toggleLock: (id) => {
      commit((scene) => toggleLayerFlag(scene, id, "locked"), { coalesceKey: undefined });
    },

    toggleVisibility: (id) => {
      commit((scene) => toggleLayerFlag(scene, id, "visible"), { coalesceKey: undefined });
    },

    alignSelected: (edge) => {
      const selected = new Set(get().selectedIds);
      commit(
        (scene) => ({
          ...scene,
          layers: scene.layers.map((layer) =>
            selected.has(layer.id) && !layer.locked ? alignLayer(layer, edge) : layer,
          ),
        }),
        { coalesceKey: `align:${edge}` },
      );
    },

    fitSelected: () => {
      const selected = new Set(get().selectedIds);
      commit(
        (scene) => ({
          ...scene,
          layers: scene.layers.map((layer) =>
            selected.has(layer.id) && !layer.locked ? fitLayerToCanvas(layer) : layer,
          ),
        }),
        { coalesceKey: "fit" },
      );
    },

    centerSelected: () => {
      const selected = new Set(get().selectedIds);
      commit(
        (scene) => ({
          ...scene,
          layers: scene.layers.map((layer) =>
            selected.has(layer.id) && !layer.locked
              ? { ...layer, x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
              : layer,
          ),
        }),
        { coalesceKey: "center" },
      );
    },

    nudgeSelected: (dx, dy) => {
      const selected = new Set(get().selectedIds);
      commit(
        (scene) => ({
          ...scene,
          layers: scene.layers.map((layer) =>
            selected.has(layer.id) && !layer.locked
              ? { ...layer, x: layer.x + dx, y: layer.y + dy }
              : layer,
          ),
        }),
        { coalesceKey: "nudge" },
      );
    },

    rotateSelectedBy: (delta) => {
      const selected = new Set(get().selectedIds);
      commit(
        (scene) => ({
          ...scene,
          layers: scene.layers.map((layer) =>
            selected.has(layer.id) && !layer.locked
              ? { ...layer, rotation: normalizeRotation(layer.rotation + delta) }
              : layer,
          ),
        }),
        { coalesceKey: "rotate-selected" },
      );
    },

    applyPreset: (presetId, options) => {
      const state = get();
      const { scene, warnings } = applyLayoutPreset(state.scene, presetId, options);
      if (scene !== state.scene) {
        commit(() => scene, { coalesceKey: `preset:${presetId}` });
      }
      return warnings;
    },

    beginInteraction: () => {
      if (get().interactionBase) return;
      set({ interactionBase: snapshot() });
    },

    endInteraction: (mutate) => {
      const base = get().interactionBase;
      if (!base) return false;
      set({ interactionBase: null });
      const nextScene = mutate(base.scene);
      if (nextScene === base.scene) return false;
      set((state) => ({
        scene: nextScene,
        past: [...state.past, base].slice(-HISTORY_LIMIT),
        future: [],
        selectedIds: filterSelection(nextScene, state.selectedIds),
        historyKey: null,
        historyAt: Date.now(),
        dirty: true,
      }));
      return true;
    },

    cancelInteraction: () => set({ interactionBase: null }),

    undo: () => {
      const state = get();
      if (state.past.length === 0) return;
      const previous = state.past[state.past.length - 1]!;
      set({
        past: state.past.slice(0, -1),
        future: [
          { scene: state.scene, selectedIds: [...state.selectedIds] },
          ...state.future,
        ].slice(0, HISTORY_LIMIT),
        scene: previous.scene,
        selectedIds: filterSelection(previous.scene, previous.selectedIds),
        dirty: true,
        historyKey: null,
        interactionBase: null,
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      const next = state.future[0]!;
      set({
        past: [...state.past, { scene: state.scene, selectedIds: [...state.selectedIds] }].slice(
          -HISTORY_LIMIT,
        ),
        future: state.future.slice(1),
        scene: next.scene,
        selectedIds: filterSelection(next.scene, next.selectedIds),
        dirty: true,
        historyKey: null,
        interactionBase: null,
      });
    },

    markSaved: (timestamp) =>
      set({ dirty: false, lastSavedAt: timestamp ?? new Date().toISOString(), saveError: null }),
    markSaveError: (message) => set({ saveError: message }),
  };
});

export function getSelectedLayers(state: EditorStore): Layer[] {
  const selected = new Set(state.selectedIds);
  return state.scene.layers.filter((layer) => selected.has(layer.id));
}

export function getSelectedImageLayer(state: EditorStore): ImageLayer | null {
  const layers = getSelectedLayers(state);
  return (layers.find((layer) => layer.type === "image") as ImageLayer | undefined) ?? null;
}

export function resetEditorStore(): void {
  useEditorStore.setState(createInitialEditorState());
}
