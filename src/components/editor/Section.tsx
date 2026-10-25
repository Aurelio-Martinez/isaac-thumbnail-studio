import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-line px-4 py-3.5 first:border-t-0", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InfoBanner({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded border px-2.5 py-2 text-[10px] leading-snug",
        tone === "warning"
          ? "border-ember/35 bg-ember/5 text-cream-dim"
          : "border-line bg-ink-800/60 text-muted",
      )}
    >
      {children}
    </div>
  );
}
