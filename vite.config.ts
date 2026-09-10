import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

function resolveBackendOrigin(deviceHost?: string): string {
  const raw = deviceHost?.trim() || 'http://192.168.96.104';
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const url = new URL(normalized.replace(/\/swp\/?$/i, ''));
    url.port = '9700';
    return url.origin;
  }
  catch {
    return 'http://192.168.96.104:9700';
  }
}

function resolveFileOrigin(deviceHost?: string): string {
  try {
    const backend = new URL(resolveBackendOrigin(deviceHost));
    backend.port = '9704';
    return backend.origin;
  }
  catch {
    return 'http://192.168.96.104:9704';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = resolveBackendOrigin(env.VITE_DEVICE_HOST);
  const fileTarget = resolveFileOrigin(env.VITE_DEVICE_HOST);
  const dbAdapterTarget = env.VITE_DB_ADAPTER_TARGET || 'http://127.0.0.1:8788';

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
      proxy: {
        // /swp is also a prefix of /swp_upload, so the file route must be
        // registered first or template images will be sent to the API port.
        '/swp_upload': {
          target: fileTarget,
          changeOrigin: true,
        },
        '/swp': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/db-adapter': {
          target: dbAdapterTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/db-adapter/, ''),
        },
      },
    },
    preview: {
      port: 5173,
      proxy: {
        '/swp_upload': {
          target: fileTarget,
          changeOrigin: true,
        },
        '/swp': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/db-adapter': {
          target: dbAdapterTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/db-adapter/, ''),
        },
      },
    },
  };
});
