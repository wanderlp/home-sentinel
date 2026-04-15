import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/app/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/app/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/app/renderer'),
    server: { port: 5173, strictPort: true },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/app/renderer/index.html')
      }
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    plugins: [react()]
  }
});
