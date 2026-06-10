import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 3000);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8080);

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.tsx',
    },
    define: {
      FRONTEND_PORT: JSON.stringify(FRONTEND_PORT),
      BACKEND_PORT: JSON.stringify(BACKEND_PORT),
      API_BASE_URL: JSON.stringify(`http://localhost:${BACKEND_PORT}/api`),
    },
  },
  server: {
    port: FRONTEND_PORT,
  },
  html: {
    template: './index.html',
    title: '跨境电商 - 月底集中处理跨境订单系统',
  },
});
