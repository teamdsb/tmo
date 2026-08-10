#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parse } from "yaml"

export const defaultServiceFiles = [
  "identity.yaml",
  "commerce.yaml",
  "payment.yaml",
  "gateway.yaml",
  "ai.yaml",
  "admin.yaml",
]

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepositoryRoot = resolve(dirname(scriptPath), "../..")

export function validateOpenAPISync({
  repositoryRoot = defaultRepositoryRoot,
  serviceFiles = defaultServiceFiles,
} = {}) {
  const contractsDir = join(repositoryRoot, "contracts", "openapi")
  const aggregatePath = join(contractsDir, "openapi.yaml")
  const errors = new Set()
  const documents = new Map()
  const scannedDocuments = new Set()

  const displayPath = (filePath) => {
    const shown = relative(repositoryRoot, filePath)
    return shown === "" || shown.startsWith("..") ? filePath : shown
  }

  const loadDocument = (filePath, referencedBy = "") => {
    const normalized = resolve(filePath)
    if (documents.has(normalized)) {
      return documents.get(normalized)
    }
    if (!existsSync(normalized)) {
      errors.add(`${referencedBy || displayPath(normalized)}: referenced file does not exist: ${displayPath(normalized)}`)
      documents.set(normalized, null)
      return null
    }

    try {
      const document = parse(readFileSync(normalized, "utf8"), {
        prettyErrors: true,
        uniqueKeys: true,
      })
      if (document === null || typeof document !== "object" || Array.isArray(document)) {
        errors.add(`${displayPath(normalized)}: expected a YAML object at document root`)
        documents.set(normalized, null)
        return null
      }
      documents.set(normalized, document)
      return document
    } catch (error) {
      errors.add(`${displayPath(normalized)}: invalid YAML: ${error.message}`)
      documents.set(normalized, null)
      return null
    }
  }

  const resolvePointer = (document, fragment, ref, sourceLabel) => {
    if (fragment === "") {
      return true
    }

    let decoded
    try {
      decoded = decodeURIComponent(fragment)
    } catch {
      errors.add(`${sourceLabel}: invalid URI encoding in $ref ${JSON.stringify(ref)}`)
      return false
    }
    if (!decoded.startsWith("/")) {
      errors.add(`${sourceLabel}: unsupported non-JSON-Pointer fragment in $ref ${JSON.stringify(ref)}`)
      return false
    }

    let current = document
    for (const encodedToken of decoded.slice(1).split("/")) {
      const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~")
      if (
        current === null ||
        (typeof current !== "object" && !Array.isArray(current)) ||
        !Object.prototype.hasOwnProperty.call(current, token)
      ) {
        errors.add(`${sourceLabel}: JSON Pointer target does not exist for $ref ${JSON.stringify(ref)}`)
        return false
      }
      current = current[token]
    }
    return true
  }

  const scanDocument = (filePath) => {
    const normalized = resolve(filePath)
    if (scannedDocuments.has(normalized)) {
      return
    }
    scannedDocuments.add(normalized)

    const document = loadDocument(normalized)
    if (document === null) {
      return
    }

    const seenNodes = new WeakSet()
    const visit = (value, location) => {
      if (value === null || typeof value !== "object" || seenNodes.has(value)) {
        return
      }
      seenNodes.add(value)

      if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "$ref")) {
        const ref = value.$ref
        const sourceLabel = `${displayPath(normalized)}${location}`
        if (typeof ref !== "string" || ref.trim() === "") {
          errors.add(`${sourceLabel}: $ref must be a non-empty string`)
        } else if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) {
          const hashIndex = ref.indexOf("#")
          const filePart = hashIndex === -1 ? ref : ref.slice(0, hashIndex)
          const fragment = hashIndex === -1 ? "" : ref.slice(hashIndex + 1)
          const targetPath = filePart === "" ? normalized : resolve(dirname(normalized), filePart)
          const targetDocument = loadDocument(targetPath, `${sourceLabel}: ${ref}`)
          if (targetDocument !== null) {
            resolvePointer(targetDocument, fragment, ref, sourceLabel)
            scanDocument(targetPath)
          }
        }
      }

      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, `${location}/${index}`))
        return
      }
      for (const [key, entry] of Object.entries(value)) {
        visit(entry, `${location}/${escapePointerToken(key)}`)
      }
    }

    visit(document, "")
  }

  const aggregate = loadDocument(aggregatePath)
  if (aggregate !== null) {
    const aggregatePaths = readPaths(aggregate, displayPath(aggregatePath), errors)
    const declaredServicePaths = new Set()
    for (const serviceFile of serviceFiles) {
      const servicePath = isAbsolute(serviceFile) ? serviceFile : join(contractsDir, serviceFile)
      const serviceDocument = loadDocument(servicePath)
      if (serviceDocument === null) {
        continue
      }
      const servicePaths = readPaths(serviceDocument, displayPath(servicePath), errors)
      for (const pathName of Object.keys(servicePaths)) {
        declaredServicePaths.add(pathName)
        if (!Object.prototype.hasOwnProperty.call(aggregatePaths, pathName)) {
          errors.add(`${displayPath(aggregatePath)}: missing service path ${pathName} from ${displayPath(servicePath)}`)
        }
      }
    }
    for (const pathName of Object.keys(aggregatePaths)) {
      if (!declaredServicePaths.has(pathName)) {
        errors.add(`${displayPath(aggregatePath)}: aggregate path ${pathName} is not declared by any service specification`)
      }
    }
  }

  scanDocument(aggregatePath)
  for (const serviceFile of serviceFiles) {
    scanDocument(isAbsolute(serviceFile) ? serviceFile : join(contractsDir, serviceFile))
  }

  return [...errors].sort()
}

function readPaths(document, label, errors) {
  if (document.paths === null || typeof document.paths !== "object" || Array.isArray(document.paths)) {
    errors.add(`${label}: paths must be a YAML object`)
    return {}
  }
  return document.paths
}

function escapePointerToken(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1")
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const errors = validateOpenAPISync()
  if (errors.length > 0) {
    console.error("OpenAPI sync check failed:")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
  } else {
    console.log(`OpenAPI sync check passed (${defaultServiceFiles.length} service specifications).`)
  }
}
