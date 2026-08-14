/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#ff5d38",
        "primary-soft": "#ffb3a1",
        "background-light": "#FDF7EA",
        "background-dark": "#171512",
        "surface-light": "#FFFFFF",
        "surface-dark": "#2b1c18",
        "neutral-dark": "#181210",
        "neutral-soft": "#8d665e",
        "neutral-soft-dark": "#C9A79D",
        peach: "#FEB09D",
        toffee: "#C0A97E",
      },
      fontFamily: {
        sans: ["DM Sans"],
        display: ["Inter"],
        serif: ["Instrument Serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
