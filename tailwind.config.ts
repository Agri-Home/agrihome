import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14231E",
        moss: "#244E3A",
        leaf: "#4FA56F",
        hay: "#E8D7A5",
        mist: "#F4F1E8",
        ember: "#B45C3C",
        panel: "rgba(255, 255, 255, 0.7)"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(20, 35, 30, 0.12)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(79, 165, 111, 0.16), transparent 38%), radial-gradient(circle at 80% 0%, rgba(180, 92, 60, 0.18), transparent 32%), linear-gradient(135deg, #f5efe2 0%, #f0f6ee 48%, #eef4f8 100%)"
      },
      fontFamily: {
        sans: [
          "\"Avenir Next\"",
          "\"Segoe UI\"",
          "\"Helvetica Neue\"",
          "sans-serif"
        ],
        display: [
          "\"Baskerville\"",
          "\"Iowan Old Style\"",
          "\"Georgia\"",
          "serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
