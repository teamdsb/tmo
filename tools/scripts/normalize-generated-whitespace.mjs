import { readFile, writeFile } from 'node:fs/promises'

const paths = process.argv.slice(2)

if (paths.length === 0) {
  throw new Error('at least one generated file path is required')
}

for (const path of paths) {
  const source = await readFile(path, 'utf8')
  const normalized = source.replace(/[ \t]+$/gm, '')
  if (normalized !== source) {
    await writeFile(path, normalized)
  }
}
