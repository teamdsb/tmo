import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
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
