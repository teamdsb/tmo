const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const outputFile = path.resolve(__dirname, '..', 'src', 'styles', 'tailwind.generated.css')
const convertScript = path.resolve(__dirname, 'convert-rem-to-rpx.js')

let converting = false
let queued = false
let debounceTimer = null
let watcher = null

function runConvert() {
  if (converting) {
    queued = true
    return
  }

  converting = true
  const proc = spawn(process.execPath, [convertScript], { stdio: 'inherit' })
  proc.on('exit', () => {
    converting = false
    if (queued) {
      queued = false
      runConvert()
    }
  })
}

function scheduleConvert() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runConvert, 200)
}

function startWatcher() {
  if (watcher) return
  const dir = path.dirname(outputFile)
  watcher = fs.watch(dir, (event, filename) => {
    if (!filename || filename !== path.basename(outputFile)) return
    if (event === 'change' || event === 'rename') {
      scheduleConvert()
    }
  })
  scheduleConvert()
}

function spawnTailwind() {
  const bin = process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss'
  const args = [
    '-c',
    'tailwind.config.cjs',
    '-i',
    'src/styles/tailwind.css',
    '-o',
    'src/styles/tailwind.generated.css',
    '--watch'
  ]

  const proc = spawn(bin, args, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  })

  proc.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

startWatcher()
spawnTailwind()
