import preset from "@store/shared/tailwind.preset.js";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ["./index.html", "./src/**/*.{js,jsx}", "../shared/src/**/*.{js,jsx}"],
};
