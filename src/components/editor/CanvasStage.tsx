import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Transformer } from "react-konva";
import type Konva from "konva";
import {
  AlertCircle,
  LayoutTemplate,
  Magnet,
  Maximize2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import { setExportLayers } from "@/features/export/stageRegistry";
import { CANVAS_HEIGHT, CANVAS_WIDTH, estimateTextHeight } from "@/features/editor/types";
import {
  ASSET_CATEGORIES,
  type AssetCategory,
  type AssetLicenseStatus,
} from "@/features/assets/types";
import { isAllowedAssetUrl, isLocalAssetUrl } from "../../../shared/assetSources";
import { clamp, round } from "@/lib/utils";
import { notify } from "@/components/ui/toast";
import { Hint } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { updateLayerInScene, type LayerPatch } from "@/features/editor/sceneOps";
import { saveUpload } from "@/features/assets/uploads";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  BackgroundLayer,
  ImageLayerNode,
  TextLayerNode,
} from "@/components/editor/canvas/CanvasLayers";

interface DroppedAsset {
  id: string;
  name: string;
  category: AssetCategory;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceName: string;
  licenseStatus: AssetLicenseStatus;
  attribution: string;
  width: number;
  height: number;
  providerId: string;
  uploadId?: string;
}

function parseDroppedAsset(raw: string): DroppedAsset | null {
  try {
    const value = JSON.parse(raw) as Partial<DroppedAsset>;
    if (!value || typeof value !== "object") return null;
    if (typeof value.id !== "string" || typeof value.name !== "string") return null;
    if (!ASSET_CATEGORIES.includes(value.category as AssetCategory)) return null;
    if (typeof value.imageUrl !== "string" || typeof value.thumbnailUrl !== "string") return null;
    if (value.imageUrl && !isLocalAssetUrl(value.imageUrl) && !isAllowedAssetUrl(value.imageUrl)) {
      return null;
    }
    if (
      typeof value.width !== "number" ||
      typeof value.height !== "number" ||
      value.width <= 0 ||
      value.height <= 0 ||
      value.width > 20_000 ||
      value.height > 20_000
    ) {
      return null;
    }
    if (
      value.thumbnailUrl &&
      !isLocalAssetUrl(value.thumbnailUrl) &&
      !isAllowedAssetUrl(value.thumbnailUrl)
    ) {
      return null;
    }
    const licenseStatuses: AssetLicenseStatus[] = [
      "original",
      "copyrighted",
      "public-domain",
      "unknown",
    ];
    const licenseStatus = licenseStatuses.includes(value.licenseStatus as AssetLicenseStatus)
      ? (value.licenseStatus as AssetLicenseStatus)
      : "unknown";
    return {
      id: value.id,
      name: value.name,
      category: value.category as AssetCategory,
      imageUrl: value.imageUrl,
      thumbnailUrl: value.thumbnailUrl,
      sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : "",
      sourceName: typeof value.sourceName === "string" ? value.sourceName : "Unknown source",
      licenseStatus,
      attribution: typeof value.attribution === "string" ? value.attribution : "",
      width: value.width,
      height: value.height,
      providerId: typeof value.providerId === "string" ? value.providerId : "unknown",
      ...(typeof value.uploadId === "string" ? { uploadId: value.uploadId } : {}),
    };
  } catch {
    return null;
  }
}

export function CanvasStage() {
  const layers = useEditorStore((state) => state.scene.layers);
  const background = useEditorStore((state) => state.scene.background);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const zoom = useEditorStore((state) => state.zoom);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const fitToken = useUiStore((state) => state.fitToken);
  const setMobilePanel = useUiStore((state) => state.setMobilePanel);
  const setInspectorTab = useUiStore((state) => state.setInspectorTab);

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const backgroundLayerRef = useRef<Konva.Layer | null>(null);
  const contentLayerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const guideVRef = useRef<Konva.Line | null>(null);
  const guideHRef = useRef<Konva.Line | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const lastFitZoom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const coarsePointer = useMediaQuery("(pointer: coarse)");

  const setZoom = useEditorStore((state) => state.setZoom);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const registerBackgroundLayer = useCallback((node: Konva.Layer | null) => {
    backgroundLayerRef.current = node;
  }, []);

  const registerContentLayer = useCallback((node: Konva.Layer | null) => {
    contentLayerRef.current = node;
  }, []);

  useEffect(() => {
    if (backgroundLayerRef.current && contentLayerRef.current) {
      setExportLayers({
        background: backgroundLayerRef.current,
        content: contentLayerRef.current,
      });
    }
    return () => setExportLayers(null);
  }, []);

  const fitToScreen = useCallback(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const horizontalPadding = element.clientWidth < 640 ? 32 : 80;
    const verticalPadding = element.clientHeight < 640 ? 64 : 128;
    const width = Math.max(240, element.clientWidth - horizontalPadding);
    const height = Math.max(160, element.clientHeight - verticalPadding);
    const next = clamp(Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT), 0.2, 1.35);
    lastFitZoom.current = next;
    setZoom(next);
  }, [setZoom]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === 0) return;
      const current = useEditorStore.getState().zoom;
      const wasFitted =
        lastFitZoom.current === null || Math.abs(current - lastFitZoom.current) < 0.01;
      if (!wasFitted) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fitToScreen(), 60);
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitToScreen]);

  useEffect(() => {
    if (fitToken > 0) fitToScreen();
  }, [fitToken, fitToScreen]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const current = useEditorStore.getState().zoom;
      useEditorStore.getState().setZoom(current + direction * 0.06);
    };
    element.addEventListener("wheel", handler, { passive: false });
    return () => element.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectedLayers = new Set(
      useEditorStore
        .getState()
        .scene.layers.filter((layer) => selectedIds.includes(layer.id) && !layer.locked)
        .map((layer) => layer.id),
    );
    const nodes = selectedIds
      .filter((id) => selectedLayers.has(id))
      .map((id) => nodeRefs.current.get(id))
      .filter((node): node is Konva.Group => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, layers]);

  const clearGuides = useCallback(() => {
    guideVRef.current?.visible(false);
    guideHRef.current?.visible(false);
    guideVRef.current?.getLayer()?.batchDraw();
  }, []);

  const handleDragStart = useCallback(
    (id: string) => {
      const layer = useEditorStore.getState().scene.layers.find((entry) => entry.id === id);
      if (!layer || layer.locked) return;
      useEditorStore.getState().beginInteraction();
      clearGuides();
    },
    [clearGuides],
  );

  const handleDragMove = useCallback(
    (id: string, node: Konva.Group) => {
      const state = useEditorStore.getState();
      if (!state.snapEnabled) {
        clearGuides();
        return;
      }
      const layer = state.scene.layers.find((entry) => entry.id === id);
      if (!layer) return;
      const threshold = 8 / Math.max(state.zoom, 0.1);
      const others = state.scene.layers.filter(
        (entry) => entry.id !== id && entry.visible && !entry.locked,
      );
      const xCandidates = [CANVAS_WIDTH / 2, ...others.map((entry) => entry.x)];
      const yCandidates = [CANVAS_HEIGHT / 2, ...others.map((entry) => entry.y)];
      const snapX = xCandidates.find((value) => Math.abs(value - node.x()) < threshold);
      const snapY = yCandidates.find((value) => Math.abs(value - node.y()) < threshold);
      if (typeof snapX === "number") node.x(snapX);
      if (typeof snapY === "number") node.y(snapY);

      const guideV = guideVRef.current;
      const guideH = guideHRef.current;
      if (guideV) {
        if (typeof snapX === "number") {
          guideV.points([snapX, 0, snapX, CANVAS_HEIGHT]);
          guideV.visible(true);
        } else {
          guideV.visible(false);
        }
      }
      if (guideH) {
        if (typeof snapY === "number") {
          guideH.points([0, snapY, CANVAS_WIDTH, snapY]);
          guideH.visible(true);
        } else {
          guideH.visible(false);
        }
      }
      guideV?.getLayer()?.batchDraw();
    },
    [clearGuides],
  );

  const handleDragEnd = useCallback(
    (id: string, node: Konva.Group) => {
      clearGuides();
      const state = useEditorStore.getState();
      const layer = state.scene.layers.find((entry) => entry.id === id);
      if (!layer) {
        state.cancelInteraction();
        return;
      }
      const x = round(node.x(), 2);
      const y = round(node.y(), 2);
      if (Math.abs(x - layer.x) < 0.01 && Math.abs(y - layer.y) < 0.01) {
        state.cancelInteraction();
        return;
      }
      state.endInteraction((scene) => updateLayerInScene(scene, id, { x, y }));
    },
    [clearGuides],
  );

  const handleSelect = useCallback((id: string, additive: boolean) => {
    const state = useEditorStore.getState();
    if (additive) {
      state.select(id, true);
      return;
    }
    if (!state.selectedIds.includes(id)) state.select(id);
  }, []);

  const handleDoubleClickText = useCallback(
    (id: string) => {
      const state = useEditorStore.getState();
      state.select(id);
      setInspectorTab("design");
      setMobilePanel(window.matchMedia("(min-width: 1280px)").matches ? null : "inspector");
      window.setTimeout(() => {
        document.getElementById("text-content-input")?.focus();
      }, 80);
    },
    [setInspectorTab, setMobilePanel],
  );

  const handleTransformStart = useCallback(() => {
    useEditorStore.getState().beginInteraction();
    clearGuides();
  }, [clearGuides]);

  const handleTransformEnd = useCallback(() => {
    const state = useEditorStore.getState();
    const transformer = transformerRef.current;
    if (!transformer) {
      state.cancelInteraction();
      return;
    }
    const nodes = transformer.nodes();
    const patches = new Map<string, LayerPatch>();
    let changed = false;
    for (const node of nodes) {
      const id = node.id();
      const layer = state.scene.layers.find((entry) => entry.id === id);
      if (!layer) continue;
      const scaleX = Math.abs(node.scaleX());
      const scaleY = Math.abs(node.scaleY());
      const width = clamp(round(layer.width * scaleX, 2), 4, 20_000);
      const height = clamp(round(layer.height * scaleY, 2), 4, 20_000);
      const rotation = round(node.rotation(), 2);
      const x = round(node.x(), 2);
      const y = round(node.y(), 2);
      const patch: LayerPatch = { x, y, width, height, rotation };
      if (layer.type === "text") {
        const fontSize = clamp(round(layer.fontSize * scaleY, 2), 4, 600);
        patch.fontSize = fontSize;
        patch.height = Math.max(
          fontSize * layer.lineHeight,
          estimateTextHeight({ text: layer.text, fontSize, lineHeight: layer.lineHeight, width }),
        );
      }
      patch.height = Math.max(4, patch.height ?? height);
      patches.set(id, patch);
      if (
        Math.abs(x - layer.x) > 0.01 ||
        Math.abs(y - layer.y) > 0.01 ||
        Math.abs(width - layer.width) > 0.01 ||
        Math.abs(height - layer.height) > 0.01 ||
        Math.abs(rotation - layer.rotation) > 0.01 ||
        (layer.type === "text" && Math.abs((patch.fontSize ?? 0) - layer.fontSize) > 0.01)
      ) {
        changed = true;
      }
      node.scale({ x: 1, y: 1 });
    }
    if (!changed || patches.size === 0) {
      state.cancelInteraction();
      return;
    }
    state.endInteraction((scene) => {
      let next = scene;
      patches.forEach((patch, id) => {
        next = updateLayerInScene(next, id, patch);
      });
      return next;
    });
    transformer.forceUpdate();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const raw = event.dataTransfer.getData("application/x-isaac-asset");
    if (raw) {
      const asset = parseDroppedAsset(raw);
      if (!asset) {
        notify.error("That artwork could not be added", "The dropped asset data was not valid.");
        return;
      }
      const rect = stageWrapperRef.current?.getBoundingClientRect();
      const zoomNow = useEditorStore.getState().zoom;
      const x = rect ? clamp((event.clientX - rect.left) / zoomNow, 0, CANVAS_WIDTH) : undefined;
      const y = rect ? clamp((event.clientY - rect.top) / zoomNow, 0, CANVAS_HEIGHT) : undefined;
      const id = useEditorStore
        .getState()
        .addAsset(asset, { ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) });
      if (!id) notify.error("Layer limit reached", "Delete a layer before adding more.");
      return;
    }
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    const added: string[] = [];
    for (const file of files.slice(0, 6)) {
      try {
        const asset = await saveUpload(file);
        if (useEditorStore.getState().addAsset(asset)) added.push(asset.name);
      } catch (error) {
        notify.error(
          "Upload failed",
          error instanceof Error ? error.message : "Try another image.",
        );
      }
    }
    if (added.length > 0) {
      notify.success(
        `${added.length} image${added.length === 1 ? "" : "s"} added`,
        added.join(", "),
      );
    }
  }, []);

  const focusLibrary = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      document.getElementById("asset-search")?.focus();
    } else {
      setMobilePanel("assets");
    }
  };

  const stageWidth = CANVAS_WIDTH * zoom;
  const stageHeight = CANVAS_HEIGHT * zoom;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={workspaceRef}
        className="canvas-shell relative min-h-0 flex-1 overflow-auto overscroll-contain"
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes("application/x-isaac-asset") ||
            event.dataTransfer.types.includes("Files")
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragOver(false);
        }}
        onDrop={(event) => void handleDrop(event)}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-4 pb-20 sm:p-7">
          <div className="relative shrink-0">
            <div className="pointer-events-none absolute -top-6 left-0 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-muted">
              <span>Canvas · 1280 × 720</span>
              <span className="text-muted-dim">16:9</span>
            </div>
            <div
              ref={stageWrapperRef}
              role="application"
              aria-label="Thumbnail canvas, 1280 by 720 pixels. Use the layers and properties panels for accessible editing."
              className="checkerboard relative touch-none overflow-hidden shadow-[0_32px_90px_-32px_rgba(0,0,0,0.95)] ring-1 ring-white/5"
              style={{ width: stageWidth, height: stageHeight }}
            >
              <Stage
                width={stageWidth}
                height={stageHeight}
                scaleX={zoom}
                scaleY={zoom}
                onMouseDown={(event) => {
                  if (event.target === event.target.getStage()) {
                    useEditorStore.getState().clearSelection();
                  }
                }}
                onTouchStart={(event) => {
                  if (event.target === event.target.getStage()) {
                    useEditorStore.getState().clearSelection();
                  }
                }}
              >
                <BackgroundLayer background={background} registerNode={registerBackgroundLayer} />
                <Layer name="content" ref={registerContentLayer} imageSmoothingEnabled={false}>
                  {layers.map((layer) =>
                    layer.type === "image" ? (
                      <ImageLayerNode
                        key={layer.id}
                        layer={layer}
                        callbacks={{
                          registerNode,
                          onSelect: handleSelect,
                          onDragStart: handleDragStart,
                          onDragMove: handleDragMove,
                          onDragEnd: handleDragEnd,
                        }}
                      />
                    ) : (
                      <TextLayerNode
                        key={layer.id}
                        layer={layer}
                        callbacks={{
                          registerNode,
                          onSelect: handleSelect,
                          onDragStart: handleDragStart,
                          onDragMove: handleDragMove,
                          onDragEnd: handleDragEnd,
                          onDoubleClickText: handleDoubleClickText,
                        }}
                      />
                    ),
                  )}
                </Layer>
                <Layer name="ui" listening>
                  <Line
                    ref={guideVRef}
                    points={[0, 0, 0, CANVAS_HEIGHT]}
                    stroke="#d5aa4a"
                    strokeWidth={1.5 / zoom}
                    dash={[6 / zoom, 4 / zoom]}
                    visible={false}
                    listening={false}
                  />
                  <Line
                    ref={guideHRef}
                    points={[0, 0, CANVAS_WIDTH, 0]}
                    stroke="#d5aa4a"
                    strokeWidth={1.5 / zoom}
                    dash={[6 / zoom, 4 / zoom]}
                    visible={false}
                    listening={false}
                  />
                  <Transformer
                    ref={transformerRef}
                    onTransformStart={handleTransformStart}
                    onTransformEnd={handleTransformEnd}
                    rotateEnabled
                    keepRatio
                    flipEnabled={false}
                    rotationSnaps={[0, 90, 180, 270]}
                    rotationSnapTolerance={4}
                    borderStroke="#d5aa4a"
                    borderStrokeWidth={1.4}
                    anchorStroke="#d5aa4a"
                    anchorFill="#111114"
                    anchorSize={coarsePointer ? 16 : 9}
                    anchorStrokeWidth={coarsePointer ? 2 : 1.4}
                    rotateAnchorOffset={coarsePointer ? 38 : 26}
                    padding={2}
                    ignoreStroke
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
            {dragOver ? (
              <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-gold bg-gold/5" />
            ) : null}
          </div>
        </div>

        {layers.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto w-full max-w-sm rounded-lg border border-line-strong bg-ink-900/95 p-5 text-center shadow-panel backdrop-blur">
              <p className="font-display text-2xl tracking-wide text-cream">Start with a spark</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                This canvas starts transparent at 1280 × 720. Pick a wiki background in Design, add
                a character, or search the artwork library.
              </p>
              <div className="mt-4 grid gap-2">
                <Button type="button" variant="gold" size="md" onClick={focusLibrary}>
                  Browse wiki artwork
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => useEditorStore.getState().addText({ text: "MY NEW RUN" })}
                >
                  <Type className="h-3.5 w-3.5" aria-hidden="true" />
                  Add headline
                </Button>
                <button
                  type="button"
                  className="mt-1 inline-flex items-center justify-center gap-1.5 text-[10px] text-muted transition-colors hover:text-cream"
                  onClick={() => setInspectorTab("presets")}
                >
                  <LayoutTemplate className="h-3 w-3" aria-hidden="true" />
                  Or start from a layout preset
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border border-line-strong bg-ink-850/95 p-1 shadow-float backdrop-blur">
        <Hint label="Zoom out" shortcut="−">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            className="pointer-events-auto"
            onClick={() => setZoom(zoom - 0.1)}
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </Hint>
        <button
          type="button"
          className="pointer-events-auto h-7 min-w-12 rounded px-1 font-mono text-[10px] text-cream-dim transition-colors hover:bg-ink-700 hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
          onClick={() => setZoom(1)}
          aria-label={`${Math.round(zoom * 100)}% zoom. Reset to 100%.`}
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Hint label="Zoom in" shortcut="+">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            className="pointer-events-auto"
            onClick={() => setZoom(zoom + 0.1)}
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </Hint>
        <div className="toolbar-divider" />
        <Hint label="Fit canvas to workspace" shortcut="0">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Fit canvas to workspace"
            className="pointer-events-auto"
            onClick={fitToScreen}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </Hint>
        <Hint
          label={
            snapEnabled
              ? "Snap to center is on — drag near canvas or layer centers"
              : "Snap to center is off"
          }
        >
          <Button
            size="icon-sm"
            variant={snapEnabled ? "gold" : "ghost"}
            aria-label="Toggle snap to canvas and layer centers"
            aria-pressed={snapEnabled}
            className="pointer-events-auto"
            onClick={() => useEditorStore.getState().toggleSnap()}
          >
            <Magnet className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </Hint>
        <span className="px-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : layers.length > 0
              ? `${layers.length} layers`
              : "Empty"}
        </span>
      </div>

      {background.mode === "image" && background.asset ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded border border-line bg-ink-900/80 px-2 py-1 text-[9px] text-muted">
          <AlertCircle className="h-3 w-3 text-muted-dim" aria-hidden="true" />
          Background: {background.asset.name}
        </div>
      ) : null}
    </div>
  );
}
