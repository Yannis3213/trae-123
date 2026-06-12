import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3109,
		host: '0.0.0.0',
		proxy: {
			'/api': {
				target: 'http://localhost:8109',
				changeOrigin: true
			}
		}
	},
	preview: {
		port: 3109
	}
});
