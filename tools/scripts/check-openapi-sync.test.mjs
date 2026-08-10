import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { validateOpenAPISync } from "./check-openapi-sync.mjs"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))

test("repository aggregate contains every service path and valid local ref", () => {
  const errors = validateOpenAPISync({ repositoryRoot })
  assert.deepEqual(errors, [])
})

test("reports missing service paths, files, and JSON Pointer targets", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tmo-openapi-sync-"))
  const contractsDir = join(fixtureRoot, "contracts", "openapi")

  try {
    writeFixture(contractsDir, "openapi.yaml", `
openapi: 3.1.0
paths:
  /present:
    $ref: "./identity.yaml#/paths/~1missing-target"
  /aggregate-only:
    get:
      responses:
        "200": { description: OK }
components:
  schemas:
    MissingFile:
      $ref: "./absent.yaml#/components/schemas/Thing"
`)
    writeFixture(contractsDir, "identity.yaml", `
openapi: 3.1.0
paths:
  /present:
    get:
      responses:
        "200": { description: OK }
  /missing-from-aggregate:
    get:
      responses:
        "200": { description: OK }
`)

    const errors = validateOpenAPISync({
      repositoryRoot: fixtureRoot,
      serviceFiles: ["identity.yaml"],
    })

    assert.ok(errors.some((error) => error.includes("/missing-from-aggregate")), errors.join("\n"))
    assert.ok(errors.some((error) => error.includes("/aggregate-only")), errors.join("\n"))
    assert.ok(errors.some((error) => error.includes("missing-target")), errors.join("\n"))
    assert.ok(errors.some((error) => error.includes("absent.yaml")), errors.join("\n"))
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

function writeFixture(contractsDir, fileName, source) {
  mkdirSync(contractsDir, { recursive: true })
  const filePath = join(contractsDir, fileName)
  writeFileSync(filePath, source.trimStart(), { encoding: "utf8", flag: "wx" })
}
