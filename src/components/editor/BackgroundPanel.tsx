import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { getCatalogAssets } from "@/features/assets/catalog";
import { AssetSourceError } from "@/features/assets/search";
import { displayThumbnail } from "@/features/assets/resolve";
import { saveUpload } from "@/features/assets/uploads";
import { toAssetRef, type Asset } from "@/features/assets/types";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import { SliderField, SwitchField } from "@/components/ui/controls";
import { Select } from "@/components/ui/form";
import { Section, InfoBanner } from "@/components/editor/Section";
import { notify } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function BackgroundPanel() {
  const background = useEditorStore((state) => state.scene.background);
  const setBackground = useEditorStore((state) => state.setBackground);
  const setBackgroundAsset = useEditorStore((state) => state.setBackgroundAsset);
  const setTransparentBackground = useEditorStore((state) => state.setTransparentBackground);
  const setSourcesOpen = useUiStore((state) => state.setSourcesOpen);
  const [backgrounds, setBackgrounds] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCatalogAssets("backgrounds")
      .then((assets) => {
        if (cancelled) return;
        setBackgrounds(assets);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof AssetSourceError
            ? error.message
            : "Wiki backgrounds could not be loaded.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await saveUpload(file);
      setBackgroundAsset(toAssetRef(asset));
      notify.success("Background uploaded", `${asset.name} is now the canvas background.`);
    } catch (error) {
      notify.error(
        "Could not use that image",
        error instanceof Error ? error.message : "Try another file.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <Section title="Canvas" className="pt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Logical size</span>
          <span className="font-mono text-cream-dim">1280 × 720</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-muted">Aspect ratio</span>
          <span className="font-mono text-cream-dim">16:9</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-muted">Export</span>
          <span className="text-cream-dim">PNG, 1:1 pixels</span>
        </div>
      </Section>

      <Section title="Background">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={cn(
              "group relative aspect-video overflow-hidden rounded border text-left transition-colors focus-visible:outline-2 focus-visible:outline-gold",
              background.mode === "transparent"
                ? "border-gold ring-1 ring-gold/50"
                : "border-line hover:border-line-strong",
            )}
            aria-pressed={background.mode === "transparent"}
            aria-label="Use a transparent background"
            onClick={setTransparentBackground}
          >
            <span className="checkerboard absolute inset-0" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-cream">
              Transparent
            </span>
          </button>
          <button
            type="button"
            className="flex aspect-video flex-col items-center justify-center gap-1 rounded border border-dashed border-line bg-ink-800/50 text-[9px] text-muted transition-colors hover:border-line-strong hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Upload a background image"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            Upload
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="sr-only"
          aria-label="Upload a background image"
          onChange={(event) => void upload(event.target.files?.[0])}
        />

        {background.mode === "transparent" ? (
          <div className="mt-3">
            <InfoBanner>
              <span className="flex items-start gap-1.5">
                <ImageIcon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                The canvas and exported PNG keep an alpha channel. This is useful for overlays and
                transparent compositions.
              </span>
            </InfoBanner>
          </div>
        ) : background.mode === "image" && background.asset ? (
          <div className="mt-3 space-y-2">
            <div className="rounded border border-line bg-ink-800 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-cream">
                    {background.asset.name}
                  </p>
                  <p className="truncate text-[10px] text-muted">{background.asset.sourceName}</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-muted-dim">
                    {background.asset.attribution}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 text-[10px] text-muted hover:text-ember"
                  onClick={setTransparentBackground}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="background-fit" className="field-label">
                  Fit
                </label>
                <Select
                  id="background-fit"
                  value={background.fit}
                  onChange={(event) =>
                    setBackground({ fit: event.target.value === "contain" ? "contain" : "cover" })
                  }
                  className="h-8 text-[11px]"
                >
                  <option value="cover">Cover (crop)</option>
                  <option value="contain">Contain (letterbox)</option>
                </Select>
              </div>
              <SliderField
                label="Image opacity"
                value={Math.round(background.opacity * 100)}
                min={0}
                max={100}
                onValueChange={(value) => setBackground({ opacity: value / 100 })}
                formatValue={(value) => `${value}%`}
              />
            </div>
            <div className="rounded border border-line bg-ink-800/40 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <SliderField
                  label="Dim overlay"
                  value={Math.round(background.dim * 100)}
                  min={0}
                  max={100}
                  onValueChange={(value) => setBackground({ dim: value / 100 })}
                  formatValue={(value) => `${value}%`}
                />
                <div className="flex items-end">
                  <SwitchField
                    label="Vignette"
                    checked={background.vignette}
                    onCheckedChange={(vignette) => setBackground({ vignette })}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : background.mode === "color" ? (
          <div className="mt-3 flex items-center justify-between rounded border border-line bg-ink-800 p-2">
            <span className="text-[10px] text-muted">Legacy solid color</span>
            <span
              className="h-5 w-9 rounded border border-line"
              style={{ backgroundColor: background.color }}
            />
          </div>
        ) : null}
      </Section>

      <Section
        title="Wiki backgrounds"
        action={
          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            className="text-[9px] font-semibold text-gold hover:underline"
          >
            Credits
          </button>
        }
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9px] leading-snug text-muted">
            Room screenshots from the verified wiki catalog.
          </p>
          <span className="text-[9px] text-muted">
            {loading ? "Loading" : `${backgrounds.length}`}
          </span>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="aspect-video animate-pulse rounded bg-ink-800" />
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded border border-ember/40 bg-ember/5 p-2.5">
            <p className="text-[10px] leading-snug text-cream-dim">{loadError}</p>
            <button
              type="button"
              className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-gold hover:underline"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : backgrounds.length === 0 ? (
          <p className="rounded border border-dashed border-line px-2.5 py-4 text-center text-[10px] text-muted">
            No wiki backgrounds are available. Upload an image instead.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {backgrounds.map((asset) => {
              const selected = background.asset?.id === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={cn(
                    "group relative aspect-video overflow-hidden rounded border transition-colors focus-visible:outline-2 focus-visible:outline-gold",
                    selected
                      ? "border-gold ring-1 ring-gold/50"
                      : "border-line hover:border-line-strong",
                  )}
                  onClick={() => setBackgroundAsset(toAssetRef(asset))}
                  aria-pressed={selected}
                  aria-label={`Use ${asset.name} as the background`}
                  title={asset.name}
                >
                  <img
                    src={displayThumbnail(asset.thumbnailUrl)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-left text-[8px] text-cream">
                    {asset.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[9px] leading-snug text-muted-dim">
          Game artwork © Nicalis / Edmund McMillen. Files are marked IN COPYRIGHT on the wiki.
          Confirm your usage before publishing.
        </p>
      </Section>

      <Section title="Fast start">
        <p className="text-[10px] leading-relaxed text-muted">
          Press <kbd className="rounded border border-line-strong px-1 font-mono text-[9px]">T</kbd>{" "}
          to add a headline, drag artwork from the library, or open the Presets tab to arrange what
          you already have.
        </p>
      </Section>
    </div>
  );
}
