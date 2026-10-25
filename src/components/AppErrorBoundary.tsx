import { Component, type ErrorInfo, type ReactNode } from "react";
import { APP_CONFIG } from "@/config";
import { BrandMark } from "@/components/layout/BrandMark";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No user data or artwork URLs are logged.
    console.error("Isaac Thumbnail Studio crashed:", error.message, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 text-center">
        <BrandMark className="h-10 w-10" />
        <h1 className="mt-4 font-display text-2xl tracking-wide text-cream">
          The studio hit a snag
        </h1>
        <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-cream-dim">
          Your locally saved projects are still in this browser. Reload the page to reopen the
          editor. If this keeps happening, export your project JSON from a working session and check
          the browser console.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded border border-gold bg-gold px-4 py-2 text-[11px] font-semibold text-ink-950 hover:bg-[#e3ba5c] focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        >
          Reload {APP_CONFIG.name}
        </button>
      </div>
    );
  }
}
