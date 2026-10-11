import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090f",
          900: "#0a0d15",
          850: "#0d1119",
          800: "#111624",
          700: "#1a2133",
          600: "#273049",
        },
        mist: {
          DEFAULT: "#8b94ab",
          dim: "#5b6378",
          bright: "#c3c9d9",
        },
        atom: {
          cyan: "#22d3ee",
          blue: "#3b82f6",
          violet: "#8b5cf6",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
