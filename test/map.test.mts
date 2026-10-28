import { describe, expect, it } from 'vitest'
import {
  DEFAULT_API_BASE_URL,
  invalidCrmFields,
  omitWid,
  toCrmFields,
  toValidateOutput,
  type PublicResultLike,
} from '../nodes/NumRadar/map'

const NOW = 1_700_000_000_000

const registered: PublicResultLike = {
  phone: '+34600111222',
  valid: true,
  whatsapp: true,
  is_business: true,
  business: { name: 'Acme SL' },
  link: 'https://wa.me/34600111222',
  line_type: 'mobile',
  wa_sendable: true,
  country: { code: 'ES' },
}

describe('toCrmFields', () => {
  it('maps a registered number onto the namespaced group and never emits wid', () => {
    const fields = toCrmFields(registered, NOW)
    expect(fields.numradar_whatsapp_registered).toBe(true)
    expect(fields.numradar_is_business).toBe(true)
    expect(fields.numradar_business_name).toBe('Acme SL')
    expect(fields.numradar_wa_link).toBe('https://wa.me/34600111222')
    expect(fields.numradar_country).toBe('ES')
    expect(fields.numradar_line_type).toBe('mobile')
    expect(fields.numradar_format_valid).toBe(true)
    expect(fields.numradar_last_checked_at).toBe(NOW)
    expect(fields.numradar_check_status).toBe('ok')
    expect(fields.numradar_wa_sendable).toBe(true)
    expect(fields).not.toHaveProperty('wid')
    expect(fields).not.toHaveProperty('numradar_wid')
  })

  it('is unknown when WhatsApp is yes but sendable is missing', () => {
    const fields = toCrmFields(
      { ...registered, line_type: null, wa_sendable: null },
      NOW,
    )
    expect(fields.numradar_whatsapp_registered).toBe(true)
    expect(fields.numradar_line_type).toBeNull()
    expect(fields.numradar_wa_sendable).toBeNull()
  })

  it('emits null for missing business, country, and link rather than empty strings or dashes', () => {
    const fields = toCrmFields(
      { ...registered, business: null, country: null, link: null, line_type: null },
      NOW,
    )
    expect(fields.numradar_business_name).toBeNull()
    expect(fields.numradar_country).toBeNull()
    expect(fields.numradar_wa_link).toBeNull()
    expect(fields.numradar_line_type).toBeNull()
    expect(fields.numradar_business_name).not.toBe('')
    expect(fields.numradar_country).not.toBe('-')
  })
})

describe('invalidCrmFields (422 body)', () => {
  it('is a successful item with format_valid false, not a missing field list', () => {
    const fields = invalidCrmFields('+1999', NOW)
    expect(fields.numradar_format_valid).toBe(false)
    expect(fields.numradar_check_status).toBe('invalid')
    expect(fields.numradar_whatsapp_registered).toBe(false)
    expect(fields.numradar_wa_sendable).toBe(false)
    expect(fields.phone).toBe('+1999')
    expect(fields).not.toHaveProperty('wid')
  })
})

describe('toValidateOutput', () => {
  it('keeps the checked phone and still never copies wid off the public result', () => {
    const out = toValidateOutput({ ...registered, phone: '+34600111222' }, 'fallback', NOW)
    expect(out.phone).toBe('+34600111222')
    expect(out.numradar_whatsapp_registered).toBe(true)
    expect(JSON.stringify(out)).not.toContain('wid')
  })
})

describe('toValidateOutput, a number the API reports in another spelling', () => {
  it('names the item by the number the workflow sent, not the corrected one', () => {
    // Since 2026-10-13 the API's `phone` is the form valid today and `input` is what was sent.
    // `phone` here identifies the item: a workflow merges on it, and may write it back to a CRM,
    // which the other integrations deliberately never do to the CRM's own number.
    const out = toValidateOutput(
      { ...registered, input: '+557191111805', phone: '+5571991111805' },
      '+55 71 9111-1805',
      NOW,
    )
    expect(out.phone).toBe('+557191111805')
  })

  it('falls back to the reported number for an API from before the field existed', () => {
    const out = toValidateOutput({ ...registered, phone: '+34600111222' }, 'fallback', NOW)
    expect(out.phone).toBe('+34600111222')
  })
})

describe('omitWid', () => {
  it('strips wid from nested bulk results', () => {
    const stripped = omitWid({
      job: {
        id: 'job-1',
        results: [{ phone: '+1', result: { whatsapp: true, wid: '1@c.us' } }],
      },
    })
    expect(JSON.stringify(stripped)).not.toContain('wid')
    expect(stripped).toEqual({
      job: {
        id: 'job-1',
        results: [{ phone: '+1', result: { whatsapp: true } }],
      },
    })
  })
})

describe('DEFAULT_API_BASE_URL', () => {
  it('matches the docs curl host, not the unowned api.numradar.com', () => {
    expect(DEFAULT_API_BASE_URL).toBe('https://api.numradar.app/v1')
    expect(`${DEFAULT_API_BASE_URL}/validate`).toBe('https://api.numradar.app/v1/validate')
    expect(DEFAULT_API_BASE_URL).not.toContain('api.numradar.com')
  })
})
