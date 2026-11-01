/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_MODE?: 'local' | 'cloud';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_LOCAL_AUTH_NAME?: string;
  readonly VITE_LOCAL_AUTH_USERNAME?: string;
  readonly VITE_LOCAL_AUTH_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
