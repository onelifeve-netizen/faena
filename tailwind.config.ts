import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#F3F4FA",
        panel: "#FFFFFF",
        ink: "#12172B",
        steel: "#5B6178",
        line: "#E5E7F2",
        accent: "#6D28D9",
        gold: "#F4C430",
        ok: "#0E9F6E",
        warn: "#D97706",
        info: "#2563EB",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        tag: "10px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(18, 23, 43, 0.04), 0 1px 12px -2px rgba(18, 23, 43, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
