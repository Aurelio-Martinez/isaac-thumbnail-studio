import { useState } from "react";
import { Image as ImageIcon, Plus, Star, AlertTriangle, Loader2 } from "lucide-react";
import type { Asset, AssetRef } from "@/features/assets/types";
import { ASSET_CATEGORY_META } from "@/features/assets/types";
import { displayThumbnail } from "@/features/assets/resolve";
import { cn } from "@/lib/utils";

export type CardAsset = Asset | AssetRef;

export function assetDragPayload(asset: CardAsset): string {
  return JSON.stringify({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    imageUrl: asset.imageUrl,
    thumbnailUrl: asset.thumbnailUrl,
    sourceUrl: asset.sourceUrl,
    sourceName: asset.sourceName,
    licenseStatus: asset.licenseStatus,
    attribution: asset.attribution,
    width: asset.width,
    height: asset.height,
    providerId: asset.providerId,
    ...(asset.uploadId ? { uploadId: asset.uploadId } : {}),
  });
}

interface AssetCardProps {
  asset: CardAsset;
  onAdd: (asset: CardAsset) => void;
  onToggleFavorite: (asset: CardAsset) => void;
  isFavorite: boolean;
  onSetBackground?: (asset: CardAsset) => void;
}

export function AssetCard({
  asset,
  onAdd,
  onToggleFavorite,
  isFavorite,
  onSetBackground,
}: AssetCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const baseThumb = displayThumbnail(asset.thumbnailUrl || asset.imageUrl);
  const src =
    attempt > 0 && baseThumb
      ? `${baseThumb}${baseThumb.includes("?") ? "&" : "?"}retry=${attempt}`
      : baseThumb;
  const category = ASSET_CATEGORY_META[asset.category];

  return (
    <div
      className="group relative min-w-0 rounded-md border border-line bg-ink-800/70 p-1 transition-colors hover:border-line-strong hover:bg-ink-750"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-isaac-asset", assetDragPayload(asset));
        event.dataTransfer.setData("text/plain", asset.name);
      }}
    >
      <button
        type="button"
        onClick={() => onAdd(asset)}
        aria-busy={!loaded && !failed}
        className="block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-gold"
      >
        <span className="sr-only">Add </span>
        <span className="relative block aspect-square overflow-hidden rounded-[4px] checkerboard">
          {!loaded && !failed ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin-slow text-muted-dim" aria-hidden="true" />
            </span>
          ) : null}
          {failed ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center">
              <AlertTriangle className="h-4 w-4 text-ember" aria-hidden="true" />
              <span className="text-[9px] leading-tight text-muted">Unavailable</span>
            </span>
          ) : (
            <img
              key={attempt}
              src={src}
              alt=""
              loading="lazy"
              draggable={false}
              className={cn(
                "h-full w-full object-contain p-1 [image-rendering:pixelated] transition-opacity",
                loaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => {
                setLoaded(true);
                setFailed(false);
              }}
              onError={() => {
                setLoaded(false);
                setFailed(true);
              }}
            />
          )}
          {asset.licenseStatus === "copyrighted" ? (
            <span
              className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-cream-dim"
              title="Copyrighted game artwork. Check the source page before publishing."
              aria-hidden="true"
            >
              ©
            </span>
          ) : null}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-ink-950">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
        </span>
        <span className="mt-1.5 block truncate px-0.5 text-[11px] font-medium text-cream">
          {asset.name}
        </span>
        <span className="mb-0.5 block truncate px-0.5 text-[9px] uppercase tracking-[0.08em] text-muted">
          {category.label} · {asset.width}×{asset.height}
        </span>
        <span className="sr-only"> to canvas</span>
      </button>
      {asset.licenseStatus === "copyrighted" ? (
        <span className="sr-only">
          Copyrighted game artwork. Check the source page before publishing.
        </span>
      ) : null}

      {failed ? (
        <div className="mt-1 flex items-center justify-between gap-1 rounded bg-ink-900/70 px-1.5 py-1">
          <span className="text-[8px] text-muted">Preview failed</span>
          <button
            type="button"
            aria-label={`Retry loading ${asset.name}`}
            className="rounded border border-line-strong px-1.5 py-0.5 text-[8px] font-semibold text-gold hover:border-gold focus-visible:outline-2 focus-visible:outline-gold"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={isFavorite ? `Remove ${asset.name} from favorites` : `Favorite ${asset.name}`}
        aria-pressed={isFavorite}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/65 text-cream transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-gold",
          isFavorite ? "text-gold" : "text-cream/70",
        )}
        onClick={() => onToggleFavorite(asset)}
      >
        <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-gold")} aria-hidden="true" />
      </button>

      {onSetBackground ? (
        <button
          type="button"
          aria-label={`Use ${asset.name} as the background`}
          title="Use as background"
          className="absolute bottom-10 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/65 text-cream/80 opacity-0 transition-opacity hover:bg-black/85 hover:text-gold focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => onSetBackground(asset)}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
