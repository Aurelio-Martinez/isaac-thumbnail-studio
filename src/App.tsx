import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { APP_CONFIG } from "@/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { AssetLibrary } from "@/components/library/AssetLibrary";
import { CanvasStage } from "@/components/editor/CanvasStage";
import { Inspector } from "@/components/editor/Inspector";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBar } from "@/components/layout/MobileBar";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PreviewDialog } from "@/components/export/PreviewDialog";
import { ProjectManagerDialog } from "@/components/projects/ProjectManagerDialog";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { SourcesDialog } from "@/components/editor/SourcesDialog";
import { useProjectSession } from "@/features/projects/useProjectSession";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function BootScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-ink-950 px-6 text-center">
      <BrandMark className="h-12 w-12" />
      <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.16em] text-cream">
        {APP_CONFIG.name}
      </h1>
      <p className="mt-1 text-[11px] text-muted">{APP_CONFIG.tagline}</p>
      <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden="true" />
        Loading artwork and fonts
      </div>
      <p className="mt-6 max-w-xs text-[10px] leading-relaxed text-muted-dim">
        No account, no upload, no AI generation. Your project stays in this browser.
      </p>
    </div>
  );
}

export default function App() {
  const session = useProjectSession();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const mobilePanel = useUiStore((state) => state.mobilePanel);
  const setMobilePanel = useUiStore((state) => state.setMobilePanel);
  const projectManagerOpen = useUiStore((state) => state.projectManagerOpen);
  const setProjectManagerOpen = useUiStore((state) => state.setProjectManagerOpen);
  const shortcutsOpen = useUiStore((state) => state.shortcutsOpen);
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const sourcesOpen = useUiStore((state) => state.sourcesOpen);
  const setSourcesOpen = useUiStore((state) => state.setSourcesOpen);
  const exportOpen = useUiStore((state) => state.exportOpen);
  const setExportOpen = useUiStore((state) => state.setExportOpen);
  const previewOpen = useUiStore((state) => state.previewOpen);
  const setPreviewOpen = useUiStore((state) => state.setPreviewOpen);
  const showAssetPanel = useMediaQuery("(min-width: 1024px)");
  const showInspector = useMediaQuery("(min-width: 1280px)");
  const projectName = useEditorStore((state) => state.projectName);

  useEffect(() => {
    if (showAssetPanel && mobilePanel === "assets") setMobilePanel(null);
    if (showInspector && mobilePanel === "inspector") setMobilePanel(null);
  }, [mobilePanel, setMobilePanel, showAssetPanel, showInspector]);

  useEffect(() => {
    const title = projectName.trim();
    document.title = title ? `${title} — ${APP_CONFIG.name}` : APP_CONFIG.name;
  }, [projectName]);

  useEditorShortcuts({
    onSave: () => {
      void session.saveNow();
    },
  });

  if (!session.ready) return <BootScreen />;

  const messages = [session.bootError, ...session.warnings].filter(Boolean) as string[];

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={100}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-ink-950">
        <TopBar session={session} />

        {messages.length > 0 && !bannerDismissed ? (
          <div
            role="status"
            className="flex shrink-0 items-start gap-2 border-b border-gold/30 bg-gold/5 px-3 py-2"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {messages.slice(0, 2).map((message) => (
                <p key={message} className="text-[10px] leading-snug text-cream-dim">
                  {message}
                </p>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setProjectManagerOpen(true)}
              className="shrink-0"
            >
              Projects
            </Button>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setBannerDismissed(true)}
              className="rounded p-1 text-muted hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          {showAssetPanel ? <AssetLibrary className="hidden w-[300px] shrink-0 lg:flex" /> : null}
          <main className="flex min-w-0 flex-1 flex-col" aria-label="Thumbnail editor">
            <CanvasStage />
          </main>
          {showInspector ? (
            <aside
              className="hidden w-[340px] shrink-0 border-l border-line bg-ink-850 xl:block"
              aria-label="Inspector"
            >
              <Inspector />
            </aside>
          ) : null}
        </div>

        <MobileBar />

        <Sheet
          open={mobilePanel === "assets"}
          onOpenChange={(open) => setMobilePanel(open ? "assets" : null)}
          title="Artwork"
          side="left"
        >
          <AssetLibrary className="border-r-0" />
        </Sheet>

        <Sheet
          open={mobilePanel === "inspector"}
          onOpenChange={(open) => setMobilePanel(open ? "inspector" : null)}
          title="Inspector"
          side="right"
        >
          <Inspector />
        </Sheet>

        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />
        <ProjectManagerDialog
          open={projectManagerOpen}
          onOpenChange={setProjectManagerOpen}
          session={session}
        />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <SourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
