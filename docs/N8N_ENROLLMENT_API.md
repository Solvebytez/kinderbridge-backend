# n8n enrollment integration

## Environment (backend)

- `N8N_API_KEY` — shared secret; send as `X-N8N-API-Key` or `Authorization: Bearer <key>`
- `N8N_ENROLLMENT_WEBHOOK_URL` — optional; POST when parent queues automation

## Resolve daycare

`POST /api/enrollments/n8n/resolve-daycare`  
`GET /api/enrollments/n8n/resolve-daycare?name=...&city=...&region=...`

Body/query: `name`, `city`, `region` (all required).

**`region`** is the **geographic region name** stored on the daycare record (same as KinderBridge search `region` / `Daycare.region`), e.g. `Toronto`, `York Region`, `Peel Region`. It is **not** a province or state code (`ON`, `BC`, etc.).

Example:

```json
{
  "name": "Advanced Kids Daycare",
  "city": "Toronto",
  "region": "Toronto"
}
```

Response: `daycareId`, `form_metadata` (`form_id`, `form_url`, `service_name`), plus `name`, `city`, `region` echo.

## Get payload

`GET /api/enrollments/n8n/payload/:enrollmentId`

Returns full enrollment document including `payload` (n8n JSON schema).

## Callback

`POST /api/enrollments/n8n/callback`

```json
{
  "enrollmentId": "<mongo id>",
  "status": "submitted",
  "submission_date": "2026-05-21T10:30:00Z"
}
```

Or `status: "failed"`, `error: "message"`.

## Parent flow

1. Auto-apply creates `Application` + `EnrollmentSubmission` (prefilled).
2. Parent completes `/enrollment/:applicationId`.
3. `POST /api/enrollments/:id/queue-automation` triggers webhook.
