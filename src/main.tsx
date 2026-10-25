import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/anton/latin-400.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/bangers/latin-400.css";
import "@fontsource/press-start-2p/latin-400.css";
import "./index.css";
import App from "./App";
import { APP_CONFIG } from "./config";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { releaseAllUploadUrls } from "./features/assets/uploads";

document.title = APP_CONFIG.name;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element is missing.");

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

window.addEventListener("pagehide", releaseAllUploadUrls);
