import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', "sans-serif"],
      },
      colors: {
        "dark-nav": "#1e293b",
        "emerald-accent": "#10b981",
        "amber-accent": "#f59e0b",
        "coral-red": "#ef4444",
      },
    },
  },
  plugins: [],
} satisfies Config;
