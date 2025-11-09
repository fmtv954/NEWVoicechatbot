const DEFAULT_MAX_LENGTH = 256

interface SanitizeOptions {
  allowNewlines?: boolean
  maxLength?: number
}

export function sanitizePlainText(
  value?: string,
  { allowNewlines = false, maxLength = DEFAULT_MAX_LENGTH }: SanitizeOptions = {}
): string | undefined {
  if (!value) {
    return undefined
  }

  const withoutTags = value.replace(/<[^>]*>/g, '')

  let normalizedWhitespace: string

  if (allowNewlines) {
    const lines = withoutTags
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) =>
        line
          .replace(/[\t\f\v]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )

    const collapsedBlankLines = lines.filter((line, index, array) => {
      if (line.length > 0) {
        return true
      }

      const prevLine = array[index - 1]
      return Boolean(prevLine && prevLine.length > 0)
    })

    normalizedWhitespace = collapsedBlankLines.join('\n')
  } else {
    normalizedWhitespace = withoutTags.replace(/\s+/g, ' ')
  }

  const escapedSpecial = normalizedWhitespace.replace(/[<>&]/g, (char) => {
    switch (char) {
      case '<':
        return '\u2039'
      case '>':
        return '\u203a'
      case '&':
        return 'and'
      default:
        return char
    }
  })

  const strippedControl = escapedSpecial.replace(/[\u0000-\u001f\u007f]/g, '')

  const trimmed = strippedControl.trim()

  if (!trimmed) {
    return undefined
  }

  if (maxLength && maxLength > 0) {
    return trimmed.slice(0, maxLength)
  }

  return trimmed
}

export function sanitizePhone(
  value?: string,
  options?: { maxLength?: number }
): string | undefined {
  const cleaned = sanitizePlainText(value, { maxLength: options?.maxLength ?? DEFAULT_MAX_LENGTH })
  if (!cleaned) {
    return undefined
  }

  const hasLeadingPlus = cleaned.trim().startsWith('+')
  const digitsOnly = cleaned.replace(/\D/g, '')

  if (!digitsOnly) {
    return undefined
  }

  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
  }

  if (hasLeadingPlus) {
    return `+${digitsOnly}`.slice(0, options?.maxLength ?? DEFAULT_MAX_LENGTH)
  }

  return digitsOnly.slice(0, options?.maxLength ?? DEFAULT_MAX_LENGTH)
}

export function sanitizeEmail(
  value?: string,
  options?: { maxLength?: number }
): string | undefined {
  const cleaned = sanitizePlainText(value, { maxLength: options?.maxLength ?? DEFAULT_MAX_LENGTH })
  if (!cleaned) {
    return undefined
  }

  const normalized = cleaned.toLowerCase()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(normalized)) {
    return undefined
  }

  const limit = options?.maxLength ?? DEFAULT_MAX_LENGTH
  return limit ? normalized.slice(0, limit) : normalized
}
