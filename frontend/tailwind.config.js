/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: { DEFAULT: '#1e3a5f', light: '#2d5a8e', dark: '#0f2440' },
        accent: { DEFAULT: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      },
    },
  },
  plugins: [],
};
