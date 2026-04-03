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
        panel: "rgba(255, 255, 255, 0.72)"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 31, 23, 0.08)",
        lift: "0 12px 40px rgba(15, 31, 23, 0.1)",
        glow: "0 0 0 1px rgba(200, 251, 128, 0.35), 0 18px 50px rgba(61, 159, 108, 0.12)"
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
      }
    }
  },
  plugins: []
};

export default config;
