import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1f17",
        moss: "#1a3d2e",
        leaf: "#3d9f6c",
        lime: "#c8fb80",
        hay: "#e5dcc8",
        mist: "#f2efe6",
        ember: "#e85d04",
        canvas: "#faf9f5",
        panel: "rgba(255, 255, 255, 0.72)",
        success: "#22c55e",
        warning: "#f59e0b",
        critical: "#ef4444"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 31, 23, 0.08)",
        lift: "0 12px 40px rgba(15, 31, 23, 0.1)",
        glow: "0 0 0 1px rgba(200, 251, 128, 0.35), 0 18px 50px rgba(61, 159, 108, 0.12)",
        "card-hover": "0 20px 56px rgba(15, 31, 23, 0.09)",
        dock: "0 -12px 40px rgba(61, 159, 108, 0.12)",
        fab: "0 8px 32px rgba(61, 159, 108, 0.3), 0 2px 8px rgba(15, 31, 23, 0.1)"
      },
      fontFamily: {
        sans: ["var(--font-app)", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(61, 159, 108, 0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(232, 93, 4, 0.1), transparent 35%), linear-gradient(165deg, #faf9f5 0%, #eef6f0 45%, #f5f2eb 100%)"
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.2, 0.64, 1)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.4s cubic-bezier(0.34, 1.2, 0.64, 1) forwards",
        "scale-in": "scale-in 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) forwards"
      }
    }
  },
  plugins: []
};

export default config;
