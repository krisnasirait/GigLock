import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#030712",
          900: "#050714",
          800: "#0a0e22",
          700: "#111634",
          600: "#1b2147",
        },
        neon: {
          blue: "#3b82f6",
          violet: "#8b5cf6",
          cyan: "#22d3ee",
          green: "#10b981",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "grid-glow":
          "radial-gradient(circle at 20% 0%, rgba(59,130,246,0.12) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(139,92,246,0.12) 0%, transparent 40%)",
        "hero-radial":
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.15), transparent)",
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.1)",
        "glow-violet": "0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.1)",
        "glow-cyan": "0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(34,211,238,0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "flow-down": "flowDown 2s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "border-flow": "borderFlow 4s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        flowDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "50%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        borderFlow: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
