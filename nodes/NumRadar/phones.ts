/**
 * Create Bulk Job accepts a textarea (one number per line, or comma-separated) or a JSON
 * array from an expression. The API itself takes `phones` as either a string blob or a
 * string array — we always send an array so a stray CSV header is the caller's problem,
 * not a silent blob parse on the server.
 */
export function parsePhones(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter((item) => item.length > 0)
  }
  if (typeof input !== 'string') return []
  const trimmed = input.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0)
      }
    } catch {
      // Fall through to the blob splitter — a number that happens to start with '['
      // is malformed either way, and the API will 400 it.
    }
  }
  return trimmed.split(/[\n\r,]+/).map((item) => item.trim()).filter((item) => item.length > 0)
}
