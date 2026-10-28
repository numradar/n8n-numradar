import { describeStatusError, headerValue } from './errors'
import {
  invalidCrmFields,
  omitWid,
  stripTrailingSlash,
  toValidateOutput,
  type PublicResultLike,
  type ValidateOutput,
} from './map'
import { parsePhones } from './phones'

export type HttpRequest = (args: {
  method: 'GET' | 'POST'
  url: string
  body?: unknown
}) => Promise<{
  statusCode: number
  body: unknown
  headers?: Record<string, unknown>
}>

export type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

function fail(status: number, headers?: Record<string, unknown>): OperationResult<never> {
  let message = describeStatusError(status)
  if (status === 429) {
    const retryAfter = headerValue(headers, 'retry-after')
    if (retryAfter) message = `${message} Retry-After: ${retryAfter}.`
  }
  return { ok: false, status, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function unwrapValidateResult(body: unknown): PublicResultLike | null {
  if (!isRecord(body)) return null
  const inner = isRecord(body.result) ? body.result : body
  if (typeof inner.valid !== 'boolean' || typeof inner.whatsapp !== 'boolean') return null
  return inner as unknown as PublicResultLike
}

/**
 * Validate is a write: a definitive result uses one validation from the plan allowance. A 422
 * is an invalid number (`numradar_format_valid: false`), not a node error — it is not billed.
 */
export async function executeValidate(
  http: HttpRequest,
  args: { baseUrl: string; phone: string; now: number },
): Promise<OperationResult<ValidateOutput>> {
  const url = `${stripTrailingSlash(args.baseUrl)}/validate`
  const res = await http({ method: 'POST', url, body: { phone: args.phone } })
  if (res.statusCode === 422) {
    return { ok: true, data: invalidCrmFields(args.phone, args.now) }
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return fail(res.statusCode, res.headers)
  }
  const mapped = unwrapValidateResult(res.body)
  if (!mapped) {
    return { ok: false, status: res.statusCode, message: 'NumRadar API returned an unexpected validate body.' }
  }
  return { ok: true, data: toValidateOutput(mapped, args.phone, args.now) }
}

export async function executeCreateBulkJob(
  http: HttpRequest,
  args: { baseUrl: string; phones: unknown },
): Promise<OperationResult<unknown>> {
  const phones = parsePhones(args.phones)
  if (phones.length === 0) {
    return { ok: false, status: 400, message: 'Provide at least one phone number.' }
  }
  const url = `${stripTrailingSlash(args.baseUrl)}/bulk`
  const res = await http({ method: 'POST', url, body: { phones } })
  // 202 Accepted is the success the API documents; treat other 2xx the same.
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return fail(res.statusCode, res.headers)
  }
  return { ok: true, data: omitWid(res.body) }
}

export async function executeGetBulkJob(
  http: HttpRequest,
  args: {
    baseUrl: string
    jobId: string
    includeResults?: boolean
    limit?: number
    offset?: number
  },
): Promise<OperationResult<unknown>> {
  const params = new URLSearchParams()
  if (args.includeResults) params.set('include', 'results')
  if (args.limit !== undefined) params.set('limit', String(args.limit))
  if (args.offset !== undefined && args.offset > 0) params.set('offset', String(args.offset))
  const qs = params.toString()
  const url = `${stripTrailingSlash(args.baseUrl)}/bulk/${encodeURIComponent(args.jobId)}${qs ? `?${qs}` : ''}`
  const res = await http({ method: 'GET', url })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return fail(res.statusCode, res.headers)
  }
  return { ok: true, data: omitWid(res.body) }
}
