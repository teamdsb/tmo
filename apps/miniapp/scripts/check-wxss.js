const fs = require('fs')
const path = require('path')

const inputFile = path.resolve(__dirname, '..', 'src', 'styles', 'tailwind.generated.css')

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(message)
  process.exit(1)
}

function run() {
  if (!fs.existsSync(inputFile)) {
    fail(`Missing generated CSS: ${inputFile}`)
  }

  const css = fs.readFileSync(inputFile, 'utf8')
  if (css.includes('\\')) {
    fail('WXSS check failed: found \\\\ escape in generated CSS')
  }
  if (css.includes('--tw-') || css.includes('var(--tw-')) {
    fail('WXSS check failed: found CSS custom properties (--tw-) in generated CSS')
  }
}

run()
