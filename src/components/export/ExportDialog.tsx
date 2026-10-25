import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ImageDown, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/store";
import { buildThumbnailFilename } from "@/features/export/download";
import { collectImageRequirements, type ImageIssue } from "@/features/export/preflight";
import { ExportError, renderThumbnail } from "@/features/export/render";
import { retryImage } from "@/features/assets/imageRegistry";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { notify } from "@/components/ui/toast";

type ExportStatus = "idle" | "checking" | "rendering" | "done" | "error";

interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  filename: string;
  previewUrl: string;
}

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scene = useEditorStore((state) => state.scene);
  const projectName = useEditorStore((state) => state.projectName);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<{
    message: string;
    code: string;
    issues: ImageIssue[];
  } | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const filename = useMemo(() => buildThumbnailFilename(), []);
  const busy = status === "checking" || status === "rendering";
  const copyrightedCount = useMemo(
    () =>
      scene.layers.filter(
        (layer) => layer.type === "image" && layer.asset.licenseStatus === "copyrighted",
      ).length,
    [scene.layers],
  );
  const visibleLayers = scene.layers.filter((layer) => layer.visible).length;

  const revokeResult = () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
  };

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setError(null);
      setProgress({ loaded: 0, total: 0 });
      setResult((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
      revokeResult();
    }
  }, [open]);

  useEffect(() => () => revokeResult(), []);

  const runExport = async () => {
    setError(null);
    setStatus("checking");
    setProgress({ loaded: 0, total: 0 });
    try {
      const rendered = await renderThumbnail(scene, {
        onProgress: (loaded, total) => {
          setProgress({ loaded, total });
          setStatus(loaded >= total ? "rendering" : "checking");
        },
      });
      const output: ExportResult = {
        blob: rendered.blob,
        width: rendered.width,
        height: rendered.height,
        filename,
        previewUrl: URL.createObjectURL(rendered.blob),
      };
      revokeResult();
      resultUrlRef.current = output.previewUrl;
      setResult(output);
      downloadBlob(rendered.blob, filename);
      setStatus("done");
      notify.success(
        "PNG exported",
        `${rendered.width}×${rendered.height} · ${formatBytes(rendered.blob.size)} · ${filename}`,
      );
    } catch (caught) {
      if (caught instanceof ExportError) {
        setError({ message: caught.message, code: caught.code, issues: caught.issues });
      } else {
        setError({
          message: caught instanceof Error ? caught.message : "The export failed unexpectedly.",
          code: "render_failed",
          issues: [],
        });
      }
      setStatus("error");
    }
  };

  const retryFailedImages = async () => {
    if (!error) return;
    const requirements = collectImageRequirements(scene);
    const keys = new Set(error.issues.map((issue) => issue.key));
    const sources = [
      ...new Set(
        requirements
          .filter((requirement) => keys.has(requirement.key) && requirement.src)
          .map((requirement) => requirement.src),
      ),
    ];
    await Promise.all(sources.map((src) => retryImage(src)));
    await runExport();
  };

  const removeProblemLayers = () => {
    if (!error) return;
    const requirements = collectImageRequirements(scene);
    const keys = new Set(error.issues.map((issue) => issue.key));
    const targets = requirements.filter((requirement) => keys.has(requirement.key));
    const editor = useEditorStore.getState();
    let removed = 0;
    for (const target of targets) {
      if (target.isBackground) {
        editor.clearBackgroundImage();
        removed += 1;
      } else {
        if (editor.deleteLayer(target.layerId)) removed += 1;
      }
    }
    setError(null);
    setStatus("idle");
    if (removed > 0) {
      notify.info(
        "Problem layers removed",
        "Locked layers were left alone. Choose Export PNG to try again.",
      );
    } else {
      notify.error(
        "Nothing could be removed",
        "The affected layers are locked. Unlock them in the Layers panel.",
      );
    }
  };

  const requestClose = (next: boolean) => {
    if (!next && busy) return;
    if (!next) {
      revokeResult();
      setResult(null);
    }
    onOpenChange(next);
  };

  const downloadAgain = () => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
    notify.success("PNG downloaded again", result.filename);
  };

  const statusLabel =
    status === "checking"
      ? progress.total > 0
        ? `Checking artwork ${progress.loaded}/${progress.total}…`
        : "Checking artwork…"
      : status === "rendering"
        ? "Rendering 1280 × 720 PNG…"
        : "";

  return (
    <Modal
      open={open}
      onOpenChange={requestClose}
      title="Export thumbnail"
      description="A deterministic, full-resolution PNG rendered from the scene data — never a screenshot."
      size="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => requestClose(false)} disabled={busy}>
            Close
          </Button>
          {status === "done" ? (
            <Button variant="secondary" size="md" onClick={downloadAgain}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download again
            </Button>
          ) : (
            <Button variant="gold" size="md" onClick={() => void runExport()} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin-slow" aria-hidden="true" />
              ) : (
                <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {busy ? "Rendering…" : "Export PNG"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded border border-line bg-ink-800/70 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Output</p>
            <p className="font-mono text-[12px] text-cream">1280 × 720 · PNG</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">File</p>
            <p className="font-mono text-[10px] text-cream-dim">{filename}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-line px-2.5 py-2">
            <p className="text-[10px] text-muted">Visible layers</p>
            <p className="font-mono text-lg text-cream">{visibleLayers}</p>
          </div>
          <div className="rounded border border-line px-2.5 py-2">
            <p className="text-[10px] text-muted">Project</p>
            <p className="truncate text-[11px] text-cream-dim">{projectName || "Untitled"}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded border border-line bg-ink-800/50 px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Background</span>
          <span className="text-[11px] text-cream-dim">
            {scene.background.mode === "transparent"
              ? "Transparent PNG"
              : scene.background.mode === "image"
                ? (scene.background.asset?.name ?? "Wiki background")
                : "Solid color"}
          </span>
        </div>

        {copyrightedCount > 0 ? (
          <div className="rounded border border-gold/30 bg-gold/5 px-3 py-2 text-[10px] leading-snug text-cream-dim">
            This composition includes {copyrightedCount} wiki artwork layer
            {copyrightedCount === 1 ? "" : "s"}. Game art is © Nicalis / Edmund McMillen and is
            marked IN COPYRIGHT. Credit each source page in your video description and confirm your
            usage is appropriate.
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-ember/40 bg-ember/5 p-3">
            <p className="flex items-start gap-2 text-[11px] font-medium text-cream">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember" aria-hidden="true" />
              {error.code === "image_issues"
                ? "Some artwork is missing or unavailable"
                : error.code === "tainted"
                  ? "The browser blocked the export"
                  : error.code === "not_ready"
                    ? "The canvas is still warming up"
                    : "The PNG could not be rendered"}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-cream-dim">{error.message}</p>
            {error.issues.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {error.issues.slice(0, 6).map((issue) => (
                  <li
                    key={issue.key}
                    className="rounded border border-line bg-ink-900/60 px-2 py-1.5 text-[9.5px] leading-snug"
                  >
                    <span className="font-semibold text-cream-dim">{issue.name}</span>
                    <span className="text-muted"> — {issue.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void retryFailedImages()}
                disabled={busy}
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Retry images
              </Button>
              {error.issues.length > 0 ? (
                <Button variant="outline" size="sm" onClick={removeProblemLayers} disabled={busy}>
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Remove problem layers
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-[9px] leading-snug text-muted">
              If the artwork proxy is offline, remote wiki images cannot be baked into a PNG. Upload
              the image locally or switch the artwork source to wiki.gg, then retry.
            </p>
          </div>
        ) : null}

        {status === "done" && result ? (
          <div className="rounded border border-emerald-800/50 bg-emerald-950/20 p-3">
            <p className="text-[11px] font-semibold text-emerald-300">Export complete</p>
            <div className="mt-2 overflow-hidden rounded border border-line bg-ink-950">
              <img
                src={result.previewUrl}
                alt="Rendered thumbnail preview"
                className="h-auto w-full [image-rendering:pixelated]"
              />
            </div>
            <p className="mt-2 font-mono text-[9.5px] text-muted">
              {result.width}×{result.height} · {formatBytes(result.blob.size)} · {result.filename}
            </p>
          </div>
        ) : null}

        {busy ? (
          <div
            className="rounded border border-line bg-ink-800/60 p-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-[11px] text-cream-dim">
              <Loader2 className="h-3.5 w-3.5 animate-spin-slow text-gold" aria-hidden="true" />
              {statusLabel}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full bg-gold transition-all duration-200"
                style={{
                  width:
                    progress.total > 0
                      ? `${Math.round((progress.loaded / progress.total) * 100)}%`
                      : "15%",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
