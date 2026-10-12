import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          stationPreview: fileURLToPath(new URL('./nurse-station-preview.html', import.meta.url)),
        },
      },
      // Three.js is a single lazy-loaded module (~573 kB minified, ~145 kB gzip).
      // Keep the threshold just above that known chunk; the entry budget is regression-tested separately.
      chunkSizeWarningLimit: 600,
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern',
          additionalData: `@use "@/styles/breakpoints.scss" as *;\n@use "@/styles/dashboard.scss" as *;\n`,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,   // 监听 0.0.0.0，局域网可访问
      port: 5173,
      open: true,
    },
    preview: {
      port: 5173,
    },
  };
});
