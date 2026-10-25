import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenuRoot = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-md border border-line-strong bg-ink-800 p-1 shadow-float animate-fade-in",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    hint?: string;
    icon?: React.ReactNode;
    destructive?: boolean;
  }
>(function DropdownMenuItem({ className, hint, icon, destructive, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs outline-none transition-colors",
        "data-[highlighted]:bg-ink-700 data-[highlighted]:text-cream",
        destructive ? "text-red-300 data-[highlighted]:bg-red-950/70" : "text-cream-dim",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      {icon ? <span className="text-muted">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {hint ? <span className="font-mono text-[9px] text-muted-dim">{hint}</span> : null}
    </DropdownMenuPrimitive.Item>
  );
});

export const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-line", className)}
      {...props}
    />
  );
});

export const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-muted", className)}
      {...props}
    />
  );
});

export const DropdownMenuCheckboxItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs text-cream-dim outline-none data-[highlighted]:bg-ink-700 data-[highlighted]:text-cream",
        className,
      )}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-3 w-3 text-gold" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
      <span className="ml-0.5 flex-1">{children}</span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuSubTrigger = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs text-cream-dim outline-none data-[highlighted]:bg-ink-700 data-[highlighted]:text-cream",
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronRight className="h-3 w-3 text-muted" aria-hidden="true" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});
export { DropdownMenuPrimitive };
