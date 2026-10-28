/**
 * Status → message. Names the envelopes the API actually returns (402 / 403 / 429) and
 * does not name upstream providers — leaking those is a docs-page failure mode this
 * package must not copy.
 */
export function describeStatusError(status: number): string {
  switch (status) {
    case 401:
      return 'Missing or invalid API key.'
    case 402:
      return "Out of validations: this period's plan allowance is used up. Upgrade the plan on the NumRadar dashboard's Billing page, or wait for it to renew. Nothing was checked and nothing was charged."
    case 403:
      return 'API access starts at Starter+.'
    case 404:
      return 'Job not found, or it belongs to a different account.'
    case 413:
      return 'Payload too large. Split the list.'
    case 429:
      return 'Rate limited. Back off using the Retry-After header. Nothing was billed.'
    case 502:
      return 'Upstream check unavailable. Nothing was billed. Retry later.'
    default:
      return `NumRadar API returned HTTP ${status}.`
  }
}

export function headerValue(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined
  const needle = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== needle) continue
    if (value === undefined || value === null) return undefined
    return Array.isArray(value) ? String(value[0]) : String(value)
  }
  return undefined
}
