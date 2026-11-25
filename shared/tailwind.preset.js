/** Shared design tokens for frontend and dashboard. */
export default {
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        brand: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81" },
        ink: { DEFAULT: "#111827", soft: "#374151", muted: "#6b7280" },
      },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)", pop: "0 12px 32px -8px rgba(16,24,40,.18)" },
      keyframes: {
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": { from: { opacity: 0, transform: "translateY(8px) scale(.98)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: { "slide-in": "slide-in .25s ease-out", "fade-in": "fade-in .2s ease-out", "pop-in": "pop-in .2s ease-out" },
    },
  },
  plugins: [],
};
