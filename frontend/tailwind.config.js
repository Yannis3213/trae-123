/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: '#0A3D62',
				accent: '#1ABC9C',
				'status-pending': '#F39C12',
				'status-approved': '#3498DB',
				'status-synced': '#27AE60',
				'status-overdue': '#E74C3C',
				'status-approaching': '#E67E22'
			}
		}
	},
	plugins: []
};
