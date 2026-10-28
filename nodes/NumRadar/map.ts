/**
 * Mirrors the CRM write-back field map NumRadar's own integrations use (HubSpot, Zapier, n8n).
 *
 * This package cannot import `@numradar/core`: n8n verification forbids runtime npm
 * dependencies. Keep the field names and the null-vs-empty-string behaviour identical so
 * HubSpot/Zapier/n8n cannot invent a second write-back group. Never emit `wid`.
 */

export const DEFAULT_API_BASE_URL = 'https://api.numradar.app/v1'

export interface PublicResultLike {
  /** The number as sent. Absent from an API deployed before 2026-10-13. */
  input?: string
  /** The number in the form valid today, which can differ from `input`. */
  phone?: string
  valid: boolean
  whatsapp: boolean
  is_business: boolean
  business?: { name?: string | null } | null
  link: string | null
  line_type: string | null
  wa_sendable: boolean | null
  country?: { code?: string | null } | null
}

export interface CrmFields {
  numradar_whatsapp_registered: boolean
  numradar_is_business: boolean
  numradar_business_name: string | null
  numradar_wa_link: string | null
  numradar_country: string | null
  numradar_line_type: string | null
  numradar_format_valid: boolean
  numradar_last_checked_at: number
  numradar_check_status: 'ok' | 'invalid' | 'error'
  numradar_wa_sendable: boolean | null
}

export type ValidateOutput = CrmFields & { phone: string }

export function toCrmFields(result: PublicResultLike, now: number): CrmFields {
  return {
    numradar_whatsapp_registered: result.whatsapp,
    numradar_is_business: result.is_business,
    numradar_business_name: result.business?.name ?? null,
    numradar_wa_link: result.link,
    numradar_line_type: result.line_type,
    numradar_country: result.country?.code ?? null,
    numradar_format_valid: result.valid,
    numradar_last_checked_at: now,
    numradar_check_status: result.valid ? 'ok' : 'invalid',
    // Pass through the DTO field. Re-ANDing here would let CRM drift from JSON the customer saw.
    numradar_wa_sendable: result.wa_sendable,
  }
}

/** A 422 is an invalid number, not a workflow error. Same field group as a mapped check. */
export function invalidCrmFields(phone: string, now: number): ValidateOutput {
  return {
    phone,
    numradar_whatsapp_registered: false,
    numradar_is_business: false,
    numradar_business_name: null,
    numradar_wa_link: null,
    numradar_country: null,
    numradar_line_type: null,
    numradar_format_valid: false,
    numradar_last_checked_at: now,
    numradar_check_status: 'invalid',
    numradar_wa_sendable: false,
  }
}

/**
 * `phone` names the item by the number the workflow sent, not by the API's corrected `phone`. A
 * workflow merges on it and may write it back to a CRM; the other integrations never touch the
 * CRM's number at all, and a Brazilian mobile rewritten with its ninth digit would no longer match
 * the record it came from.
 */
export function toValidateOutput(result: PublicResultLike, fallbackPhone: string, now: number): ValidateOutput {
  return {
    phone: result.input ?? result.phone ?? fallbackPhone,
    ...toCrmFields(result, now),
  }
}

/**
 * Strip `wid` from any JSON we forward. The public API includes it on PublicResult; the
 * CRM write-back group deliberately does not (GDPR minimization). A bulk poll that
 * passed the raw job through would reintroduce it.
 */
export function omitWid<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitWid(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'wid') continue
      out[key] = omitWid(nested)
    }
    return out as T
  }
  return value
}

export function stripTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}
