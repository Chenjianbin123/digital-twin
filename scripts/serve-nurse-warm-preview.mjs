import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';

// A local-only, synthetic preview. Never load .env or forward hospital API traffic.
const allowed = /^\/(?:scripts\/fixtures\/|src\/|node_modules\/|@vite\/|@fs\/|@id\/|models\/|draco\/|images\/|fonts\/|output\/nurse-station-warm-v[123]\/manifest\.json|output\/playwright\/nurse-warm-theme-cache\/)/;
const server = await createServer({
  configFile: false, envDir: false, envPrefix: 'SYNTHETIC_UNUSED_',
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: 'output/playwright/nurse-warm-theme-cache', appType: 'mpa',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  css: { preprocessorOptions: { scss: { api: 'modern',
    additionalData: '@use "@/styles/breakpoints.scss" as *;\n@use "@/styles/dashboard.scss" as *;\n' } } },
  optimizeDeps: { entries: ['scripts/fixtures/nurse-warm-preview.html'], include: ['three', 'vue', 'pinia'] },
  server: { host: '127.0.0.1', port: 5194, strictPort: true, open: false, hmr: false, proxy: {} },
  plugins: [vue(), { name: 'synthetic-preview-only', configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (request.method === 'GET' && allowed.test(request.url ?? '')) return next();
      response.statusCode = 403; response.end('Synthetic preview only');
    });
  } }],
});
await server.listen();
console.log('WARM_THEME_PREVIEW http://127.0.0.1:5194/scripts/fixtures/nurse-warm-preview.html?model=v3&presentation=1');
