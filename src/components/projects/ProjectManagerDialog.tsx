import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/store";
import type { ProjectSession } from "@/features/projects/useProjectSession";
import { PROJECT_LIMIT, readProjectLibrary, isStorageAvailable } from "@/features/projects/storage";
import type { ProjectFile } from "@/features/editor/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import { notify } from "@/components/ui/toast";

type BusyAction = "new-blank" | "import" | "export" | null;

export function ProjectManagerDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ProjectSession;
}) {
  const currentId = useEditorStore((state) => state.projectId);
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

  const reload = () => {
    const library = readProjectLibrary();
    setProjects(library.projects);
    setWarnings(library.warnings);
  };

  useEffect(() => {
    if (open) {
      reload();
      setConfirmDelete(null);
      setEditingId(null);
    }
  }, [open, session.libraryVersion]);

  const handleNew = async () => {
    setBusy("new-blank");
    try {
      await session.newProject();
      reload();
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async (id: string) => {
    setBusyRow(id);
    try {
      await session.openProject(id);
      reload();
      onOpenChange(false);
    } finally {
      setBusyRow(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyRow(id);
    try {
      await session.duplicateProject(id);
      reload();
      onOpenChange(false);
    } finally {
      setBusyRow(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyRow(id);
    try {
      await session.deleteProject(id);
      setConfirmDelete(null);
      reload();
    } finally {
      setBusyRow(null);
    }
  };

  const startRename = (project: ProjectFile) => {
    setEditingId(project.id);
    setDraftName(project.name);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (!name) {
      notify.error("Name cannot be empty");
      return;
    }
    await session.renameProject(editingId, name);
    setEditingId(null);
    reload();
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setBusy("import");
    try {
      await session.importProjectFile(file);
      reload();
      onOpenChange(false);
    } finally {
      setBusy(null);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      await session.exportProjectJson();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Projects"
      description="Local-first projects. Nothing leaves this browser unless you export a project file."
      size="lg"
      footer={
        <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleNew()}
            disabled={busy !== null}
          >
            {busy === "new-blank" ? (
              <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
            ) : (
              <FilePlus2 className="h-3 w-3" aria-hidden="true" />
            )}
            New blank
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === "import" ? (
              <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
            ) : (
              <Upload className="h-3 w-3" aria-hidden="true" />
            )}
            Import JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={busy !== null}
          >
            {busy === "export" ? (
              <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
            ) : (
              <FileJson className="h-3 w-3" aria-hidden="true" />
            )}
            Save current as JSON
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import project JSON"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </div>

        {!isStorageAvailable() ? (
          <div className="rounded border border-ember/40 bg-ember/5 px-3 py-2 text-[10px] text-cream-dim">
            Browser storage is unavailable in this context. Export project JSON to keep your work.
          </div>
        ) : null}
        {warnings.map((warning) => (
          <div
            key={warning}
            className="rounded border border-gold/30 bg-gold/5 px-3 py-2 text-[10px] text-cream-dim"
          >
            {warning}
          </div>
        ))}

        <div className="overflow-hidden rounded border border-line">
          {projects.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <FolderOpen className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium text-cream">No saved projects yet</p>
              <p className="mt-1 text-[10px] text-muted">
                Start with a blank transparent canvas and pick wiki artwork.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {projects.map((project) => {
                const current = project.id === currentId;
                const rowBusy = busyRow === project.id;
                return (
                  <li key={project.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-10 w-14 shrink-0 items-center justify-center rounded border bg-ink-900",
                          current ? "border-gold/60" : "border-line",
                        )}
                        aria-hidden="true"
                      >
                        <span className="grid grid-cols-3 gap-0.5">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <span
                              key={index}
                              className={cn(
                                "h-1.5 w-1.5 rounded-[1px]",
                                index === 0 ? "bg-ember" : "bg-ink-650",
                              )}
                            />
                          ))}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        {editingId === project.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void commitRename();
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              autoFocus
                              value={draftName}
                              maxLength={80}
                              aria-label="Project name"
                              onChange={(event) => setDraftName(event.target.value)}
                              onBlur={() => void commitRename()}
                              className="control h-7 flex-1 text-[11px]"
                            />
                            <Button type="submit" size="sm" variant="secondary">
                              Save
                            </Button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[11.5px] font-semibold text-cream">
                              {project.name}
                            </p>
                            {current ? (
                              <span className="rounded border border-gold/50 bg-gold/10 px-1 py-0.5 text-[8px] uppercase tracking-wide text-gold">
                                Open
                              </span>
                            ) : null}
                          </div>
                        )}
                        <p className="mt-0.5 text-[9px] text-muted">
                          Updated {formatRelativeTime(project.updatedAt)} ·{" "}
                          {project.scene.layers.length} layers · 1280×720
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Button
                            size="sm"
                            variant={current ? "outline" : "secondary"}
                            disabled={rowBusy || current}
                            onClick={() => void handleOpen(project.id)}
                          >
                            {rowBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
                            ) : (
                              <FolderOpen className="h-3 w-3" aria-hidden="true" />
                            )}
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Rename ${project.name}`}
                            onClick={() => startRename(project)}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Duplicate ${project.name}`}
                            disabled={rowBusy}
                            onClick={() => void handleDuplicate(project.id)}
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            Duplicate
                          </Button>
                          {confirmDelete === project.id ? (
                            <span className="flex items-center gap-1 rounded border border-ember/40 bg-ember/5 px-1.5 py-0.5">
                              <span className="text-[9px] text-cream-dim">Delete permanently?</span>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={rowBusy}
                                onClick={() => void handleDelete(project.id)}
                              >
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Delete ${project.name}`}
                              disabled={rowBusy}
                              onClick={() => setConfirmDelete(project.id)}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded border border-line bg-ink-800/50 px-3 py-2 text-[9.5px] leading-relaxed text-muted">
          <p className="flex items-center gap-1.5 font-medium text-cream-dim">
            <Download className="h-3 w-3" aria-hidden="true" />
            Projects belong to this browser
          </p>
          <p className="mt-1">
            Autosave runs after each edit. Up to {PROJECT_LIMIT} projects are kept in local browser
            storage. Export a project JSON to move it to another device, and export the PNG to
            publish. There is no cloud sync or account.
          </p>
        </div>
      </div>
    </Modal>
  );
}
