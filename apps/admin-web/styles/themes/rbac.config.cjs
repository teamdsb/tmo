const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "primary-light": "#ebf1ff",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface-light": "#ffffff",
        "surface-dark": "#1a2233",
        "border-light": "#e2e8f0",
        "border-dark": "#2d3748",
        "text-main": "#0f172a",
        "text-secondary": "#64748b"
      },
      "fontFamily": {
        "display": [
          "Inter Variable",
          "sans-serif"
        ],
        "body": [
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
