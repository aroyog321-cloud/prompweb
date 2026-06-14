import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        flux: {
          void: "#0B0B12",
          surface: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.10)",
          text: "#F2F2F8",
          muted: "#9594B3",
          cyan: "#4FE6E0",
          violet: "#8B6CFF",
          magenta: "#FF5FB8"
        }
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      backgroundImage: {
        "flux-ring": "conic-gradient(from 180deg, #4FE6E0, #8B6CFF, #FF5FB8, #4FE6E0)",
        "flux-glow": "radial-gradient(circle at 30% 30%, rgba(139,108,255,0.35), transparent 60%)"
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
