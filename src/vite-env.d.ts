/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_SHORT_NAME?: string;
  readonly VITE_ASSET_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
