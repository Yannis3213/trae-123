/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1e293b',
          accent: '#f97316',
        },
        expiry: {
          normal: '#10b981',
          approaching: '#f59e0b',
          overdue: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
