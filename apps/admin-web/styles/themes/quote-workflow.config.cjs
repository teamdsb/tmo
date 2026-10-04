const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "primary-content": "#ffffff",
        "primary-light": "#eef2fb",
        "background-light": "#f8f9fc",
        "background-dark": "#111621",
        "surface-light": "#ffffff",
        "surface-dark": "#1a202c",
        "text-main": "#1e293b",
        "text-sub": "#64748b",
        "border-light": "#e2e8f0",
        "border-dark": "#2d3748"
      },
      "fontFamily": {
        "display": [
          "Inter Variable",
          "sans-serif"
        ],
        "sans": [
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
