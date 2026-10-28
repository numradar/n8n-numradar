import { describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE_URL } from '../nodes/NumRadar/map'
import {
  executeCreateBulkJob,
  executeGetBulkJob,
  executeValidate,
  type HttpRequest,
} from '../nodes/NumRadar/operations'
import { parsePhones } from '../nodes/NumRadar/phones'

const NOW = 1_700_000_000_000
const BASE = DEFAULT_API_BASE_URL

const registeredBody = {
  status: 'ok',
  billable: true,
  result: {
    phone: '+34600111222',
    valid: true,
    whatsapp: true,
    wid: '34600111222@c.us',
    is_business: true,
    business: { name: 'Acme SL', level: 'low', is_api: false, is_smb: true },
    link: 'https://wa.me/34600111222',
    line_type: 'mobile',
    wa_sendable: true,
    country: { code: 'ES', name: 'Spain', prefix: '+34' },
  },
}

type Call = { method: string; url: string; body?: unknown }

function mockHttp(
  statusCode: number,
  body: unknown,
  headers: Record<string, unknown> = {},
): { http: HttpRequest; calls: Call[] } {
  const calls: Call[] = []
  const http: HttpRequest = async (req) => {
    calls.push(req)
    return { statusCode, body, headers }
  }
  return { http, calls }
}

describe('executeValidate', () => {
  it('POSTs to the documented validate URL with the phone body', async () => {
    const { http, calls } = mockHttp(200, registeredBody)
    await executeValidate(http, { baseUrl: BASE, phone: '+34600111222', now: NOW })
    expect(calls[0]).toEqual({
      method: 'POST',
      url: 'https://api.numradar.app/v1/validate',
      body: { phone: '+34600111222' },
    })
  })

  it('strips a trailing slash on the base URL so the path never doubles', async () => {
    const { http, calls } = mockHttp(200, registeredBody)
    await executeValidate(http, { baseUrl: `${BASE}/`, phone: '+34600111222', now: NOW })
    expect(calls[0]!.url).toBe('https://api.numradar.app/v1/validate')
  })

  it('maps a registered number to numradar_whatsapp_registered true and never emits wid', async () => {
    const { http } = mockHttp(200, registeredBody)
    const out = await executeValidate(http, { baseUrl: BASE, phone: '+34600111222', now: NOW })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.data.numradar_whatsapp_registered).toBe(true)
    expect(out.data.numradar_format_valid).toBe(true)
    expect(out.data.numradar_check_status).toBe('ok')
    expect(out.data.numradar_wa_sendable).toBe(true)
    expect(out.data.numradar_business_name).toBe('Acme SL')
    expect(out.data).not.toHaveProperty('wid')
    expect(JSON.stringify(out.data)).not.toContain('wid')
    expect(JSON.stringify(out.data)).not.toContain('34600111222@c.us')
  })

  it('treats HTTP 422 as a successful item with format_valid false', async () => {
    const { http } = mockHttp(422, {
      error_type: 'INVALID_INPUT',
      error_code: 'invalid_phone',
      error_message: '+1999 failed local validation and was not billed.',
    })
    const out = await executeValidate(http, { baseUrl: BASE, phone: '+1999', now: NOW })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.data.numradar_format_valid).toBe(false)
    expect(out.data.numradar_check_status).toBe('invalid')
    expect(out.data.numradar_whatsapp_registered).toBe(false)
    expect(out.data.numradar_wa_sendable).toBe(false)
    expect(out.data.phone).toBe('+1999')
  })

  it('maps 402 to an out-of-validations error, not a successful item', async () => {
    const { http } = mockHttp(402, { error_code: 'quota_exceeded' })
    const out = await executeValidate(http, { baseUrl: BASE, phone: '+34600111222', now: NOW })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.status).toBe(402)
    expect(out.message).toMatch(/out of validations/i)
    // What it tells the customer to do must be something they can do: nothing is sold by the pack.
    expect(out.message).not.toMatch(/credit|top up|buy/i)
    expect(out.message).not.toMatch(/\bMeta\b|\bTwilio\b/i)
  })

  it('maps 403 to Starter+ API access', async () => {
    const { http } = mockHttp(403, { error_code: 'subscription_required' })
    const out = await executeValidate(http, { baseUrl: BASE, phone: '+34600111222', now: NOW })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.status).toBe(403)
    expect(out.message).toMatch(/Starter\+/)
  })

  it('maps 429 to retry and includes Retry-After when present', async () => {
    const { http } = mockHttp(429, { error_code: 'rate_limited' }, { 'Retry-After': '60' })
    const out = await executeValidate(http, { baseUrl: BASE, phone: '+34600111222', now: NOW })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.status).toBe(429)
    expect(out.message).toMatch(/Retry-After: 60/)
    expect(out.message).toMatch(/nothing was billed/i)
  })
})

describe('executeCreateBulkJob', () => {
  it('POSTs phones as an array to the documented bulk URL', async () => {
    const { http, calls } = mockHttp(202, { job: { id: 'job-1', status: 'queued', results: [] } })
    const out = await executeCreateBulkJob(http, {
      baseUrl: BASE,
      phones: '+14158586273\n+442071838750',
    })
    expect(out.ok).toBe(true)
    expect(calls[0]).toEqual({
      method: 'POST',
      url: 'https://api.numradar.app/v1/bulk',
      body: { phones: ['+14158586273', '+442071838750'] },
    })
  })

  it('strips wid from a job payload', async () => {
    const { http } = mockHttp(202, {
      job: { id: 'job-1', results: [{ result: { wid: 'x@c.us', whatsapp: true } }] },
    })
    const out = await executeCreateBulkJob(http, { baseUrl: BASE, phones: ['+1'] })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(JSON.stringify(out.data)).not.toContain('wid')
  })

  it('refuses an empty list without calling the API', async () => {
    const { http, calls } = mockHttp(202, {})
    const out = await executeCreateBulkJob(http, { baseUrl: BASE, phones: '  \n  ' })
    expect(out.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

describe('executeGetBulkJob', () => {
  it('GETs the job id and encodes a hostile id', async () => {
    const { http, calls } = mockHttp(200, { job: { id: 'job-1', status: 'completed' } })
    await executeGetBulkJob(http, { baseUrl: BASE, jobId: '../../api/balance' })
    expect(calls[0]!.url).toBe('https://api.numradar.app/v1/bulk/..%2F..%2Fapi%2Fbalance')
    expect(calls[0]!.method).toBe('GET')
  })

  it('adds include=results and paging only when asked', async () => {
    const { http, calls } = mockHttp(200, { job: { id: 'job-1' } })
    await executeGetBulkJob(http, {
      baseUrl: BASE,
      jobId: 'job-1',
      includeResults: true,
      limit: 50,
      offset: 10,
    })
    expect(calls[0]!.url).toBe(
      'https://api.numradar.app/v1/bulk/job-1?include=results&limit=50&offset=10',
    )
  })

  it('strips wid from nested results on a completed job', async () => {
    const { http } = mockHttp(200, {
      job: {
        id: 'job-1',
        status: 'completed',
        results: [{ phone: '+34600111222', result: { whatsapp: true, wid: '34600111222@c.us' } }],
      },
    })
    const out = await executeGetBulkJob(http, { baseUrl: BASE, jobId: 'job-1', includeResults: true })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(JSON.stringify(out.data)).not.toContain('wid')
    expect(JSON.stringify(out.data)).toContain('+34600111222')
  })

  it('maps 404 to a job-not-found error', async () => {
    const { http } = mockHttp(404, { status: 'not_found' })
    const out = await executeGetBulkJob(http, { baseUrl: BASE, jobId: 'missing' })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.status).toBe(404)
    expect(out.message).toMatch(/not found/i)
  })
})

describe('parsePhones', () => {
  it('splits lines and commas and accepts a JSON array', () => {
    expect(parsePhones('+1\n+2, +3')).toEqual(['+1', '+2', '+3'])
    expect(parsePhones('["+1", "+2"]')).toEqual(['+1', '+2'])
    expect(parsePhones([' +1 ', ''])).toEqual(['+1'])
  })
})
