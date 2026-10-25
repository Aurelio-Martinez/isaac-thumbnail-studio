import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Eye,
  FileJson,
  FilePlus2,
  FolderOpen,
  Keyboard,
  MoreHorizontal,
  Redo2,
  Save,
  Undo2,
  Upload,
  Users,
} from "lucide-react";
import { APP_CONFIG } from "@/config";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import type { ProjectSession } from "@/features/projects/useProjectSession";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/layout/BrandMark";

export function TopBar({ session }: { session: ProjectSession }) {
  const projectName = useEditorStore((state) => state.projectName);
  const setProjectName = useEditorStore((state) => state.setProjectName);
  const dirty = useEditorStore((state) => state.dirty);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const saveError = useEditorStore((state) => state.saveError);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setExportOpen = useUiStore((state) => state.setExportOpen);
  const setPreviewOpen = useUiStore((state) => state.setPreviewOpen);
  const setProjectManagerOpen = useUiStore((state) => state.setProjectManagerOpen);
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const setSourcesOpen = useUiStore((state) => state.setSourcesOpen);

  const importRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setClock] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await session.saveNow();
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saveError
    ? "Save failed"
    : dirty
      ? "Unsaved changes"
      : lastSavedAt
        ? `Saved ${formatRelativeTime(lastSavedAt)}`
        : "Not saved yet";

  return (
    <header className="relative z-30 flex h-[54px] shrink-0 items-center gap-2 border-b border-line bg-ink-900 px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark className="h-7 w-7 shrink-0" />
        <div className="hidden min-w-0 sm:block">
          <h1 className="truncate font-display text-[13px] uppercase leading-none tracking-[0.16em] text-cream">
            {APP_CONFIG.name}
          </h1>
          <p className="mt-1 text-[8px] uppercase tracking-[0.2em] text-muted">
            Local-first thumbnail studio
          </p>
        </div>
        <span className="hidden text-muted-dim lg:inline" aria-hidden="true">
          /
        </span>
        <label className="min-w-0 flex-1 lg:flex-none">
          <span className="sr-only">Project name</span>
          <input
            value={projectName}
            maxLength={80}
            onChange={(event) => setProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Untitled thumbnail"
            className="h-8 w-[min(210px,34vw)] rounded border border-transparent bg-transparent px-1.5 text-[12px] font-medium text-cream transition-colors hover:border-line focus:border-gold focus:bg-ink-850 focus:outline-none lg:w-[240px]"
          />
        </label>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <div className="hidden items-center gap-0.5 md:flex">
          <Hint label="Undo" shortcut="Ctrl Z">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Hint>
          <Hint label="Redo" shortcut="Ctrl Shift Z">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Hint>
          <div className="toolbar-divider" />
        </div>

        <Hint
          label={
            saveError
              ? saveError
              : "Save project in this browser (Ctrl S). Local projects are not synced."
          }
        >
          <Button
            size="sm"
            variant="ghost"
            aria-label={
              saveError
                ? "Save failed. Retry saving the project"
                : `${saveLabel}. Save project in this browser`
            }
            onClick={() => void save()}
            disabled={saving}
            className={saveError ? "text-ember" : undefined}
          >
            {saveError ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden whitespace-nowrap text-[10px] lg:inline">{saveLabel}</span>
          </Button>
        </Hint>

        <div className="toolbar-divider" />

        <Hint label="Preview the final composition" shortcut="P">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Preview final thumbnail"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Preview</span>
          </Button>
        </Hint>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setExportOpen(true)}
          aria-label="Export PNG"
          className="font-semibold"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="More project actions"
              className="ml-0.5"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>History</DropdownMenuLabel>
            <DropdownMenuItem
              icon={<Undo2 className="h-3.5 w-3.5" />}
              hint="Ctrl Z"
              disabled={!canUndo}
              onSelect={undo}
            >
              Undo
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Redo2 className="h-3.5 w-3.5" />}
              hint="Ctrl Shift Z"
              disabled={!canRedo}
              onSelect={redo}
            >
              Redo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuItem
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              hint="Ctrl O"
              onSelect={() => setProjectManagerOpen(true)}
            >
              Project manager…
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<FilePlus2 className="h-3.5 w-3.5" />}
              onSelect={() => void session.newProject()}
            >
              New blank project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<FileJson className="h-3.5 w-3.5" />}
              onSelect={() => void session.exportProjectJson()}
            >
              Save project as JSON…
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Upload className="h-3.5 w-3.5" />}
              onSelect={() => importRef.current?.click()}
            >
              Import project JSON…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Help</DropdownMenuLabel>
            <DropdownMenuItem
              icon={<Keyboard className="h-3.5 w-3.5" />}
              hint="?"
              onSelect={() => setShortcutsOpen(true)}
            >
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Users className="h-3.5 w-3.5" />}
              onSelect={() => setSourcesOpen(true)}
            >
              Artwork sources &amp; licenses
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[9px] leading-snug text-muted">
              {APP_CONFIG.name} v{APP_CONFIG.version}
              <br />
              Projects are stored in this browser only.
            </div>
          </DropdownMenuContent>
        </DropdownMenuRoot>

        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Import project JSON"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void session.importProjectFile(file);
            event.target.value = "";
          }}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        {saveLabel}
      </span>
    </header>
  );
}
