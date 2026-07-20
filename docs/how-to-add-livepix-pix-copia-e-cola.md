# How to integrate LivePix with raw PIX Copia e Cola

This document explains how to create payments via the LivePix gateway and
extract the **raw PIX Copia e Cola code** so users can paste it directly
into any Brazilian banking app — bypassing the LivePix checkout page.

---

## 1. Overview

LivePix's **public API** only returns a redirect URL (checkout page) when
you create a payment. The raw PIX code (the long string starting with
`000201...`) is not exposed publicly.

However, LivePix's own checkout page uses an **internal/undocumented
webservice** to render the PIX QR code and key. We can call that same
internal endpoint — mimicking a real browser — to extract the raw PIX code.

This gives us two modes:

| Mode         | User experience                                          |
|------------- |----------------------------------------------------------|
| PIX code OK  | "Copy PIX key" button → paste into banking app directly  |
| PIX code fail| Fallback to LivePix checkout URL → scan QR / copy there  |

---

## 2. Prerequisites

- A LivePix account with:
  - `client_id`
  - `client_secret`
- Your app must be approved by LivePix or their internal endpoints may
  refuse connections.
- Works only for BRL (Brazilian Real) — PIX is Brazil's instant payment
  system.

---

## 3. API endpoints

### 3.1 Public endpoints (documented)

| Method | Host              | Path                      | Purpose               |
|--------|-------------------|---------------------------|-----------------------|
| POST   | `oauth.livepix.gg`| `/oauth2/token`           | Get OAuth access token|
| POST   | `api.livepix.gg`  | `/v2/payments`            | Create a payment      |
| GET    | `api.livepix.gg`  | `/v2/payments?reference=X`| Check payment status  |

### 3.2 Internal endpoint (undocumented)

| Method | Host                      | Path                               | Purpose                  |
|--------|---------------------------|------------------------------------|--------------------------|
| POST   | `webservice.livepix.gg`  | `/checkout/payment/{checkoutId}`   | Fetch raw PIX code       |

**Request body:**

```json
{ "method": "pix" }
```

**Success response:**

```json
{ "code": "00020101021126..." }
```

**Required headers** (must mimic a Chrome browser, otherwise the endpoint
  may reject the request):

```
Content-Type: application/json
Accept: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7
sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
```

The `checkoutId` is extracted from the `redirectUrl` returned by the
payment creation endpoint. It is the last path segment:

```js
const checkoutId = redirectUrl.split('/').pop();
```

---

## 4. Step-by-step flow

### Step 1 — Get OAuth token

**Client Credentials** grant. Tokens are cached in memory with a 60-second
buffer before expiry to avoid unnecessary re-authentication.

```
POST https://oauth.livepix.gg/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={YOUR_CLIENT_ID}
&client_secret={YOUR_CLIENT_SECRET}
&scope=payments:write payments:read
```

**Response:**

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Cache the token and compute `expiresAt = Date.now() + (expires_in - 60) * 1000`.

### Step 2 — Create payment

```
POST https://api.livepix.gg/v2/payments
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "amount": 1990,
  "currency": "BRL",
  "redirectUrl": "https://t.me/your_bot_username"
}
```

`amount` is in **cents** (e.g. `1990` = R$ 19.90).

**Response:**

```json
{
  "data": {
    "reference": "some-unique-reference-id",
    "redirectUrl": "https://livepix.gg/checkout/some-uuid-here"
  }
}
```

### Step 3 — Extract checkout ID

```js
const checkoutId = response.data.redirectUrl.split('/').pop();
// → "some-uuid-here"
```

### Step 4 — Delay, then fetch raw PIX code

LivePix's backend needs a moment to propagate the new payment. Two
attempts with progressive delays (500ms, then 1200ms) are recommended.

```
POST https://webservice.livepix.gg/checkout/payment/{checkoutId}
Content-Type: application/json
Accept: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7
sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"

{ "method": "pix" }
```

**Success response:**

```json
{ "code": "00020101021126360014br.gov.bcb.pix..." }
```

The `code` field is the raw PIX Copia e Cola string — ready for the user
to paste into any banking app.

### Step 5 — Handle success and fallback

- **If `code` exists**: present a "Copy PIX key" button with the raw code.
  The user pastes it into their banking app — no need to leave your app.
- **If parsing fails** (network error, limit reached, etc.): **swallow the
  error silently** and fall back to showing the LivePix checkout URL.

Never throw on a PIX code fetch failure — it is a best-effort
optimisation, not the core payment flow.

---

## 5. Per-user rate limiting

The internal webservice is undocumented. To avoid abuse or potential
throttling/blocking, impose a per-user limit on raw PIX code generations.

Recommended config:

| Variable               | Default | Purpose                              |
|------------------------|---------|--------------------------------------|
| `LIMIT_PIX_ENABLED`    | `true`  | Toggle on/off                        |
| `MAX_PIX_GENERATIONS`   | `3`     | Max generations before fallback only |

When a user hits the limit, skip the internal webservice call entirely and
show them the checkout URL instead. Persist counts to a file or database.

```js
// Pseudocode
const limitEnabled = process.env.LIMIT_PIX_ENABLED === 'true';
const max = parseInt(process.env.MAX_PIX_GENERATIONS, 10) || 3;
const count = userCounts.get(userId) || 0;

if (!limitEnabled || count < max) {
  // ... call webservice.livepix.gg ...
  // on success: userCounts.set(userId, count + 1);
  // persist to disk/DB
} else {
  // skip — pixCode stays undefined → fallback to checkout URL
}
```

---

## 6. Check payment status

To verify whether the user actually paid (without relying solely on
webhooks):

```
GET https://api.livepix.gg/v2/payments?reference={paymentRef}
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "data": [
    {
      "reference": "...",
      "amount": 1990,
      "status": "completed"
    }
  ]
}
```

A payment is confirmed when a result is found and `amount > 0`. Poll
periodically (e.g. every 30 seconds) or let the user trigger a manual
check via a button.

---

## 7. Full code reference

From the existing project at `services/livepix.js`:

### OAuth with cache (lines 91–119)

```js
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const response = await urlEncodedRequest({
    hostname: 'oauth.livepix.gg',
    path: '/oauth2/token',
    body: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    },
  });

  cachedToken = response.access_token;
  tokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000;
  return cachedToken;
}
```

### Payment creation + PIX code fetch + rate limit (lines 121–207)

```js
async function createPayment({ amountCents, reference }) {
  const token = await getAccessToken();
  if (!token) throw new Error('Unable to obtain access token');

  const response = await request({
    method: 'POST',
    hostname: 'api.livepix.gg',
    path: '/v2/payments',
    headers: { Authorization: `Bearer ${token}` },
    body: { amount: amountCents, currency: 'BRL', redirectUrl: config.livepix.redirectUrl },
  });

  const paymentRef = response.data.reference;
  const checkoutUrl = response.data.redirectUrl;
  const checkoutId = checkoutUrl.split('/').pop();

  let pixCode;
  const userIdKey = String(reference);
  const currentCount = Number(userCounts.get(userIdKey) || 0);

  if (!limitEnabled || currentCount < maxGenerations) {
    for (const ms of [500, 1200]) {
      await delay(ms);
      try {
        const internal = await request({
          method: 'POST',
          hostname: 'webservice.livepix.gg',
          path: `/checkout/payment/${checkoutId}`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
          },
          body: { method: 'pix' },
        });
        if (internal && internal.code) {
          pixCode = internal.code;
          userCounts.set(userIdKey, currentCount + 1);
          persistCounts();
          break;
        }
      } catch {
        // retry after next delay
      }
    }
  }

  pendingPayments.set(paymentRef, { reference: paymentRef, userId: reference, timestamp: Date.now() });
  return { reference: paymentRef, checkoutUrl, pixCode };
}
```

### Payment verification (lines 210–229)

```js
async function checkPayment(reference) {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await request({
    method: 'GET',
    hostname: 'api.livepix.gg',
    path: `/v2/payments?reference=${encodeURIComponent(reference)}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data && response.data.length > 0 ? response.data[0] : null;
}
```

### Polling loop (lines 231–260)

```js
function startPolling(bot) {
  setInterval(async () => {
    for (const [ref, entry] of pendingPayments.entries()) {
      if (entry.confirmed) continue;
      const payment = await checkPayment(ref);
      if (payment && payment.amount > 0) {
        entry.confirmed = true;
        await notifyUser(entry.userId, 'Payment confirmed!');
        pendingPayments.delete(ref);
      }
    }
  }, 30000); // 30 seconds
}
```

---

## 8. Telegram UI integration example

When presenting the payment to the user, branch on whether `pixCode` is
available:

```js
const keyboard = Markup.inlineKeyboard([
  [
    result.pixCode
      // Direct copy — user never leaves Telegram
      ? { text: '📋 Copiar chave Pix', copy_text: { text: result.pixCode } }
      // Fallback — open LivePix checkout
      : { text: '💳 Pagar agora', url: result.checkoutUrl },
  ],
  [
    { text: '✅ Verificar pagamento', callback_data: `verify_${result.reference}` },
  ],
]);

if (result.pixCode) {
  await ctx.reply(
    `Pague via Pix Copia e Cola:\n\n` +
    `Toque no botão acima para copiar a chave e cole no app do seu banco.\n\n` +
    `<blockquote><code>${result.pixCode}</code></blockquote>`,
    { parse_mode: 'HTML', ...keyboard }
  );
} else {
  await ctx.reply(
    `Acesse o link abaixo para pagar via LivePix:\n\n${result.checkoutUrl}`,
    { parse_mode: 'HTML', ...keyboard }
  );
}
```

The `copy_text` feature on Telegram inline keyboards allows one-tap
copying of the raw PIX code — no need for the user to long-press or
manually select text.

---

## 9. Retry & delay rationale

The initial implementation used a single 1500ms delay before the internal
webservice call. This was later refined to two progressive retries
(500ms → 1200ms) because:

- LivePix's backend is eventually consistent — the new payment may not
  be immediately queryable via the internal endpoint.
- A short first retry catches payments that propagate quickly.
- A longer second retry catches the rest.
- If both fail, it falls through to the checkout URL — harmless.

---

## 10. Caveats

- **Undocumented endpoint**: `webservice.livepix.gg` is not part of
  LivePix's public API. It may change, move, or be blocked at any time
  without notice. Always have the checkout-URL fallback.
- **Browser fingerprinting**: The Chrome-like headers (User-Agent,
  sec-ch-ua, Accept-Language=pt-BR) are essential. Requests without
  them may be rejected or rate-limited.
- **BRL only**: PIX is a Brazilian payment rail. This technique only
  works with `currency: "BRL"`.
- **No webhook fallback**: The polling approach here works, but for
  production you should also register a webhook URL so LivePix can
  notify you of payment confirmations instantly.

---

## 11. Environment variables reference

| Variable                | Required | Default                       | Description                            |
|-------------------------|----------|-------------------------------|----------------------------------------|
| `LIVEPIX_CLIENT_ID`     | Yes      | —                             | OAuth client ID                        |
| `LIVEPIX_CLIENT_SECRET` | Yes      | —                             | OAuth client secret                    |
| `LIVEPIX_SCOPE`         | No       | `payments:write payments:read`| OAuth scopes                           |
| `LIVEPIX_REDIRECT_URL`  | Yes      | —                             | Any URL to redirect post-payment       |
| `LIMIT_PIX_ENABLED`     | No       | `true`                        | Enable per-user PIX generation limit   |
| `MAX_PIX_GENERATIONS`   | No       | `3`                           | Max raw PIX code fetches per user      |

---

## 12. Key files in the reference project

| File                                 | What it does                                    |
|--------------------------------------|-------------------------------------------------|
| `services/livepix.js:91–119`         | OAuth token caching                             |
| `services/livepix.js:121–207`         | createPayment: public API + internal webservice + rate limit |
| `services/livepix.js:210–229`         | checkPayment: verify status                     |
| `services/livepix.js:231–260`         | startPolling: 30s background poll               |
| `index.js:310–374`                    | Telegram UI integration (pixCode vs fallback)   |
| `pix_counts.json`                     | Per-user generation count persistence           |
| `docs/ADR/001-livepix-pix-code-fallback.md` | Architecture Decision Record              |
