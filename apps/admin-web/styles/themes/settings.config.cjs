const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "primary-hover": "#0f3a91",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface-light": "#ffffff",
        "surface-dark": "#1a202c",
        "border-light": "#e2e8f0",
        "border-dark": "#2d3748",
        "text-main": "#0f172a",
        "text-muted": "#64748b"
      },
      "fontFamily": {
        "display": [
          "Inter Variable",
          "sans-serif"
        ]
      }
    }
  }
} };
