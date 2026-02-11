const fs = require('node:fs')
const path = require('node:path')

const miniappDir = path.resolve(__dirname, '..')
const runPath = path.resolve(
  process.env.WEAPP_RUN_JSON_PATH
  || path.join(miniappDir, '.logs', 'weapp', 'run.json')
)

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
}

function stringifyFailedKeys(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(',')
  }
  return String(value || '')
}

function normalizeEndpoint(value) {
  if (!value || typeof value !== 'object') {
    return { path: '', requestId: '', status: '' }
  }
  return {
    path: String(value.path || ''),
    requestId: String(value.requestId || ''),
    status: String(value.status || '')
  }
}

function appendGithubSummary(line, report) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) {
    return
  }

  const firstFail = report.firstFail && typeof report.firstFail === 'object' ? report.firstFail : {}
  const endpoint = normalizeEndpoint(firstFail.endpoint)
  const failedKeys = stringifyFailedKeys(firstFail.assertionKeys || report?.assertions?.failedKeys)

  const lines = [
    '### Weapp Automator Structured Summary',
    '',
    '| key | value |',
    '| --- | --- |',
    `| status | ${String(report.status || 'unknown')} |`,
    `| mode | ${String(report.mode || 'unknown')} |`,
    `| runId | ${String(report.runId || '-')} |`,
    `| route | ${String(firstFail.route || report?.route?.target || '-')} |`,
    `| failedKeys | ${failedKeys || '-'} |`,
    `| endpoint | ${endpoint.path || '-'} |`,
    `| requestId | ${endpoint.requestId || '-'} |`,
    `| p0/p1/p2 | ${Number(report?.severity?.p0 || 0)}/${Number(report?.severity?.p1 || 0)}/${Number(report?.severity?.p2 || 0)} |`,
    `| summary | ${String(report?.artifacts?.summary || '-')} |`,
    `| run | ${String(report?.artifacts?.run || '-')} |`,
    '',
    '```text',
    line,
    '```',
    ''
  ]

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8')
}

if (!fs.existsSync(runPath)) {
  console.error(`[weapp-run] run.json not found: ${runPath}`)
  process.exit(1)
}

let report
try {
  report = JSON.parse(fs.readFileSync(runPath, 'utf8'))
} catch (error) {
  console.error(`[weapp-run] failed to parse run.json: ${error?.message || String(error)}`)
  process.exit(1)
}

try {
  assertObject(report, 'run report')
} catch (error) {
  console.error(`[weapp-run] ${error?.message || String(error)}`)
  process.exit(1)
}

const status = String(report.status || '')
if (!status) {
  console.error('[weapp-run] run report missing status')
  process.exit(1)
}

const mode = String(report.mode || 'unknown')
const firstFail = report.firstFail && typeof report.firstFail === 'object' ? report.firstFail : {}
const endpoint = normalizeEndpoint(firstFail.endpoint)
const failedKeys = stringifyFailedKeys(firstFail.assertionKeys || report?.assertions?.failedKeys)
const route = String(firstFail.route || report?.route?.target || '-')
const p0 = Number(report?.severity?.p0 || 0)
const p1 = Number(report?.severity?.p1 || 0)
const p2 = Number(report?.severity?.p2 || 0)

const line = [
  `[weapp-run] status=${status}`,
  `mode=${mode}`,
  `route=${route}`,
  `failedKeys=${failedKeys || '-'}`,
  `endpoint=${endpoint.path || '-'}`,
  `requestId=${endpoint.requestId || '-'}`,
  `statusCode=${endpoint.status || '-'}`,
  `p0=${p0}`,
  `p1=${p1}`,
  `p2=${p2}`,
  `run=${path.relative(process.cwd(), runPath) || runPath}`
].join(' ')

console.log(line)
appendGithubSummary(line, report)
