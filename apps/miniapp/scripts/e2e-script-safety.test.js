const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createDiagnosticSanitizer,
  tokenState
} = require('./e2e-output-safety')

const readScript = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8')

test('diagnostic sanitizer reports token presence without exposing token values', () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.sensitive-payload.signature'
  const sanitizer = createDiagnosticSanitizer()
  sanitizer.rememberToken(token)

  const sanitized = sanitizer.sanitize({
    accessToken: token,
    tokenAfterLogin: token,
    emptyToken: '',
    message: `request Authorization: Bearer ${token}`,
    nested: [
      `accessToken=${token}`,
      { safe: 'ok' },
      'response={"accessToken":"unobserved-secret"}',
      'token=present'
    ]
  })
  const serialized = JSON.stringify(sanitized)

  assert.equal(tokenState(token), 'present')
  assert.equal(tokenState(''), 'missing')
  assert.equal(sanitized.accessToken, 'present')
  assert.equal(sanitized.tokenAfterLogin, 'present')
  assert.equal(sanitized.emptyToken, 'missing')
  assert.equal(sanitizer.sanitize({ tokenAfterLogin: 'missing' }).tokenAfterLogin, 'missing')
  assert.match(sanitized.message, /Bearer \[REDACTED_TOKEN\]/)
  assert.equal(sanitized.nested[0], 'accessToken=[REDACTED_TOKEN]')
  assert.equal(sanitized.nested[1].safe, 'ok')
  assert.doesNotMatch(sanitized.nested[2], /unobserved-secret/)
  assert.equal(sanitized.nested[3], 'token=present')
  assert.doesNotMatch(serialized, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('auth E2E output paths use redacted token state', () => {
  const source = readScript('weapp-auth-e2e.js')

  assert.doesNotMatch(source, /lastRunDebugState\.tokenAfterLogin\s*=\s*tokenAfterLogin/)
  assert.doesNotMatch(source, /token=\$\{String\(tokenAfterLogin\)\}/)
  assert.doesNotMatch(source, /consoleTail\s*=\s*consoleLogs\.slice/)
  assert.doesNotMatch(source, /(?:headersRuntimeError|loginFailedWarn|logoutFailedWarn)\s*\?\s*\w+\.text/)
  assert.match(source, /sanitizeDiagnosticValue/)
  const serializedOutputLines = source
    .split('\n')
    .filter((line) => /console\.(?:log|error)\(JSON\.stringify/.test(line))
  assert.equal(serializedOutputLines.length, 3)
  assert.ok(serializedOutputLines.every((line) => line.includes('sanitizeDiagnosticValue')))
})

test('sales E2E rejects empty and excluded order IDs in API and UI results', () => {
  const source = readScript('weapp-sales-customers-real-e2e.js')

  assert.match(source, /WEAPP_SALES_E2E_EXPECTED_ORDER_IDS/)
  assert.match(source, /WEAPP_SALES_E2E_EXCLUDED_ORDER_IDS/)
  assert.match(source, /91919191-9191-9191-9191-919191919191/)
  assert.match(source, /92929292-9292-9292-9292-929292929292/)
  assert.match(source, /if \(apiOrderIds\.length === 0\)/)
  assert.match(source, /API missing expected sales-owned order/)
  assert.match(source, /API returned excluded order/)
  assert.match(source, /UI missing expected sales-owned order/)
  assert.match(source, /UI rendered excluded order/)
})

test('sales E2E sanitizes success and failure diagnostics', () => {
  const source = readScript('weapp-sales-customers-real-e2e.js')

  assert.match(source, /createDiagnosticSanitizer/)
  assert.match(source, /rememberAccessToken/)
  assert.match(source, /sanitizeDiagnosticValue/)
  assert.doesNotMatch(source, /consoleLogs\.slice/)
  assert.doesNotMatch(source, /exceptions\.join/)
  assert.doesNotMatch(source, /response\.status\} \$\{text\}/)
  assert.doesNotMatch(source, /error\.stack \|\| error\.message/)
  assert.match(source, /JSON\.stringify\(sanitizeDiagnosticValue\(successSummary\)/)
  assert.match(source, /JSON\.stringify\(sanitizeDiagnosticValue\(failureSummary\)/)
})
