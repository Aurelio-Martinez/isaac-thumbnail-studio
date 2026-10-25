import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side: "left" | "right" | "bottom";
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, side, children }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px] animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border-line-strong bg-ink-850 shadow-panel animate-rise",
            side === "left" && "inset-y-0 left-0 w-[min(340px,92vw)] border-r",
            side === "right" && "inset-y-0 right-0 w-[min(380px,94vw)] border-l",
            side === "bottom" && "inset-x-0 bottom-0 h-[min(82vh,720px)] rounded-t-xl border-t",
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <DialogPrimitive.Title className="font-display text-lg tracking-wide text-cream">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {title} panel
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close panel"
              className="rounded p-1 text-muted transition-colors hover:bg-ink-700 hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
