module.exports = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "!./src/**/*.test.{ts,tsx,js,jsx}",
    "!./src/**/__tests__/**",
    "!./src/test-utils/**",
    "./index.html",
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false,
  },
}
