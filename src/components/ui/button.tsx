import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "gold";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ember-deep text-cream border border-ember-deep hover:bg-ember-hover hover:border-ember-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  secondary: "bg-ink-750 text-cream border border-line hover:bg-ink-700 hover:border-line-strong",
  ghost:
    "bg-transparent text-cream-dim border border-transparent hover:bg-ink-750 hover:text-cream",
  outline:
    "bg-transparent text-cream-dim border border-line hover:border-line-strong hover:text-cream hover:bg-ink-800",
  danger: "bg-red-900/70 text-red-100 border border-red-800 hover:bg-red-800/80",
  gold: "bg-gold text-ink-950 border border-gold hover:bg-[#e3ba5c] font-semibold",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded-[5px]",
  md: "h-8 px-3 text-xs gap-2 rounded-[5px]",
  lg: "h-10 px-4 text-sm gap-2 rounded-[6px]",
  icon: "h-8 w-8 justify-center rounded-[5px]",
  "icon-sm": "h-7 w-7 justify-center rounded-[5px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-100",
        "disabled:opacity-40 disabled:pointer-events-none",
        "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
