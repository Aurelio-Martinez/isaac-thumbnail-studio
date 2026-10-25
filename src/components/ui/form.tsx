import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const TabsRoot = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("flex items-center gap-1 border-b border-line px-2", className)}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative -mb-px flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2 text-[11px] font-medium text-muted transition-colors hover:text-cream data-[state=active]:border-gold data-[state=active]:text-cream",
        "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1",
        className,
      )}
      {...props}
    />
  );
});

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, id, ...props },
  ref,
) {
  const input = <input ref={ref} id={id} className={cn("control", className)} {...props} />;
  if (!label && !hint) return input;
  return (
    <label className="block" htmlFor={id}>
      {label ? <span className="field-label">{label}</span> : null}
      {input}
      {hint ? <span className="mt-1 block text-[10px] text-muted">{hint}</span> : null}
    </label>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("control min-h-16 resize-y", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("control cursor-pointer pr-7", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  children,
  htmlFor,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[10px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}
