import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

interface HintProps {
  label: ReactNode;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  shortcut?: string;
  disabled?: boolean;
}

export function Hint({
  label,
  children,
  side = "bottom",
  align = "center",
  shortcut,
  disabled,
}: HintProps) {
  if (disabled || !label) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className="tool-tip animate-fade-in"
        >
          <span className="flex items-center gap-2">
            <span>{label}</span>
            {shortcut ? (
              <kbd className="rounded border border-line-strong bg-ink-900 px-1 py-0.5 font-mono text-[9px] text-muted">
                {shortcut}
              </kbd>
            ) : null}
          </span>
          <TooltipPrimitive.Arrow className="fill-[#1b1b22]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded border border-line-strong bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-cream-dim",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
