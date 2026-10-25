import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/store";
import { renderThumbnail, ExportError } from "@/features/export/render";
import { buildThumbnailFilename } from "@/features/export/download";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { notify } from "@/components/ui/toast";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; url: string; blob: Blob; width: number; height: number };

export function PreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scene = useEditorStore((state) => state.scene);
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ status: "loading" });
    renderThumbnail(scene)
      .then((rendered) => {
        if (cancelled) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(rendered.blob);
        urlRef.current = url;
        setState({
          status: "ready",
          url,
          blob: rendered.blob,
          width: rendered.width,
          height: rendered.height,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof ExportError
              ? error.message
              : error instanceof Error
                ? error.message
                : "The preview could not be rendered.",
        });
      });
    return () => {
      cancelled = true;
    };
    // Re-render only when the dialog opens or an explicit retry happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const download = () => {
    if (state.status !== "ready") return;
    const filename = buildThumbnailFilename();
    downloadBlob(state.blob, filename);
    notify.success("Preview downloaded", filename);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Preview"
      description="The final composition, rendered without editor handles or guides."
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setAttempt((value) => value + 1)}
            disabled={state.status === "loading"}
          >
            Refresh preview
          </Button>
          <Button variant="gold" size="md" onClick={download} disabled={state.status !== "ready"}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download PNG
          </Button>
        </>
      }
    >
      <div className="checkerboard flex min-h-[320px] items-center justify-center rounded-md border border-line p-3">
        {state.status === "loading" ? (
          <div className="flex flex-col items-center gap-2 text-muted" role="status">
            <Loader2 className="h-6 w-6 animate-spin-slow text-gold" aria-hidden="true" />
            <p className="text-[11px]">Rendering 1280 × 720 preview…</p>
          </div>
        ) : state.status === "error" ? (
          <div className="max-w-md text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-ember" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-cream">Preview unavailable</p>
            <p className="mt-1 text-[10px] leading-snug text-cream-dim">{state.message}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </Button>
          </div>
        ) : (
          <figure className="w-full">
            <img
              src={state.url}
              alt="Final thumbnail composition"
              className="mx-auto max-h-[62vh] w-auto max-w-full rounded border border-line bg-ink-900"
            />
            <figcaption className="mt-2 text-center font-mono text-[9.5px] text-muted">
              {state.width}×{state.height} · {formatBytes(state.blob.size)} PNG · no editor UI
            </figcaption>
          </figure>
        )}
      </div>
    </Modal>
  );
}
