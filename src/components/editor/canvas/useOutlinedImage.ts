import { useMemo } from "react";

interface OutlineResult {
  canvas: HTMLCanvasElement | null;
  pad: number;
}

const cache = new Map<string, HTMLCanvasElement>();

const MAX_OUTLINE_DIMENSION = 1400;
const MAX_CACHE = 16;

function buildOutline(
  source: HTMLImageElement,
  width: number,
  height: number,
  color: string,
  thickness: number,
  flipX: boolean,
  flipY: boolean,
  renderScale: number,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width * renderScale));
  const h = Math.max(1, Math.round(height * renderScale));
  const renderThickness = Math.max(1, thickness * renderScale);
  const pad = Math.ceil(renderThickness) + 2;
  const out = document.createElement("canvas");
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const octx = out.getContext("2d");
  const silhouette = document.createElement("canvas");
  silhouette.width = w;
  silhouette.height = h;
  const sctx = silhouette.getContext("2d");
  if (!octx || !sctx) return out;
  sctx.imageSmoothingEnabled = false;
  sctx.save();
  if (flipX || flipY) {
    sctx.translate(flipX ? w : 0, flipY ? h : 0);
    sctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  }
  sctx.drawImage(source, 0, 0, w, h);
  sctx.restore();
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, w, h);

  octx.imageSmoothingEnabled = false;
  const steps = 16;
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    octx.drawImage(
      silhouette,
      pad + Math.cos(angle) * renderThickness,
      pad + Math.sin(angle) * renderThickness,
    );
  }
  octx.save();
  octx.translate(pad, pad);
  if (flipX || flipY) {
    octx.translate(flipX ? w : 0, flipY ? h : 0);
    octx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  }
  octx.drawImage(source, 0, 0, w, h);
  octx.restore();
  return out;
}

/**
 * Builds (and caches) an alpha silhouette outline at the layer's rendered size.
 * The work is done synchronously so preview and export can never race a pending
 * effect update. Very large layers are rendered at a capped resolution, keeping
 * memory bounded while preserving the visual outline thickness.
 */
export function useOutlinedImage(
  source: HTMLImageElement | null,
  width: number,
  height: number,
  color: string,
  thickness: number,
  flipX: boolean,
  flipY: boolean,
  enabled: boolean,
): OutlineResult {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const renderScale = Math.min(1, MAX_OUTLINE_DIMENSION / Math.max(safeWidth, safeHeight));
  const renderThickness = Math.max(1, Math.max(1, thickness) * renderScale);
  const pad = (Math.ceil(renderThickness) + 2) / renderScale;
  const key =
    enabled && source
      ? `${source.src}|${Math.round(safeWidth)}|${Math.round(safeHeight)}|${color}|${Math.round(thickness * 10)}|${flipX ? 1 : 0}|${flipY ? 1 : 0}`
      : "";

  const canvas = useMemo(() => {
    if (!enabled || !source) return null;
    const cached = cache.get(key);
    if (cached) return cached;
    try {
      const next = buildOutline(
        source,
        safeWidth,
        safeHeight,
        color,
        Math.max(1, thickness),
        flipX,
        flipY,
        renderScale,
      );
      cache.set(key, next);
      while (cache.size > MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        cache.delete(oldest);
      }
      return next;
    } catch {
      return null;
    }
  }, [key, enabled, source, safeWidth, safeHeight, color, thickness, flipX, flipY, renderScale]);

  return { canvas, pad };
}
