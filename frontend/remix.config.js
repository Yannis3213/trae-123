import { defineConfig } from '@remix-run/dev';

export default defineConfig({
  ignoredRouteFiles: ['**/.*'],
  serverModuleFormat: 'esm',
  future: {
    v2_dev: true,
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
});
