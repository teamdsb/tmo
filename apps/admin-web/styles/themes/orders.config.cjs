const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "primary-content": "#ffffff",
        "primary-dark": "#0e3a96",
        "primary-light": "#ebf1ff",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface-light": "#ffffff",
        "surface-dark": "#1a2233",
        "text-main": "#0f172a",
        "text-main-dark": "#f8fafc",
        "text-sub": "#64748b",
        "text-sub-dark": "#94a3b8",
        "border-light": "#e2e8f0",
        "border-dark": "#2d3748"
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
        "2xl": "1rem",
        "full": "9999px"
      }
    }
  }
} };
