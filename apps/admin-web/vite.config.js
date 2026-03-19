import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.ADMIN_WEB_PROXY_TARGET || 'http://localhost:8080';
const paymentProxyTarget = process.env.ADMIN_WEB_PAYMENT_PROXY_TARGET || 'http://localhost:8083';
const workspaceRoot = resolve(__dirname, '../..');
const rawBasePath = String(process.env.VITE_ADMIN_WEB_BASE_PATH || '/').trim();
const normalizedBasePath = rawBasePath === '/'
  ? '/'
  : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@tmo/api-client': resolve(__dirname, '../../packages/api-client/src/index.ts'),
      '@tmo/gateway-api-client': resolve(__dirname, '../../packages/gateway-api-client/src/index.ts'),
      '@tmo/identity-api-client': resolve(__dirname, '../../packages/identity-api-client/src/index.ts'),
      '@tmo/openapi-client': resolve(__dirname, '../../packages/openapi-client/src/index.ts')
    }
  },
  server: {
    fs: {
      allow: [workspaceRoot]
    },
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/payment-api': {
        target: paymentProxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/payment-api/, '')
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
        inquiries: resolve(__dirname, 'inquiries.html'),
        suppliers: resolve(__dirname, 'suppliers.html'),
        quoteWorkflow: resolve(__dirname, 'quote-workflow.html'),
        payments: resolve(__dirname, 'payments.html'),
        exports: resolve(__dirname, 'exports.html'),
        rbac: resolve(__dirname, 'rbac.html'),
        settings: resolve(__dirname, 'settings.html'),
        profile: resolve(__dirname, 'profile.html'),
        userOperations: resolve(__dirname, 'user-operations.html'),
        transfer: resolve(__dirname, 'transfer.html'),
        support: resolve(__dirname, 'support.html')
      }
    }
  }
});
