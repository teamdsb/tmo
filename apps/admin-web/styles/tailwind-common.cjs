const path = require('node:path');
module.exports = {
  content: [path.resolve(__dirname, '../*.html'), path.resolve(__dirname, '../src/**/*.{js,ts,tsx}')],
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};
