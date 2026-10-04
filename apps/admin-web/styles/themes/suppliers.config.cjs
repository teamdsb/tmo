const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "background-light": "#f6f6f8",
        "background-dark": "#111621"
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
