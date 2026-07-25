# Remarketing Burst Phase — Implementation Plan

## Summary
Add a configurable "burst phase" to remarketing: fast interval (e.g. 5 min) for first N days from /start, then auto-switch to normal daily interval. All settings configurable via frontend.

---

## 1. Type Changes

### `server/src/bot/remarketing.ts`

```ts
export type RemarketingConfig = {
  // existing
  enabled: boolean;
  intervalMs: number;            // normal interval (e.g. 86400000 = 24h)
  maxSends: number;
  messages: MessageStep[];
  discountOffer: DiscountOfferConfig;
  skipStale: boolean;
  initialDelayMs: number;
  // NEW
  burstIntervalMs: number;       // 0 = disabled, min 60000
  burstDurationMs: number;       // e.g. 172800000 = 2 days
  burstCycleMessages: boolean;   // true = cycle, false = send each once & stop
  useSeparateBurstMessages: boolean;
  burstMessages: MessageStep[];  // only used if useSeparateBurstMessages
};
```

Defaults: all new fields = 0/false/[] — existing bots unaffected.

### `frontend/src/lib/api.ts` — mirror same type.

---

## 2. DB Migration

### `server/prisma/schema.prisma` — `RemarketingState` model, add:
```prisma
burstUntil DateTime? // NULL = no burst or expired
```

### Migration SQL
```sql
ALTER TABLE "remarketing_states" ADD COLUMN "burstUntil" TIMESTAMP(3);
```

---

## 3. Idempotency — Advance Before Send

`server/src/services/remarketingQueue.ts`

Call `advanceState` BEFORE `sendRemarketingStep`. If send fails:
- Timeout → already advanced, skip (message likely delivered)
- Other error → log and skip, don't retry → zero duplicates

Tradeoff: user may skip 1 message position on non-timeout errors. Acceptable at scale.

---

## 4. Reschedule on Restart — Silently Drop Past-Due

`rescheduleAllRemarketingJobs()`: remove `gt: now` filter. For past-due states, skip missed message and schedule next from `now + activeInterval`.

---

## 5. Burst Logic

### 5a. `/start` trigger (`handlers.ts:864`)
```ts
burstUntil = burst enabled ? new Date(Date.now() + burstDurationMs) : null
firstDelay = burst enabled ? burstIntervalMs : initialDelayMs
// upsert RemarketingState with burstUntil
```

### 5b. Helpers (`remarketing.ts`)
```ts
getActiveInterval(state, config): number  // burstIntervalMs vs intervalMs
getActiveMessages(state, config): MessageStep[]  // burstMessages vs messages
```

### 5c. `advanceState` (`remarketingQueue.ts:258`)
- Determine activeInterval + activeMessages from burst state
- If burst expired & switching from burstMsgs → reset nextIndex = 0
- If `!burstCycleMessages` & completed 1 cycle → silence until burst ends, then normal
- Schedule next PgBoss job at activeInterval

### 5d. Stale detection uses activeInterval (not config.intervalMs)

---

## 6. Dynamic Concurrency

At startup: check if any active bot has burst enabled.
```
burst true → CONCURRENCY = 30
burst false → CONCURRENCY = 5
```

---

## 7. PgBoss Singleton Config

```ts
new PgBoss(dbUrl, { singletonMinutes: 4320 })  // 72 hours
```

---

## 8. Frontend

`RemarketingEditor.tsx` — add burst section:
- Enable toggle
- Burst interval: preset dropdown + custom
- Burst duration: number + unit (hours/days)
- Cycle toggle
- Separate messages toggle → conditional MessageFlowEditor

---

## 9. Files

| File | Change |
|------|--------|
| `server/src/bot/remarketing.ts` | Types, normalize, helpers |
| `server/src/bot/handlers.ts:864` | burstUntil on /start |
| `server/src/services/remarketingQueue.ts` | Burst logic, idempotency, reschedule, concurrency, PgBoss config |
| `server/prisma/schema.prisma:158` | burstUntil column |
| `server/prisma/migrations/` | New migration |
| `frontend/src/lib/api.ts:130` | Type |
| `frontend/src/components/forms/RemarketingEditor.tsx` | Burst UI |

---

## 10. Scaling Notes

- 10K users × 5-min burst × 30 workers → drains ~17 min per cycle (acceptable lag for burst)
- DB connections: ~30 (PgBoss) + 20 (Prisma) + 5 (analytics) = ~55 (safe under 100)
- PgBoss job table: ~2.88M rows/day, 7-day archive = ~20M rows (fine)
- If user count doubles, queue lag doubles → consider batch poller architecture
