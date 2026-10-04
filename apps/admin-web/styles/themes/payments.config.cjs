const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "page-bg": "#F5F7FA",
        "sidebar-bg": "#FFFFFF",
        "card-bg": "#FFFFFF",
        "text-main": "#334155",
        "text-muted": "#64748b"
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
