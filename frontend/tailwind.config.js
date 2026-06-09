/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        library: {
          50: '#f5f7fa',
          100: '#e4e8ee',
          200: '#c7d0db',
          300: '#9baac0',
          400: '#6a7f9e',
          500: '#4b6183',
          600: '#3a4d69',
          700: '#314056',
          800: '#2a3648',
          900: '#252f3e',
        },
      },
    },
  },
  plugins: [],
};
