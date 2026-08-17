const TOKEN_REDACTION = '[REDACTED_TOKEN]'

const tokenState = (value) => {
  if (value === null || value === undefined) return 'missing'
  return String(value).trim() ? 'present' : 'missing'
}

const isTokenKey = (key) => /authorization|token/i.test(String(key || ''))

const createDiagnosticSanitizer = () => {
  const observedTokens = new Set()

  const rememberToken = (value) => {
    const normalized = String(value || '').trim()
    if (normalized) observedTokens.add(normalized)
    return normalized
  }

  const sanitizeText = (value) => {
    let text = String(value || '')
    const tokens = [...observedTokens].sort((left, right) => right.length - left.length)
    for (const token of tokens) {
      text = text.split(token).join(TOKEN_REDACTION)
    }

    text = text.replace(
      /\bBearer\s+(?!\[REDACTED_TOKEN\])[^\s"',}]+/gi,
      `Bearer ${TOKEN_REDACTION}`
    )
    text = text.replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      TOKEN_REDACTION
    )
    text = text.replace(
      /((?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token(?:after|before)[A-Za-z0-9_-]*)\s*["']?\s*[:=]\s*["']?)([^"'\s,}\]]+)/gi,
      (match, prefix, candidate) => {
        const normalized = String(candidate || '').toLowerCase()
        if (normalized === 'present' || normalized === 'missing' || normalized === 'bearer' || normalized.startsWith(TOKEN_REDACTION.toLowerCase().slice(0, -1))) {
          return match
        }
        return `${prefix}${TOKEN_REDACTION}`
      }
    )
    return text
  }

  const sanitize = (value, key = '') => {
    if (isTokenKey(key)) {
      if (value === 'present' || value === 'missing') return value
      return tokenState(value)
    }
    if (typeof value === 'string') return sanitizeText(value)
    if (Array.isArray(value)) return value.map((item) => sanitize(item))
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, sanitize(nestedValue, nestedKey)])
      )
    }
    return value
  }

  return {
    rememberToken,
    sanitize,
    sanitizeText
  }
}

module.exports = {
  createDiagnosticSanitizer,
  tokenState
}
