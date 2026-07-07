const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { syncDirectory } = require('./sync-weapp-devtools')

test('syncDirectory replaces stale output and copies the full build', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-sync-'))
  const source = path.join(root, 'source')
  const target = path.join(root, 'target')
  fs.mkdirSync(path.join(source, 'assets'), { recursive: true })
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(source, 'app.json'), '{}')
  fs.writeFileSync(path.join(source, 'assets', 'icon.png'), 'png')
  fs.writeFileSync(path.join(target, 'stale.js'), 'stale')

  syncDirectory(source, target)

  assert.equal(fs.readFileSync(path.join(target, 'app.json'), 'utf8'), '{}')
  assert.equal(fs.readFileSync(path.join(target, 'assets', 'icon.png'), 'utf8'), 'png')
  assert.equal(fs.existsSync(path.join(target, 'stale.js')), false)
})

test('syncDirectory rejects non-ASCII and symlink targets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-sync-'))
  const source = path.join(root, 'source')
  fs.mkdirSync(source)
  assert.throws(() => syncDirectory(source, path.join(root, '中文')), /ASCII/)

  const realTarget = path.join(root, 'real-target')
  const linkedTarget = path.join(root, 'linked-target')
  fs.mkdirSync(realTarget)
  fs.symlinkSync(realTarget, linkedTarget)
  assert.throws(() => syncDirectory(source, linkedTarget), /symlink/)
})
