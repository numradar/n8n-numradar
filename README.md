# n8n-nodes-numradar

n8n community node for [NumRadar](https://numradar.app): check whether a phone number is registered on WhatsApp, and create or poll bulk jobs.

This package is for **self-hosted n8n**. n8n Cloud cannot install unverified community nodes. Until this node is verified, Cloud users should use the HTTP Request recipe on [numradar.app/docs](https://numradar.app/docs#n8n) — same URL, same Bearer key.

## Install (self-hosted)

Settings → Community Nodes → Install → `n8n-nodes-numradar`.

Or from the host:

```bash
npm install n8n-nodes-numradar
```

## Credentials

Create a NumRadar API credential:

- **API Key** — dashboard key, sent as `Authorization: Bearer nr_live_…`
- **API Base URL** — defaults to `https://api.numradar.app/v1` (the same host as the docs curl examples). Leave it unless you are pointing at a local API.

The credential test calls `GET {API Base URL}/balance`.

## Operations

| Operation | API | Notes |
| --- | --- | --- |
| Validate Number | `POST /validate` | Write. Uses one validation from the plan allowance on a definitive result. |
| Create Bulk Job | `POST /bulk` | Queues a list. Returns a job id immediately. |
| Get Bulk Job | `GET /bulk/:id` | Counters by default; optional paged `include=results`. |

Output field names are the CRM write-back group (`numradar_whatsapp_registered`, `numradar_format_valid`, …). The node never emits `wid`.

## Worked example: Validate Number

Same request as the HTTP Request recipe on `/docs`:

```
POST https://api.numradar.app/v1/validate
Authorization: Bearer nr_live_…
Content-Type: application/json

{ "phone": "{{ $json.phone }}" }
```

In n8n:

1. Add the **NumRadar** node.
2. Create a credential with your `nr_live_…` key.
3. Operation: **Validate Number**.
4. Phone: `{{ $json.phone }}`.

A **422** is an invalid number. It is **not billed** and does **not** fail the workflow. The item comes out as:

```json
{
  "phone": "+1999",
  "numradar_format_valid": false,
  "numradar_whatsapp_registered": false,
  "numradar_check_status": "invalid"
}
```

A registered number maps to `numradar_whatsapp_registered: true`.

Other statuses:

- **402** — out of validations (`quota_exceeded`): this period's plan allowance is used up. Upgrade the plan, or wait for it to renew.
- **403** — API access starts at Starter+.
- **429** — rate limited. Back off using `Retry-After`.

## License

MIT
