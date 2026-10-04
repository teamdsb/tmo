const common = require('../tailwind-common.cjs');
module.exports = { ...common, ...{
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "primary": "#144bb8",
        "primary-dark": "#0e3482",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface": {
          "light": "#ffffff",
          "dark": "#1a2233"
        },
        "text": {
          "main": "#111318",
          "muted": "#636f88",
          "dark": "#f0f2f4",
          "mutedDark": "#9ca3af"
        }
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
