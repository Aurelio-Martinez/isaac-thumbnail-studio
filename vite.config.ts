import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { assetProxyMiddleware } from "./shared/assetProxy";

function installAssetProxy(middlewares: {
  use: (
    path: string,
    handler: (
      req: Parameters<typeof assetProxyMiddleware>[0],
      res: Parameters<typeof assetProxyMiddleware>[1],
    ) => void,
  ) => void;
}) {
  middlewares.use("/api/asset-proxy", (req, res) => {
    assetProxyMiddleware(req, res).catch((error: unknown) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
      }
      res.end(
        JSON.stringify({
          error: "proxy_failure",
          message: error instanceof Error ? error.message : "Unexpected proxy error",
        }),
      );
    });
  });
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "isaac-asset-proxy",
      configureServer(server) {
        installAssetProxy(server.middlewares);
      },
      configurePreviewServer(server) {
        installAssetProxy(server.middlewares);
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          konva: ["konva", "react-konva"],
          schema: ["zod"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    css: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
