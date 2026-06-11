import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    port: 3109,
    host: '0.0.0.0',
  },
  html: {
    title: '仓储配送中心 - 月底集中处理入库单系统',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
});
