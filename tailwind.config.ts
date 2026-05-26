import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#28231f",
        linen: "#f8f3ee",
        petal: "#f0d8d3",
        sage: "#8fa99a",
        moss: "#49675a",
        brass: "#9d7447",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(73, 103, 90, 0.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
