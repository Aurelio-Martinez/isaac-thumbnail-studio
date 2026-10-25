import { Modal } from "@/components/ui/modal";
import { SHORTCUTS } from "@/features/editor/useEditorShortcuts";
import { Keycap } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description="Most shortcuts pause while you are typing in a field, so they never eat your text. Save still works."
      size="md"
      footer={
        <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <ul className="divide-y divide-line">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-center justify-between gap-4 py-2">
            <span className="text-[11px] text-cream-dim">{shortcut.action}</span>
            <span className="flex flex-wrap justify-end gap-1">
              {shortcut.keys.split(" / ").map((key) => (
                <Keycap key={key}>{key}</Keycap>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded border border-line bg-ink-800/60 p-3 text-[10px] leading-relaxed text-muted">
        <p className="font-medium text-cream-dim">Canvas tips</p>
        <p className="mt-1">
          Drag artwork from the library straight onto the canvas. Hold Shift while dragging the
          transformer to keep proportions. Click empty canvas to edit the background. Use the Layers
          panel to reorder, lock, or hide elements without the mouse.
        </p>
      </div>
    </Modal>
  );
}
