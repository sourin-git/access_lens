import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { input: { app: 'index.html', sceneTest: 'scene-test.html' } } },
});
