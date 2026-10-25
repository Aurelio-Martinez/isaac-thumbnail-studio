import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  Lock,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlock,
  Type,
} from "lucide-react";
import type { AssetRef } from "@/features/assets/types";
import { ASSET_CATEGORY_META } from "@/features/assets/types";
import { displayThumbnail } from "@/features/assets/resolve";
import { useAssetImage, retryImage } from "@/features/assets/imageRegistry";
import { useEditorStore } from "@/features/editor/store";
import {
  FONT_FAMILIES,
  type FontFamilyId,
  type ImageLayer,
  type Layer,
  type TextLayer,
} from "@/features/editor/types";
import type { AlignEdge, LayerPatch } from "@/features/editor/sceneOps";
import { Button } from "@/components/ui/button";
import { ColorField, NumberField, SliderField } from "@/components/ui/controls";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Hint } from "@/components/ui/tooltip";
import { Section, InfoBanner } from "@/components/editor/Section";
import { EffectsControls } from "@/components/editor/EffectsControls";
import { TEXT_STYLE_PRESETS } from "@/components/editor/textStylePresets";
import { notify } from "@/components/ui/toast";
import { cn, normalizeRotation, round } from "@/lib/utils";

const LICENSE_LABEL: Record<AssetRef["licenseStatus"], string> = {
  original: "Original studio art",
  copyrighted: "IN COPYRIGHT",
  "public-domain": "Public domain",
  unknown: "Check rights",
};

const LICENSE_STYLE: Record<AssetRef["licenseStatus"], string> = {
  original: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  copyrighted: "border-ember/50 bg-ember/10 text-[#f09a86]",
  "public-domain": "border-gold/50 bg-gold/10 text-gold",
  unknown: "border-line-strong bg-ink-700 text-cream-dim",
};

function AssetSummary({ asset }: { asset: AssetRef }) {
  const entry = useAssetImage(asset.imageUrl);
  const category = ASSET_CATEGORY_META[asset.category];
  const isRemoteLink = asset.sourceUrl.startsWith("https://");

  return (
    <div className="rounded border border-line bg-ink-800/80 p-2.5">
      <div className="flex gap-2.5">
        <div className="checkerboard h-14 w-14 shrink-0 overflow-hidden rounded border border-line">
          <img
            src={displayThumbnail(asset.thumbnailUrl || asset.imageUrl)}
            alt=""
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-cream">{asset.name}</p>
          <p className="text-[10px] text-muted">
            {category.label} · {asset.width}×{asset.height}
          </p>
          <p className="truncate text-[10px] text-muted-dim">{asset.sourceName}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em]",
            LICENSE_STYLE[asset.licenseStatus],
          )}
        >
          {LICENSE_LABEL[asset.licenseStatus]}
        </span>
        {isRemoteLink ? (
          <a
            href={asset.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-0.5 text-[9px] text-muted underline-offset-2 hover:text-cream hover:underline"
          >
            Source page
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[9px] text-muted">
            {asset.uploadId ? "Uploaded in this browser" : "Live wiki artwork"}
          </span>
        )}
      </div>
      <p
        className="mt-1.5 line-clamp-3 text-[9px] leading-snug text-muted-dim"
        title={asset.attribution}
      >
        {asset.attribution}
      </p>
      {entry?.status === "error" ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded border border-ember/30 bg-ember/5 px-2 py-1">
          <span className="text-[9px] text-cream-dim">Image failed to load.</span>
          <button
            type="button"
            className="flex items-center gap-1 text-[9px] font-semibold text-gold hover:underline"
            onClick={() => void retryImage(asset.imageUrl)}
          >
            <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}
      {entry?.status === "loaded" && !entry.exportSafe ? (
        <p className="mt-2 rounded border border-ember/30 bg-ember/5 px-2 py-1 text-[9px] leading-snug text-cream-dim">
          This image previews without CORS, so PNG export is blocked. Retry with the artwork proxy
          online or replace it with an upload.
        </p>
      ) : null}
    </div>
  );
}

function AlignmentGrid({ disabled }: { disabled: boolean }) {
  const align = useEditorStore((state) => state.alignSelected);
  const buttons: Array<{ edge: AlignEdge; label: string; icon: typeof AlignLeft }> = [
    { edge: "left", label: "Align left edges", icon: ArrowLeftToLine },
    { edge: "center-x", label: "Center horizontally", icon: AlignCenterHorizontal },
    { edge: "right", label: "Align right edges", icon: ArrowRightToLine },
    { edge: "top", label: "Align top edges", icon: ArrowUpToLine },
    { edge: "middle-y", label: "Center vertically", icon: AlignCenterVertical },
    { edge: "bottom", label: "Align bottom edges", icon: ArrowDownToLine },
  ];
  return (
    <div
      className="grid grid-cols-6 gap-1"
      role="group"
      aria-label="Align selected layers to canvas"
    >
      {buttons.map((entry) => {
        const Icon = entry.icon;
        return (
          <Hint key={entry.edge} label={entry.label}>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={entry.label}
              disabled={disabled}
              onClick={() => align(entry.edge)}
              className="w-full"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Hint>
        );
      })}
    </div>
  );
}

function SelectionActions({
  disabled,
  locked,
  imageLayer,
}: {
  disabled: boolean;
  locked: boolean;
  imageLayer?: ImageLayer;
}) {
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const fitSelected = useEditorStore((state) => state.fitSelected);
  const centerSelected = useEditorStore((state) => state.centerSelected);
  const bringLayerToFront = useEditorStore((state) => state.bringLayerToFront);
  const sendLayerToBack = useEditorStore((state) => state.sendLayerToBack);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const selectedIds = useEditorStore((state) => state.selectedIds);

  const duplicate = () => {
    const count = duplicateSelected();
    if (count === 0) {
      notify.error("Could not duplicate", "The layer limit may have been reached.");
    }
  };

  const remove = () => {
    const count = deleteSelected();
    if (count === 0) {
      notify.info("Nothing deleted", "This layer is locked or no layers are selected.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" onClick={fitSelected} disabled={disabled}>
          <Maximize2 className="h-3 w-3" aria-hidden="true" />
          Fit to canvas
        </Button>
        <Button variant="outline" size="sm" onClick={centerSelected} disabled={disabled}>
          <Crosshair className="h-3 w-3" aria-hidden="true" />
          Center
        </Button>
      </div>
      <AlignmentGrid disabled={disabled} />
      {imageLayer ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              updateLayer(imageLayer.id, { flipX: !imageLayer.flipX }, { coalesceKey: "flip-x" })
            }
          >
            <FlipHorizontal2 className="h-3 w-3" aria-hidden="true" />
            Flip horizontal
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              updateLayer(imageLayer.id, { flipY: !imageLayer.flipY }, { coalesceKey: "flip-y" })
            }
          >
            <FlipVertical2 className="h-3 w-3" aria-hidden="true" />
            Flip vertical
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || selectedIds.length === 0}
          onClick={() => {
            selectedIds.forEach((id) => bringLayerToFront(id));
          }}
        >
          Bring to front
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || selectedIds.length === 0}
          onClick={() => {
            selectedIds.forEach((id) => sendLayerToBack(id));
          }}
        >
          Send to back
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <Button variant="secondary" size="sm" onClick={duplicate} disabled={disabled}>
          <Copy className="h-3 w-3" aria-hidden="true" />
          Duplicate
        </Button>
        <Button variant="danger" size="sm" onClick={remove} disabled={locked}>
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function TextProperties({
  layer,
  disabled,
  update,
}: {
  layer: TextLayer;
  disabled: boolean;
  update: (patch: LayerPatch, key?: string) => void;
}) {
  const family = FONT_FAMILIES.find((entry) => entry.id === layer.fontFamily) ?? FONT_FAMILIES[0];
  const weights = [...family.weights];
  return (
    <>
      <Section title="Text">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="text-content-input" className="field-label mb-0">
            Content
          </label>
          <span className="font-mono text-[9px] text-muted">{layer.text.length}/500</span>
        </div>
        <Textarea
          id="text-content-input"
          value={layer.text}
          maxLength={500}
          rows={3}
          disabled={disabled}
          onChange={(event) => update({ text: event.target.value }, `text:${layer.id}`)}
          placeholder="Write a headline…"
          className="text-[12px] leading-snug"
        />
        <p className="mt-1.5 text-[9px] text-muted">
          Line breaks are preserved. Outlines are drawn behind the fill.
        </p>
      </Section>

      <Section title="Style presets">
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.description}
              onClick={() => update(preset.patch, `text-style:${preset.id}:${layer.id}`)}
              className="rounded border border-line bg-ink-800 px-2 py-2 text-left transition-colors hover:border-gold/50 hover:bg-ink-750 disabled:opacity-40"
            >
              <span className="block font-display text-[13px] tracking-wide text-cream">
                {preset.name}
              </span>
              <span className="mt-0.5 block text-[8.5px] leading-tight text-muted">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="font-family" className="field-label">
              Font
            </label>
            <Select
              id="font-family"
              value={layer.fontFamily}
              disabled={disabled}
              onChange={(event) => {
                const nextId = event.target.value as FontFamilyId;
                const nextFamily =
                  FONT_FAMILIES.find((entry) => entry.id === nextId) ?? FONT_FAMILIES[0];
                const available: number[] = [...nextFamily.weights];
                const weight = available.includes(layer.fontWeight)
                  ? layer.fontWeight
                  : available[0];
                update(
                  { fontFamily: nextId, ...(weight ? { fontWeight: weight } : {}) },
                  `font-family:${layer.id}`,
                );
              }}
              className="h-8 text-[11px]"
            >
              {FONT_FAMILIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label} · {entry.kind}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="font-weight" className="field-label">
              Weight
            </label>
            <Select
              id="font-weight"
              value={String(layer.fontWeight)}
              disabled={disabled}
              onChange={(event) =>
                update({ fontWeight: Number(event.target.value) }, `font-weight:${layer.id}`)
              }
              className="h-8 text-[11px]"
            >
              {weights.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField
            label="Size"
            value={layer.fontSize}
            min={4}
            max={600}
            suffix="px"
            disabled={disabled}
            onValueChange={(fontSize) => update({ fontSize }, `font-size:${layer.id}`)}
          />
          <ColorField
            label="Color"
            value={layer.color}
            disabled={disabled}
            onValueChange={(color) => update({ color }, `text-color:${layer.id}`)}
          />
        </div>
        <div className="mt-2">
          <span className="field-label">Alignment</span>
          <div
            className="grid grid-cols-3 gap-1 rounded border border-line bg-ink-900/60 p-1"
            role="group"
            aria-label="Text alignment"
          >
            {(
              [
                { value: "left", label: "Align left", icon: AlignLeft },
                { value: "center", label: "Align center", icon: AlignCenter },
                { value: "right", label: "Align right", icon: AlignRight },
              ] as const
            ).map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-label={entry.label}
                  aria-pressed={layer.align === entry.value}
                  disabled={disabled}
                  onClick={() => update({ align: entry.value }, `align:${layer.id}`)}
                  className={cn(
                    "flex h-7 items-center justify-center rounded transition-colors",
                    layer.align === entry.value
                      ? "bg-ink-700 text-gold"
                      : "text-muted hover:bg-ink-800 hover:text-cream",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField
            label="Line height"
            value={layer.lineHeight}
            min={0.5}
            max={4}
            step={0.05}
            disabled={disabled}
            onValueChange={(lineHeight) => update({ lineHeight }, `line-height:${layer.id}`)}
          />
          <NumberField
            label="Letter spacing"
            value={layer.letterSpacing}
            min={-50}
            max={200}
            suffix="px"
            disabled={disabled}
            onValueChange={(letterSpacing) =>
              update({ letterSpacing }, `letter-spacing:${layer.id}`)
            }
          />
        </div>
      </Section>
    </>
  );
}

export function LayerProperties({ layer }: { layer: Layer }) {
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const toggleVisibility = useEditorStore((state) => state.toggleVisibility);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const locked = layer.locked;

  const update = (patch: LayerPatch, key?: string) => {
    updateLayer(layer.id, patch, key ? { coalesceKey: key } : undefined);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-ink-800 text-muted">
            {layer.type === "text" ? (
              <Type className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted">
              {layer.type === "text" ? "Text layer" : "Image layer"}
            </p>
            <h2 className="truncate font-display text-lg leading-tight tracking-wide text-cream">
              {layer.name}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Hint label={layer.visible ? "Hide layer" : "Show layer"}>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={layer.visible ? "Hide layer" : "Show layer"}
              aria-pressed={!layer.visible}
              onClick={() => toggleVisibility(layer.id)}
            >
              {layer.visible ? (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          </Hint>
          <Hint label={locked ? "Unlock layer" : "Lock layer"}>
            <Button
              size="icon-sm"
              variant={locked ? "gold" : "ghost"}
              aria-label={locked ? "Unlock layer" : "Lock layer"}
              aria-pressed={locked}
              onClick={() => toggleLock(layer.id)}
            >
              {locked ? (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          </Hint>
        </div>
      </div>

      {locked ? (
        <div className="px-4 pb-3">
          <InfoBanner tone="warning">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              This layer is locked. Unlock it to move, resize, or edit.
            </span>
          </InfoBanner>
        </div>
      ) : null}

      {layer.type === "image" ? (
        <Section title="Artwork">
          <AssetSummary asset={layer.asset} />
        </Section>
      ) : null}

      {layer.type === "text" ? (
        <TextProperties layer={layer} disabled={locked} update={update} />
      ) : null}

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X (center)"
            value={round(layer.x, 1)}
            min={-10_000}
            max={10_000}
            disabled={locked}
            onValueChange={(x) => update({ x }, `x:${layer.id}`)}
          />
          <NumberField
            label="Y (center)"
            value={round(layer.y, 1)}
            min={-10_000}
            max={10_000}
            disabled={locked}
            onValueChange={(y) => update({ y }, `y:${layer.id}`)}
          />
          <NumberField
            label="Width"
            value={round(layer.width, 1)}
            min={4}
            max={4000}
            disabled={locked}
            onValueChange={(width) => update({ width }, `width:${layer.id}`)}
          />
          <NumberField
            label={layer.type === "text" ? "Height (auto)" : "Height"}
            value={round(layer.height, 1)}
            min={4}
            max={4000}
            disabled={locked || layer.type === "text"}
            onValueChange={(height) => update({ height }, `height:${layer.id}`)}
          />
          <NumberField
            label="Rotation"
            value={round(normalizeRotation(layer.rotation), 1)}
            min={-180}
            max={180}
            suffix="°"
            disabled={locked}
            onValueChange={(rotation) =>
              update({ rotation: normalizeRotation(rotation) }, `rotation:${layer.id}`)
            }
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={locked}
              onClick={() => update({ rotation: 0 }, `rotation:${layer.id}`)}
              aria-label="Reset rotation to zero"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset rotation
            </Button>
          </div>
        </div>
        <div className="mt-2.5">
          <SliderField
            label="Opacity"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            disabled={locked}
            onValueChange={(value) => update({ opacity: value / 100 }, `opacity:${layer.id}`)}
            formatValue={(value) => `${value}%`}
          />
        </div>
        <div className="mt-3">
          <SelectionActions
            disabled={locked}
            locked={locked}
            {...(layer.type === "image" ? { imageLayer: layer } : {})}
          />
        </div>
      </Section>

      <Section title="Effects">
        <EffectsControls
          layer={layer}
          disabled={locked}
          onChange={(effects, key) => update({ effects }, key)}
        />
        <p className="mt-2 text-[9px] leading-snug text-muted">
          Effects render in both the preview and the full-resolution PNG. Outlines are generated at
          the layer's current size for crisp pixel-art edges.
        </p>
      </Section>

      <Section title="Layer">
        <label htmlFor="layer-name" className="field-label">
          Layer name
        </label>
        <Input
          id="layer-name"
          value={layer.name}
          maxLength={120}
          disabled={locked}
          onChange={(event) => update({ name: event.target.value }, `name:${layer.id}`)}
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={() => toggleVisibility(layer.id)}
          >
            {layer.visible ? "Hide layer" : "Show layer"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleLock(layer.id)}>
            {locked ? "Unlock layer" : "Lock layer"}
          </Button>
        </div>
      </Section>

      <Section title="Canvas">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>1280 × 720 · 16:9</span>
          <button
            type="button"
            className="font-semibold text-gold hover:underline"
            onClick={clearSelection}
          >
            Edit background
          </button>
        </div>
      </Section>
    </div>
  );
}

export function MultiSelectionPanel({ layers }: { layers: Layer[] }) {
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const fitSelected = useEditorStore((state) => state.fitSelected);
  const centerSelected = useEditorStore((state) => state.centerSelected);
  const hasLocked = layers.some((layer) => layer.locked);

  return (
    <div>
      <div className="px-4 pb-3 pt-4">
        <p className="text-[9px] uppercase tracking-[0.14em] text-muted">Multi-selection</p>
        <h2 className="font-display text-xl tracking-wide text-cream">
          {layers.length} layers selected
        </h2>
        <p className="mt-1 text-[10px] leading-snug text-muted">
          Drag the transformer on the canvas to move, rotate, or scale the selection. Edits apply to
          unlocked layers.
        </p>
        {hasLocked ? (
          <p className="mt-2 rounded border border-line bg-ink-800 px-2 py-1 text-[9px] text-muted">
            Some selected layers are locked and will be ignored.
          </p>
        ) : null}
      </div>
      <Section title="Arrange">
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={fitSelected}>
            <Maximize2 className="h-3 w-3" aria-hidden="true" /> Fit each
          </Button>
          <Button variant="outline" size="sm" onClick={centerSelected}>
            <Crosshair className="h-3 w-3" aria-hidden="true" /> Center each
          </Button>
        </div>
        <div className="mt-2">
          <AlignmentGrid disabled={false} />
        </div>
      </Section>
      <Section title="Actions">
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const count = duplicateSelected();
              if (count === 0) notify.error("Could not duplicate", "Layer limit reached.");
            }}
          >
            <Copy className="h-3 w-3" aria-hidden="true" /> Duplicate
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const count = deleteSelected();
              if (count === 0) notify.info("Nothing deleted", "Selected layers are locked.");
            }}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
          </Button>
        </div>
      </Section>
      <Section title="Selected">
        <ul className="space-y-1">
          {layers.map((layer) => (
            <li
              key={layer.id}
              className="flex items-center justify-between gap-2 rounded border border-line bg-ink-800/50 px-2 py-1.5 text-[10px]"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {layer.type === "text" ? (
                  <Type className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                )}
                <span className="truncate text-cream-dim">{layer.name}</span>
              </span>
              {layer.locked ? <Lock className="h-3 w-3 text-muted" aria-label="Locked" /> : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
