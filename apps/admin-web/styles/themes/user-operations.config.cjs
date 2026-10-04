const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface-light": "#ffffff",
        "surface-dark": "#1e2433",
        "text-primary-light": "#111318",
        "text-primary-dark": "#f0f2f4",
        "text-secondary-light": "#636f88",
        "text-secondary-dark": "#94a3b8",
        "border-light": "#e2e8f0",
        "border-dark": "#2d3748"
      },
      "fontFamily": {
        "display": [
          "Inter Variable",
          "sans-serif"
        ]
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      }
    }
  }
} };
