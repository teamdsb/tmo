const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const distDir = path.resolve(__dirname, '..', 'dist')
const fixScript = path.resolve(__dirname, 'fix-alipay-js.js')

let fixRunning = false
let fixQueued = false
let debounceTimer = null
let watcherStarted = false
let intervalId = null

function runFix() {
  if (fixRunning) {
    fixQueued = true
    return
  }

  fixRunning = true
  const proc = spawn(process.execPath, [fixScript], { stdio: 'inherit' })
  proc.on('exit', () => {
    fixRunning = false
    if (fixQueued) {
      fixQueued = false
      runFix()
    }
  })
}

function scheduleFix() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runFix, 300)
}

function startWatch() {
  if (watcherStarted) return
  try {
    const watcher = fs.watch(distDir, { recursive: true }, (_event, filename) => {
      if (!filename) return
      if (!filename.endsWith('.js') && !filename.endsWith('.sjs')) return
      scheduleFix()
    })
    watcher.on('error', () => {
      watcherStarted = false
      setTimeout(startWatch, 500)
    })
    watcherStarted = true
    scheduleFix()
    if (!intervalId) {
      intervalId = setInterval(runFix, 2000)
    }
  } catch (_err) {
    setTimeout(startWatch, 500)
  }
}

function waitForDist() {
  fs.access(distDir, fs.constants.F_OK, (err) => {
    if (err) {
      setTimeout(waitForDist, 500)
      return
    }
    startWatch()
  })
}

function spawnBuild() {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const args = ['run', 'build:alipay', '--', '--watch']
  const proc = spawn(cmd, args, { stdio: 'inherit' })
  proc.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

waitForDist()
spawnBuild()
