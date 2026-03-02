import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const proxyTarget = process.env.ADMIN_WEB_PROXY_TARGET || 'http://localhost:8080';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        products: resolve(__dirname, 'products.html'),
        orders: resolve(__dirname, 'orders.html'),
        import: resolve(__dirname, 'import.html'),
        inquiries: resolve(__dirname, 'inquiries.html')
      }
    }
  }
});
