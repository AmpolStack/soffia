import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const cloud = mode === 'cloud';

  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: single ? 'dist-single' : cloud ? 'dist-cloud' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: process.env.SOFFIA_DEV_API || 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
