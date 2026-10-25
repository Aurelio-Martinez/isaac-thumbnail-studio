import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("min-width: 1280px"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (!URL.createObjectURL) {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: () => "blob:mock",
  });
}
if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: () => {},
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
