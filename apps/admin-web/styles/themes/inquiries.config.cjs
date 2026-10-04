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
        "surface-dark": "#1e293b",
        "text-main": "#0f172a",
        "text-sub": "#64748b",
        "border-color": "#e2e8f0"
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
