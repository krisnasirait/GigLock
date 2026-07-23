import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mirrors the UI reference palette: deep blue + violet + neon cyan accents.
        ink: {
          900: "#050714",
          800: "#0a0e22",
          700: "#111634",
          600: "#1b2147",
        },
        neon: {
          blue: "#3b82f6",
          violet: "#8b5cf6",
          cyan: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-glow":
          "radial-gradient(circle at 20% 0%, rgba(59,130,246,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(139,92,246,0.18) 0%, transparent 40%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
