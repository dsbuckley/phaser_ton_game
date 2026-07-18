import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        process: true
      }
    })
  ],
  server: {
    port: Number(process.env.PORT) || 3000,
    open: true,
    strictPort: false,
    // API + bot webhook are served by `wrangler dev` locally
    proxy: {
      '/api': 'http://localhost:8787',
      '/webhook': 'http://localhost:8787'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['phaser']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
