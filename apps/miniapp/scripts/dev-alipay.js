const path = require('path')
const { spawn } = require('child_process')

const postprocessScript = path.resolve(__dirname, 'postprocess-alipay.js')

let postprocessRunning = false
let postprocessQueued = false
let stdoutBuffer = ''
let stderrBuffer = ''

function runPostprocess() {
  if (postprocessRunning) {
    postprocessQueued = true
    return
  }

  postprocessRunning = true
  const proc = spawn(process.execPath, [postprocessScript], { stdio: 'inherit' })
  proc.on('exit', () => {
    postprocessRunning = false
    if (postprocessQueued) {
      postprocessQueued = false
      runPostprocess()
    }
  })
}

function handleLine(line) {
  if (!line) {
    return
  }

  if (/built in/.test(line)) {
    runPostprocess()
  }
}

function flushLines(chunk, source) {
  const next = source === 'stdout' ? `${stdoutBuffer}${chunk}` : `${stderrBuffer}${chunk}`
  const parts = next.split(/\r?\n/)
  const tail = parts.pop() || ''

  for (const line of parts) {
    handleLine(line)
  }

  if (source === 'stdout') {
    stdoutBuffer = tail
  } else {
    stderrBuffer = tail
  }
}

function spawnBuildWatch() {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const args = ['run', 'build:alipay:raw', '--', '--watch']
  const proc = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'] })

  proc.stdout.setEncoding('utf8')
  proc.stderr.setEncoding('utf8')

  proc.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    flushLines(chunk, 'stdout')
  })

  proc.stderr.on('data', (chunk) => {
    process.stderr.write(chunk)
    flushLines(chunk, 'stderr')
  })

  proc.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

runPostprocess()
spawnBuildWatch()
