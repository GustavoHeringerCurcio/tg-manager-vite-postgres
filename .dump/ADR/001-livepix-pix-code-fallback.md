# ADR-001: LivePix PIX Code via Internal Webservice

## Status
Active

## Context
The LivePix public API's `createPayment` response only returns a `redirectUrl`
(checkout page). To show the PIX copy-paste code directly inside Telegram,
an internal webservice endpoint is needed.

## Endpoint
`POST https://webservice.livepix.gg/checkout/payment/{checkoutId}`

Headers:
- `Content-Type: application/json`
- `Accept: application/json`

Body:
```json
{ "method": "pix" }
```

Success response (example):
```json
{ "code": "00020101021126..." }
```

The `checkoutId` is extracted from the `redirectUrl` by taking the last path
segment: `redirectUrl.split('/').pop()`.

## Implementation notes
- A 1.5s delay (`delay(1500)`) is applied before the request to allow the
  LivePix backend to propagate the new payment.
- Failures are silently swallowed &mdash; `pixCode` stays `undefined` and the
  flow falls back to showing the checkout URL.
- This is a best-effort fallback; the pix code is not guaranteed.

## Key files
- `services/livepix.js:120-139` &mdash; the request and error handling
- `index.js:248-265` &mdash; how the returned `pixCode` is used in the
  Telegram message
