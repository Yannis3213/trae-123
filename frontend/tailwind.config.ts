import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Noto Sans SC", "sans-serif"],
      },
      colors: {
        primary: "var(--color-primary)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        neutral: "var(--color-neutral)",
      },
    },
  },
  plugins: [],
};

export default config;
