module.exports = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "!./src/**/*.test.{ts,tsx,js,jsx}",
    "!./src/**/__tests__/**",
    "./index.html",
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false,
  },
}
