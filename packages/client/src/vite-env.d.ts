/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production API base URL, baked in at build time (e.g. for a GitHub Pages deploy). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
