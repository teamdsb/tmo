module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "!./src/**/*.test.{ts,tsx,js,jsx}",
    "!./src/**/__tests__/**",
    "!./src/test-utils/**",
    "./index.html",
  ],
  theme: {
    extend: {
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  corePlugins: {
    preflight: false,
  },
}
