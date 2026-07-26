# Remarketing Not Working — Root Cause Analysis & Complete Fix Plan

**Status:** Bug active — 0 remarketing messages ever sent  
**Affected bot:** dudinha (`cmrtssu370000jv01w5n8y3sa`), ACTIVE, 17 remarketing messages configured  
**Environment:** `botflix_test`, pg-boss v12.26.2 (schema v37), PostgreSQL 16, Node.js 20+, pnpm monorepo  
**Date:** 2026-07-26

---

## 1. Summary

Remarketing is **completely broken** — zero jobs are ever created in pg-boss, zero messages are sent. The root cause is that `boss.send("remarketing", ...)` throws `"Queue remarketing does not exist"` because pg-boss v12 requires explicit queue creation before `send()`, and the startup sequence never calls `boss.createQueue("remarketing")`.

Additionally, 12 secondary gaps were discovered across frontend, API, queue infrastructure, error handling, and observability that compound the problem and prevent diagnosis/recovery.

---

## 2. Database Evidence

| Table | Row count | Key findings |
|---|---|---|
| `bots` | 2 (dudinha=ACTIVE, kk=INACTIVE) | Dudinha has `remarketing.enabled=true`, 17 messages, `intervalMs=60000`, `maxSends=17`, discount tiers enabled |
| `remarketing_states` | 3 rows | All: `pgBossJobId=null`, `lastError=null`, `totalSent=0`, `nextIndex=0`, `nextSendAt` in past |
| `pgboss.job` | **0 rows** | No jobs were ever created, not even failed ones |
| `pgboss.queue` | 1 row (`__pgboss__send-it` only) | **No `remarketing` queue row** |
| `pgboss.subscription` | 0 rows | Expected in v12 — uses in-memory workers, not DB subscriptions |
| `pgboss.version` | version=37 | Compatible with pg-boss v12.26.2 |
| `pgboss.bam` | 0 rows | Maintenance ran successfully (bam_on is current) |
| `global_config` | 1 row | `barkAlertEnabled=true`, `callbackCooldownMs=7000`, etc. No remarketing-related fields |

**Confirmed:** The remarketing JSON config is valid and correctly parsed by `normalizeRemarketing()`. The `/start` handler's `prisma.remarketingState.upsert()` succeeds. The failure is exclusively in `scheduleRemarketingJob()` → `boss.send()`.

---

## 3. Root Cause (Primary)

### 3.1 The Exact Failure

`boss.send("remarketing", ...)` **throws** `"Queue remarketing does not exist"` on every invocation. It does **not** return `null` — it throws an `Error`.

### 3.2 How `boss.send()` Works in pg-boss v12

```
boss.send(name, data, options)
  └─ createJob(request)                           [manager.js:771]
       └─ getQueueCache(name)                     [manager.js:494]
            └─ getQueue(name)                     [queries pgboss.queue table]
                 └─ if row is null → throw Error("Queue {name} does not exist")  [manager.js:501-503]
```

Every `boss.send()` call first resolves the queue via `getQueueCache()`. This queries the `pgboss.queue` table. If the row doesn't exist, it **throws** — not returns null, it throws an `Error`.

### 3.3 Why the Queue Was Never Created

The only place that calls `boss.createQueue("remarketing")` is `ensureBossInitialized()` at `remarketingQueue.ts:39`:

```typescript
async function ensureBossInitialized(): Promise<PgBoss> {
  if (boss && initialized) return boss;          // ← FATAL EARLY RETURN (line 36)
  await initRemarketingQueue();
  if (!boss) throw new Error(...);
  await boss.createQueue("remarketing")           // ← ONLY CALL TO createQueue (line 39)
    .catch(() => logger.warn(...));               // ← .catch() swallows errors → NOT surfaced
  await startRemarketingWorker()                  // ← job runner → does NOT auto-create queue
    .catch(() => logger.warn(...));
  return boss;
}
```

The startup sequence in `server.ts:251-261`:

```typescript
await initRemarketingQueue();          // (1) Creates PgBoss, boss.start(), sets initialized=true
await loadActiveBots(...);             // (2) BotManager constructors → normalizeRemarketing()
if (isPrimaryWorker) {
    await startRemarketingWorker();     // (3) boss.work() → in-memory worker, no queue creation
    await rescheduleAllRemarketingJobs(); // (4) ensureBossInitialized() → EARLY RETURNS
    startPaymentPoller();
}
```

| Step | What happens | Queue created? |
|---|---|---|
| (1) `initRemarketingQueue()` | Creates PgBoss, `boss.start()`, sets `initialized=true` | No — only internal queues |
| (2) `loadActiveBots()` | BotManager constructors run `normalizeRemarketing()` | No |
| (3) `startRemarketingWorker()` | `boss.work("remarketing", handler)` — in-memory only | **No** — verified in pg-boss v12 source |
| (4) `rescheduleAllRemarketingJobs()` | Calls `ensureBossInitialized()` → `if (boss && initialized) return boss;` → **skips createQueue** | No |

On every `/start` request, `scheduleRemarketingJob()` calls `ensureBossInitialized()`, which hits the early return. `boss.send()` throws `"Queue remarketing does not exist"`.

### 3.4 Why the Error Is Silent (Triple-Silence Problem)

**Layer 1 — `/start` handler catch** (`handlers.ts:893-896`): Wraps remarketing scheduling in `try/catch`, logs error to server console only. **Zero user-facing visibility, zero admin-panel visibility.**

**Layer 2 — `scheduleRemarketingJob` null-handler** (`remarketingQueue.ts:154-167`): Only handles `boss.send()` returning `null`. When `boss.send()` **throws**, the code never reaches this branch. `lastError` is never set on the `RemarketingState`.

**Layer 3 — Frontend ignores error data** (`BotRemarketingStatusPage.tsx`): The API does return `lastError` and `pgBossJobId` per-state, but the frontend table doesn't display these columns. The diagnostic endpoint (`GET /.../remarketing/diagnostic`) has **no frontend UI wired up**.

**Net result:** `RemarketingState` rows look healthy (`lastError=null`, just waiting), but the truth is `boss.send()` threw every time and the error is invisible at every layer.

### 3.5 Why `boss.work()` Doesn't Create the Queue

Verified in pg-boss v12.26.2 source (`manager.js:532-613`): `boss.work()` creates an in-memory `Worker` and adds it to a `Map`. It does **not** call `getQueueCache()`, `getQueue()`, or `createQueue()`. The queue must exist in `pgboss.queue` **before** `send()` is called.

---

## 4. Additional Issues Found (Secondary)

### 4.1 — INFRASTRUCTURE: `advanceState()` advances before sending, losing messages silently

**File:** `remarketingQueue.ts:375-377`

```typescript
await advanceState(state, config);     // ← moves state forward (totalSent++, nextIndex++)
try {
    await sendRemarketingStep({...});  // ← sends the message
} catch (error) {
    remarketingSendFailed.inc(...);    // ← counts failure but does NOT re-throw
}
```

If `sendRemarketingStep()` throws, the state has already advanced. The message is permanently skipped, `totalSent` still counts, and pg-boss considers the job successful (the handler returned normally). The user receives nothing for that cycle.

### 4.2 — INFRASTRUCTURE: Orphaned states when pg-boss is down during `advanceState()`

**File:** `remarketingQueue.ts:422-436`

```typescript
const activeBoss = await ensureBossInitialized().catch(() => null);
if (!activeBoss) {
    await prisma.remarketingState.update({
        data: { nextSendAt: null, lastError: "pg-boss unavailable — re-trigger via /start or admin API" }
    });
}
```

States with `nextSendAt=null` are invisible to `rescheduleAllRemarketingJobs()` (filters on `nextSendAt != null`). No periodic background task scans for and revives these. They require manual admin intervention or user `/start`.

### 4.3 — INFRASTRUCTURE: States with `pgBossJobId=null` but `nextSendAt != null` not auto-recovered

When `boss.send()` returns null (or throws, post-fix), states are left with a valid `nextSendAt` and no active pg-boss job. The only automatic recovery is server restart (`rescheduleAllRemarketingJobs`).

### 4.4 — INFRASTRUCTURE: No dead letter queue

Failed jobs after 3 pg-boss retries (every 60s, no exponential backoff) are permanently lost. No separate dead letter queue captures them.

### 4.5 — INFRASTRUCTURE: Linear retry only, no exponential backoff

```typescript
const RETRY_LIMIT = 3;
const RETRY_DELAY_SECONDS = 60;   // every 60 seconds, 3 attempts → 3 minutes total
```

No increasing delay between retries. A 3-minute external outage burns all retries.

### 4.6 — API: `simulate-confirm` doesn't cancel remarketing

**File:** `server.ts:132-231`

The `/api/bots/:botId/payment/simulate-confirm` endpoint manually confirms a transaction and sends deliverables but **never calls `cancelRemarketingForUser()`** — unlike the real payment flow (callback + poller). This means simulated payment tests leave remarketing running.

### 4.7 — API: Blocking a user doesn't immediately clean up remarketing

**File:** `chat.ts:164-179` (PATCH user endpoint)

When an admin blocks a user via `PATCH /api/bots/:id/users/:uid`, the remarketing state persists until the next scheduled job fires and `handleRemarketingJob` detects `state.user.isBlocked`. There's no immediate cascade cleanup.

### 4.8 — FRONTEND: `lastError` and `pgBossJobId` not displayed in admin panel

**File:** `frontend/src/pages/BotRemarketingStatusPage.tsx`

The API returns these fields, and the `RemarketingStateItem` type (`api.ts:168-178`) maps them. But the status page table has no column for them. An admin inspecting remarketing states sees `nextSendAt`, `totalSent`, and a toggle — but zero indication of whether the job is actually running or what error occurred.

### 4.9 — FRONTEND: Diagnostic & trigger endpoints have no UI

| Endpoint | Purpose | Frontend exists? |
|---|---|---|
| `GET /.../remarketing/diagnostic` | Per-state errors, pastDue count, pg-boss health | **No UI** |
| `POST /.../remarketing/trigger` | Send next message immediately for one user | **No UI** |

Admins would need to use `curl` or browser dev tools to access these.

### 4.10 — FRONTEND: No validation when saving remarketing config

When `remarketing.enabled=true`, the frontend doesn't validate:
- That at least 1 message step exists (`messages.length > 0`)
- That `intervalMs >= 60000` (server-side minimum enforced by `normalizeRemarketing`)
- That `maxSends` is non-negative

Saving an invalid config causes the **next** `/start` handler's `normalizeRemarketing()` to throw, which would crash the BotManager constructor and prevent the bot from loading.

### 4.11 — OBSERVABILITY: No Prometheus gauge for stuck/orphaned states

Existing metrics cover jobs scheduled/failed/sent but have **no gauge** for:
- Count of states with `pgBossJobId=null` that should be active
- Count of past-due states (`nextSendAt < NOW()`)
- Count of states orphaned by `advanceState` (nextSendAt=null)
This means no Grafana alert can fire when states accumulate dead.

### 4.12 — OBSERVABILITY: 12+ errors silently swallowed in `remarketingQueue.ts`

`.catch(() => {})` or `} catch { }` is used throughout the file, suppressing errors for: boss stop on re-init, hasActiveBurst failures, state updates after null-send/failed-send, pg-boss cancellation failures, delete-blocked/disabled state failures, burst-silence update failures. This makes root cause diagnosis nearly impossible when infrastructure fails.

### 4.13 — BUG: `findPaymentButtonAcross` misses burst messages

**File:** `handlers.ts:1146`

```typescript
// CURRENT: only searches main messages, not burstMessages
const foundButton = findPaymentButtonAcross(
    [messageFlow, remarketing.messages],
    buttonId
);
```

If a user clicks a `LIVEPIX_PAYMENT` button on a burst message (when `useSeparateBurstMessages=true`), the callback handler won't find it and payment won't trigger.

### 4.14 — CONFIG: No remarketing fields in GlobalConfig

All remarketing tuning is per-bot only. No global knobs for: retry limit, stale threshold, orphan-recovery interval, alert thresholds. Batch-tuning across bots requires individual edits.

---

## 5. Fix Plan

### PHASE 1 — Critical: Make Remarketing Actually Work

These fixes directly address the root cause and prevent silent failures.

---

#### Fix 1: Create Queue in `startRemarketingWorker()` (Critical)

**File:** `server/src/services/remarketingQueue.ts`  
**Lines:** 96-118

Add `await boss.createQueue("remarketing")` **before** `boss.work()`:

```typescript
export async function startRemarketingWorker(): Promise<void> {
  if (workerStarted) return;
  if (!boss) throw new Error("remarketing queue not initialized — call initRemarketingQueue first");

  await boss.createQueue("remarketing");  // ← ADD: ensures queue exists in pgboss.queue table

  let useBurst = false;
  try {
    useBurst = await hasActiveBurst();
  } catch (err) {
    logger.warn(`[remarketing-queue] hasActiveBurst failed, falling back to normal concurrency: ${err instanceof Error ? err.message : String(err)}`);
  }

  const concurrency = useBurst ? BURST_CONCURRENCY : NORMAL_CONCURRENCY;
  logger.info(`[remarketing-queue] starting worker with concurrency=${concurrency} (burst=${useBurst})`);

  await boss.work("remarketing", { localConcurrency: concurrency }, async (jobs) => {
    for (const job of jobs) {
      await handleRemarketingJob(job.data.stateId);
    }
  });

  workerStarted = true;
  logger.info("[remarketing-queue] worker started");
}
```

`createQueue()` is idempotent (pg-boss uses `ON CONFLICT DO NOTHING` internally), so it's safe to call on every startup.

---

#### Fix 2: Remove Early-Return from `ensureBossInitialized()` (Critical)

**File:** `server/src/services/remarketingQueue.ts`  
**Lines:** 35-46

The early return `if (boss && initialized) return boss;` skips queue creation and worker start on every subsequent call. Change to always ensure:

```typescript
async function ensureBossInitialized(): Promise<PgBoss> {
  if (!boss || !initialized) {
    await initRemarketingQueue();
    if (!boss) throw new Error("pg-boss failed to initialize — remarketing cannot be scheduled");
  }
  // Always ensure queue and worker exist (createQueue and work() are idempotent):
  await boss.createQueue("remarketing").catch(() =>
    logger.warn("[remarketing-queue] createQueue failed")
  );
  if (!workerStarted) {
    await startRemarketingWorker().catch(() =>
      logger.warn("[remarketing-queue] ensureBossInitialized: worker start failed")
    );
  }
  return boss;
}
```

This ensures that even if the startup sequence is modified or the first call is from an HTTP request, every code path ensures the queue exists and the worker is running.

---

#### Fix 3: Handle Both Throw and Null from `boss.send()` (High)

**File:** `server/src/services/remarketingQueue.ts`  
**Lines:** 134-169

The current code only handles `boss.send()` returning null. When it throws, the error propagates past the null-handler, `lastError` is never set, and the state looks healthy. Change to catch both:

```typescript
export async function scheduleRemarketingJob(userId: string, botId: string, delayMs: number): Promise<void> {
  const activeBoss = await ensureBossInitialized();

  const state = await prisma.remarketingState.findUnique({
    where: { userId_botId: { userId, botId } },
    select: { id: true }
  });
  if (!state) return;

  const nextSendAt = new Date(Date.now() + delayMs);
  const startAfter = Math.ceil(Math.max(delayMs, 0) / 1000);

  let jobId: string | null = null;
  let sendError: string | null = null;

  try {
    jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
      startAfter,
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS,
      singletonKey: `remarketing-${state.id}`,
      singletonSeconds: SINGLETON_SECONDS
    });
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  }

  if (jobId) {
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: { pgBossJobId: jobId, nextSendAt, retries: 0, lastError: null }
    });
    remarketingJobsScheduled.inc({ bot_id: botId });
    logger.info(`[remarketing:${botId}] scheduled job ${jobId} for user ${userId} in ${startAfter}s`);
  } else {
    const reason = sendError ?? "boss.send returned null — possible singleton collision";
    remarketingJobsFailed.inc({ bot_id: botId, reason: "send_failed" });
    logger.warn(`[remarketing:${botId}] boss.send failed for user ${userId}: ${reason}`);
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: { lastError: reason.length > 500 ? reason.slice(0, 497) + "..." : reason, retries: 0 }
    }).catch(() => {});
  }
}
```

After this fix, the `RemarketingState.lastError` column will contain the actual error message (e.g., `"Queue remarketing does not exist"`), making it diagnosable from the database directly.

---

### PHASE 2 — High: Fix Silent Data Loss & Recovery

---

#### Fix 4: Don't Advance State Before Sending Succeeds (High)

**File:** `server/src/services/remarketingQueue.ts`  
**Lines:** 375-397

Currently `advanceState()` is called before `sendRemarketingStep()`. If the send throws, the state has already moved forward (totalSent++, nextIndex++, next job scheduled) but the user received nothing. Swap the order so the message is sent first, and re-throw on failure so pg-boss retries:

```typescript
// Send first — if it fails, pg-boss will retry and state hasn't changed
try {
  await sendRemarketingStep({
    telegram: manager.telegram,
    chatId: String(state.user.telegramId),
    step,
    botId: state.botId,
    userId: state.userId,
    sessionId: session?.id ?? null,
    firstName: state.user.firstName,
    timeCompliments,
    applyDiscount,
    discountPercentage,
    labelTemplate: config.discountOffer.labelTemplate,
    showOriginalPrice: config.discountOffer.showOriginalPrice
  });
  remarketingSent.inc({ bot_id: state.botId });
} catch (error) {
  remarketingSendFailed.inc({ bot_id: state.botId });
  const message = error instanceof Error ? error.message : "remarketing send failed";
  logger.error(`[remarketing:${state.botId}] send failed: ${message}`);
  throw error;  // ← Re-throw so pg-boss retries the job (up to RETRY_LIMIT times)
}

// Only advance after confirmed delivery
await advanceState(state, config);
```

**Important behavioral change:** Previously, a failed send would silently advance the state (skip message). Now, a failed send triggers pg-boss's retry mechanism. After `RETRY_LIMIT` (3) failed attempts, pg-boss marks the job as failed permanently.

---

#### Fix 5: Add Orphaned-State Recovery on Startup (High)

**File:** `server/src/services/remarketingQueue.ts` (new function)  
**File:** `server/src/server.ts` (call site)

When pg-boss is down during `advanceState()`, states get `nextSendAt=null` and are permanently invisible to `rescheduleAllRemarketingJobs()`. Add a recovery function that finds and revives these on server restart:

```typescript
export async function recoverOrphanedRemarketingStates(): Promise<void> {
  const states = await prisma.remarketingState.findMany({
    where: {
      nextSendAt: null,
      bot: { status: BotStatus.ACTIVE }
    },
    select: { id: true, botId: true, userId: true }
  });

  let recovered = 0;
  for (const state of states) {
    try {
      const bot = await prisma.bot.findUnique({
        where: { id: state.botId },
        select: { remarketing: true }
      });
      if (!bot) continue;

      const config = normalizeRemarketing(bot.remarketing);
      if (!config.enabled) continue;

      const nextSendAt = new Date(Date.now() + config.intervalMs);
      await prisma.remarketingState.update({
        where: { id: state.id },
        data: { nextSendAt, lastError: "recovered orphaned state on startup" }
      });
      await scheduleRemarketingJob(state.userId, state.botId, config.intervalMs);
      recovered++;
    } catch (err) {
      logger.warn(`[remarketing-queue] failed to recover orphaned state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (recovered > 0) {
    logger.info(`[remarketing-queue] recovered ${recovered} orphaned remarketing states`);
  }
}
```

In `server.ts`, add the call after `rescheduleAllRemarketingJobs()`:

```typescript
if (isPrimaryWorker) {
    await startRemarketingWorker();
    await rescheduleAllRemarketingJobs();
    await recoverOrphanedRemarketingStates();  // ← ADD
    startPaymentPoller();
}
```

Export `recoverOrphanedRemarketingStates` from `remarketingQueue.ts`.

---

### PHASE 3 — Medium: Observability & Admin Visibility

---

#### Fix 6: Display `lastError` in Admin Status Page (Medium)

**Files:**
- `frontend/src/pages/BotRemarketingStatusPage.tsx` — Add error column to table
- `frontend/src/lib/api.ts` — Ensure types include `lastError`

Add a new column to the remarketing states table:

| User | Status | Message | Sent | **Error** | Next Send | Toggle |
|---|---|---|---|---|---|---|
| Pedro | Active | Remarketing 01 | 0/17 | ✓ | in 45s | [on] |
| Ni | Active | Remarketing 01 | 0/17 | ⚠ Queue remarketing does not exist | past due | [on] |

Implementation approach:
- When `lastError === null` → show green checkmark "✓"
- When `lastError !== null` → show red warning icon with truncated error text
- On hover/click → tooltip or expand showing full error message

Type update in `api.ts`:
```typescript
export type RemarketingStateItem = {
  // ... existing fields ...
  lastError: string | null;      // ← add
  pgBossJobId: string | null;    // ← add
};
```

---

#### Fix 7: Add Diagnostic Card + Trigger Button to Status Page (Medium)

**Files:**
- `frontend/src/pages/BotRemarketingStatusPage.tsx` — New diagnostic section
- `frontend/src/lib/api.ts` — New API functions

Add a collapsible "Diagnostics" section above the states table that:

1. **Calls `GET /api/bots/:id/remarketing/diagnostic`** on page load
2. Shows summary cards: pastDue count, hasError count, workerSubscribed (yes/no), queue stats
3. Lists the 5 most recent problematic states (with error messages, past-due flags)
4. Adds a **"Trigger" button** per state row in the main table — calls `POST /.../remarketing/trigger` to immediately fire the next message

New API functions:
```typescript
export type RemarketingDiagnostic = {
  states: {
    total: number; active: number; completed: number;
    hasError: number; pastDue: number;
  };
  queueStats: { pendingJobs: number; activeJobs: number; workerSubscribed: boolean };
  recentStates: Array<{
    telegramId: string; nextSendAt: string | null;
    lastError: string | null; pgBossJobId: string | null;
    isPastDue: boolean; retries: number;
  }>;
};

export async function remarketingDiagnostic(botId: string): Promise<RemarketingDiagnostic>;
export async function triggerRemarketing(botId: string, userId: string): Promise<void>;
```

---

#### Fix 8: Prometheus Alerting for Remarketing Health (Medium)

**Files:** `server/src/utils/metrics.ts`, `server/src/services/remarketingQueue.ts`, `prometheus-alerts.yml`

Add real-time monitoring gauges and Prometheus alert rules that fire to Discord (primary) and Bark push notifications (critical severity). This ensures you get instantly notified when remarketing breaks — rather than discovering it days later.

---

##### 8A — Alerting Architecture

Your existing stack already routes alerts correctly. No Alertmanager changes needed:

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Prometheus   │────▶│ Alertmanager   │────▶│   Discord     │ (primary — all severities)
│ scrapes /metrics│   │   routes by    │     │   webhook     │
│ every 15s     │     │   severity     │     └──────────────┘
└──────────────┘     │               │     ┌──────────────┐
       ▲              │               │────▶│   Bark        │ (critical only — push to phone)
       │              └───────────────┘     │   /webhook/   │
       │                                    │   bark-alert  │
┌──────┴─────────┐                          └──────────────┘
│  App /metrics  │
│  exposes gauges│
└────────────────┘
```

Discord webhook is already configured. Bark is already configured via `sendSystemAlert()` → `/webhook/bark-alert`. Critical-severity alerts hit both channels.

---

##### 8B — New Metrics (6 Gauges)

**File:** `server/src/utils/metrics.ts`

```typescript
export const remarketingOrphanedJobs = new Gauge({
  name: "botflix_remarketing_orphaned_jobs",
  help: "States with pgBossJobId=null but nextSendAt set (scheduled but no job created)",
  labelNames: ["bot_id"],
});

export const remarketingPastDue = new Gauge({
  name: "botflix_remarketing_past_due",
  help: "States where nextSendAt < NOW() (overdue — worker may be down)",
  labelNames: ["bot_id"],
});

export const remarketingDead = new Gauge({
  name: "botflix_remarketing_dead",
  help: "States with nextSendAt=null (permanently orphaned — needs manual recovery)",
  labelNames: ["bot_id"],
});

export const remarketingWorkerUp = new Gauge({
  name: "botflix_remarketing_worker_up",
  help: "1 if the remarketing pg-boss worker is running, 0 if down",
});

export const remarketingErrors = new Gauge({
  name: "botflix_remarketing_errors",
  help: "States with non-null lastError (message delivery or scheduling failures)",
  labelNames: ["bot_id"],
});

export const remarketingActiveTotal = new Gauge({
  name: "botflix_remarketing_active_total",
  help: "Total active remarketing states (for stall detection)",
  labelNames: ["bot_id"],
});
```

---

##### 8C — Metrics Refresh Function

**File:** `server/src/services/remarketingQueue.ts` (new function)

A `setInterval` (every 60s) queries the DB and updates all gauges. Called from `startRemarketingWorker()`:

```typescript
import {
  remarketingOrphanedJobs, remarketingPastDue, remarketingDead,
  remarketingWorkerUp, remarketingErrors, remarketingActiveTotal
} from "../utils/metrics.js";

async function refreshRemarketingMetrics(): Promise<void> {
  remarketingWorkerUp.set(isWorkerRunning() ? 1 : 0);

  const bots = await prisma.bot.findMany({
    where: { status: BotStatus.ACTIVE, remarketingStates: { some: {} } },
    select: { id: true }
  }).catch(() => []);

  for (const bot of bots) {
    const botId = bot.id;

    const [orphaned, pastDue, dead, errors, active] = await Promise.all([
      prisma.remarketingState.count({
        where: { botId, pgBossJobId: null, nextSendAt: { not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: { lt: new Date(), not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: null }
      }),
      prisma.remarketingState.count({
        where: { botId, lastError: { not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: { not: null } }
      }),
    ]).catch(() => [0, 0, 0, 0, 0]);

    remarketingOrphanedJobs.set({ bot_id: botId }, orphaned ?? 0);
    remarketingPastDue.set({ bot_id: botId }, pastDue ?? 0);
    remarketingDead.set({ bot_id: botId }, dead ?? 0);
    remarketingErrors.set({ bot_id: botId }, errors ?? 0);
    remarketingActiveTotal.set({ bot_id: botId }, active ?? 0);
  }
}

// In startRemarketingWorker(), add after worker is started:
const metricsInterval = setInterval(refreshRemarketingMetrics, 60_000);
metricsInterval.unref();
```

---

##### 8D — Prometheus Alert Rules

**File:** `prometheus-alerts.yml`

Add to the `botflix` group under `rules:`:

```yaml
# ---- Remarketing Alerts ----

      - alert: RemarketingOrphanedJobs
        expr: botflix_remarketing_orphaned_jobs > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Remarketing: {{ $value }} state(s) without pg-boss jobs (bot {{ $labels.bot_id }})"
          description: >
            States have nextSendAt set but no pgBossJobId.
            Jobs are NOT being created in pg-boss.
            Check: (1) pgboss.queue has 'remarketing' row,
            (2) boss.send() is succeeding,
            (3) server logs for "Queue remarketing does not exist".

      - alert: RemarketingWorkerDown
        expr: botflix_remarketing_worker_up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Remarketing worker is DOWN"
          description: >
            The pg-boss remarketing worker is not running.
            No messages will be delivered. Restart the server
            or check pg-boss connectivity.

      - alert: RemarketingDeadStates
        expr: botflix_remarketing_dead >= 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "{{ $value }} remarketing state(s) permanently dead (bot {{ $labels.bot_id }})"
          description: >
            States have nextSendAt=null — permanently orphaned.
            These were likely abandoned when pg-boss was unavailable
            during state advancement. Manual recovery required:
            have users send /start or use admin trigger endpoint.

      - alert: RemarketingPastDue
        expr: botflix_remarketing_past_due >= 5
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} remarketing states past-due (bot {{ $labels.bot_id }})"
          description: >
            States have nextSendAt in the past. Worker may be
            overloaded, down, or pg-boss may have lost jobs.
            Check the remarketing diagnostic page in admin panel.

      - alert: RemarketingStalled
        expr: |
          botflix_remarketing_active_total > 0
          and
          increase(botflix_remarketing_sent_total[30m]) == 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Remarketing stalled: {{ $value }} active states but 0 sends in 30m (bot {{ $labels.bot_id }})"
          description: >
            Bot has active remarketing states but zero messages
            were delivered in the last 30 minutes. The worker
            or pg-boss queue may be silently broken.
            Check admin panel > Remarketing > Diagnostics.

      - alert: RemarketingErrors
        expr: botflix_remarketing_errors >= 3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} remarketing states have errors (bot {{ $labels.bot_id }})"
          description: >
            States have non-null lastError values. Individual
            message delivery or scheduling is failing.
            Check the admin panel error column for specific messages.
```

---

##### 8E — Alert Severity Routing

Your existing Alertmanager configuration already routes alerts correctly. No changes needed to `alertmanager.yml`:

| Severity | Discord | Bark (push notification) |
|---|---|---|
| `critical` | Yes, immediately | Yes, via `/webhook/bark-alert` → `sendSystemAlert()` |
| `warning` | Yes, immediately | No (Bark only gets criticals to avoid notification fatigue) |

**What you'll see when it fires:**

**Discord (critical example):**
```
🔴 FIRING — RemarketingOrphanedJobs
Remarketing: 5 state(s) without pg-boss jobs (bot dudinha)
States have nextSendAt set but no pgBossJobId. Jobs are NOT being created...
```

**Bark (critical, push to phone):**
```
📱 Remarketing: 5 state(s) without pg-boss jobs (bot dudinha)
States have nextSendAt set but no pgBossJobId. Jobs are NOT being created...
```

**Discord (warning example):**
```
🟡 FIRING — RemarketingPastDue
Remarketing: 12 remarketing states past-due (bot dudinha)
States have nextSendAt in the past. Worker may be overloaded, down...
```

**Discord (resolved):**
```
🟢 RESOLVED — RemarketingOrphanedJobs
```

---

### PHASE 4 — Low: Harden & Polish

---

#### Fix 9: Cancel Remarketing on `simulate-confirm` (Low)

**File:** `server/src/server.ts:132-231`

After updating the transaction to COMPLETED, add remarketing cancellation to match real payment flow behavior:

```typescript
await prisma.transaction.update({
  where: { id: transaction.id },
  data: { status: "COMPLETED" }
});

// ADD: cancel remarketing like real payment flow does
import { cancelRemarketingForUser } from "../bot/handlers.js";
await cancelRemarketingForUser(botId, transaction.userId).catch((err) => {
  logger.warn(`[simulate-confirm] failed to cancel remarketing: ${err instanceof Error ? err.message : String(err)}`);
});
```

---

#### Fix 10: Immediate Remarketing Cleanup When Blocking a User (Low)

**File:** `server/src/routes/chat.ts:164-179`

When the admin blocks a user, immediately cancel their remarketing instead of waiting for the next job to fire:

```typescript
// In PATCH /api/bots/:id/users/:uid
if (isBlocked !== undefined && user.isBlocked !== isBlocked) {
  updateData.isBlocked = isBlocked;
  if (isBlocked) {
    // Cancel remarketing immediately when blocking
    import { cancelRemarketingForUser } from "../bot/handlers.js";
    await cancelRemarketingForUser(botId, userId).catch((err) => {
      logger.warn(`[chat] failed to cancel remarketing for blocked user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}
```

---

#### Fix 11: Frontend Validation on Remarketing Save (Low)

**File:** `frontend/src/components/forms/RemarketingEditor.tsx`

Add validation in the save handler (parent `BotForm` or the `onSave` callback) before allowing submit when `remarketing.enabled=true`:

```typescript
if (remarketing.enabled) {
  if (!remarketing.messages || remarketing.messages.length === 0) {
    toast.error("At least one remarketing message is required when remarketing is enabled.");
    return;
  }
  if (remarketing.intervalMs < 60000) {
    toast.error("Interval must be at least 60,000ms (1 minute) when remarketing is enabled.");
    return;
  }
  if (remarketing.maxSends !== undefined && remarketing.maxSends < 0) {
    toast.error("Max sends must be 0 (unlimited) or a positive number.");
    return;
  }
}
```

---

#### Fix 12: Fix `findPaymentButtonAcross` for Burst Messages (Low)

**File:** `server/src/bot/handlers.ts:1146`

```typescript
// BEFORE:
const foundButton = findPaymentButtonAcross(
    [messageFlow, remarketing.messages],
    buttonId
);

// AFTER:
const foundButton = findPaymentButtonAcross(
    [messageFlow, remarketing.messages, ...(remarketing.burstMessages ?? [])],
    buttonId
);
```

---

#### Fix 13: Reduce Silently-Swallowed Errors (Low)

**File:** `server/src/services/remarketingQueue.ts`

Replace bare `.catch(() => {})` with `.catch((err) => { logger.warn(...) })` throughout:

| Line | Operation | Change |
|---|---|---|
| 60 | `boss.stop()` on re-init | Log warning with error message |
| 63 | Cleanup errors catch-all | Log warning with error message |
| 167 | State update after null send | Log warning (already logged above, but update failure is extra info) |
| 178 | `boss.cancel()` for single job | Log warning |
| 190 | `boss.cancel()` for batch jobs | Log warning |
| 239 | State update after past-due reschedule | Log warning |
| 261 | State update after future reschedule | Log warning |
| 281 | Delete blocked-user state | Log warning |
| 290 | Delete disabled-bot state | Log warning |
| 307 | Update after stale skip | Log warning |
| 360 | Update after burst silence | Log warning |

---

## 6. Implementation Order

| Order | Phase | Fix # | Description | Risk | Files |
|---|---|---|---|---|---|
| 1 | **Critical** | Fix 1 | `createQueue` in `startRemarketingWorker()` | Low | `remarketingQueue.ts` |
| 2 | **Critical** | Fix 2 | Remove early-return from `ensureBossInitialized()` | Low | `remarketingQueue.ts` |
| 3 | **Critical** | Fix 3 | Try/catch in `scheduleRemarketingJob`, set `lastError` | Low | `remarketingQueue.ts` |
| 4 | **High** | Fix 4 | Send before advancing state, re-throw on failure | Medium | `remarketingQueue.ts` |
| 5 | **High** | Fix 5 | Orphaned-state recovery on startup | Low | `remarketingQueue.ts`, `server.ts` |
| 6 | **Medium** | Fix 6 | Display `lastError` in admin frontend | Low | `BotRemarketingStatusPage.tsx`, `api.ts` |
| 7 | **Medium** | Fix 7 | Diagnostic card + trigger button in frontend | Low | `BotRemarketingStatusPage.tsx`, `api.ts` |
| 8 | **Medium** | Fix 8 | Prometheus alerting: 6 gauges + 6 alert rules → Discord & Bark | Low | `metrics.ts`, `remarketingQueue.ts`, `prometheus-alerts.yml` |
| 9 | **Low** | Fix 9 | Cancel remarketing on `simulate-confirm` | Low | `server.ts` |
| 10 | **Low** | Fix 10 | Cleanup remarketing on user block | Low | `chat.ts` |
| 11 | **Low** | Fix 11 | Frontend validation on save | Low | `RemarketingEditor.tsx` |
| 12 | **Low** | Fix 12 | Burst messages in `findPaymentButtonAcross` | Low | `handlers.ts` |
| 13 | **Low** | Fix 13 | Log instead of silently swallowing errors | Low | `remarketingQueue.ts` |

---

## 7. Verification Checklist

### After Phase 1 (Critical)
- [ ] Restart server — confirm log: `[remarketing-queue] worker started`
- [ ] DB: `SELECT * FROM pgboss.queue WHERE name = 'remarketing'` → 1 row
- [ ] Send `/start` to dudinha bot → `pgBossJobId` set on new RemarketingState
- [ ] DB: `SELECT count(*) FROM pgboss.job WHERE name = 'remarketing'` → > 0
- [ ] Wait `initialDelayMs` (60s) → first remarketing message delivered
- [ ] If `boss.send()` fails (e.g., queue missing), `lastError` is set on state row

### After Phase 2 (High)
- [ ] Force send failure (e.g., bad file_id) → job retried by pg-boss (not silently skipped)
- [ ] Kill pg-boss during `advanceState` → state orphaned with `nextSendAt=null`
- [ ] Restart server → orphaned state recovered automatically
- [ ] Normal send → state advances ONLY after successful delivery

### After Phase 3 (Medium)
- [ ] Admin panel: "Error" column visible in remarketing states table
- [ ] Admin panel: Diagnostics card shows pastDue, hasError, worker status
- [ ] Admin panel: "Trigger" button fires next message immediately
- [ ] Grafana: All 6 `botflix_remarketing_*` gauges visible and updating
- [ ] Prometheus: Alert rules visible at `/alerts` — all 6 rules showing green (inactive)
- [ ] Simulate orphaned state → alert fires within 5m → Discord notification received
- [ ] Simulate worker down → alert fires within 2m → Bark push notification received (critical)
- [ ] Simulate stalled (active states but no sends for 30m) → warning alert received in Discord

### After Phase 4 (Low)
- [ ] `simulate-confirm` → remarketing state deleted (not still running)
- [ ] Block user from admin → remarketing state immediately cleaned up
- [ ] Save remarketing with 0 messages → toast error, save prevented
- [ ] Click burst message button → payment flow triggers correctly
- [ ] Check logs during pg-boss failure — warn-level messages visible instead of silent swallows

---

## 8. Affected Files Summary

| File | Lines | Changes |
|---|---|---|
| `server/src/services/remarketingQueue.ts` | 35-46, 60-63, 96-118, 134-169, 178, 190, 239, 261, 281, 290, 307, 360, 375-397, 422-436, new | createQueue, remove early-return, try/catch send, advance-after-send, orphan recovery, metrics refresh, logging |
| `server/src/server.ts` | 132-231 (simulate), 257-259 (startup) | Fix simulate-confirm, add orphan recovery call |
| `server/src/bot/handlers.ts` | 1146 | Add burstMessages to button search |
| `server/src/routes/chat.ts` | 164-179 | Remarketing cleanup on user block |
| `server/src/utils/metrics.ts` | new | 6 gauges: orphanedJobs, pastDue, dead, workerUp, errors, activeTotal + `refreshRemarketingMetrics()` |
| `prometheus-alerts.yml` | ~70 new | 6 alert rules: OrphanedJobs, WorkerDown, DeadStates, PastDue, Stalled, Errors |
| `frontend/src/pages/BotRemarketingStatusPage.tsx` | multiple | Error column, diagnostics card, trigger button |
| `frontend/src/lib/api.ts` | new types + functions | Diagnostic API + trigger API + type updates |
| `frontend/src/components/forms/RemarketingEditor.tsx` | ~230 | Validation on save |

---

## 9. Migration & Rollback Notes

### No database migration required
All fixes are code-only. The `pgboss.queue` row is created by pg-boss's `createQueue()` call which is idempotent (`ON CONFLICT DO NOTHING` internally). Existing `RemarketingState` rows will be picked up by `rescheduleAllRemarketingJobs()` on restart.

### Highest-risk change
**Fix 4** (advance state after send, re-throw on failure) changes the behavior of `handleRemarketingJob`. Previously, a failed send advanced the state and silently skipped the message. After the fix, a failed send triggers pg-boss's retry mechanism (3 attempts, 60s apart). If all retries fail, pg-boss marks the job as permanently failed. Consider adding monitoring for the `retry_count` field in `pgboss.job` after deploying.

### Rollback path
If Fix 4 causes issues, revert the order of `advanceState`/`sendRemarketingStep` and remove the `throw`. All other fixes are additive or defensive and safe to keep.

### Backward compatibility
- No API contract changes (diagnostic endpoint already exists, we're just wiring UI)
- New frontend UI elements degrade gracefully on older API responses
- New Prometheus metrics are additive (don't break existing dashboards)
- Fix 2 (`ensureBossInitialized`) adds idempotent operations — safe to call multiple times
