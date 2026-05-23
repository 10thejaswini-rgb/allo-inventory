# Allo Inventory — Take-Home Exercise

A Next.js inventory and order-fulfillment platform demonstrating concurrency-safe reservation logic for a multi-warehouse retail scenario.

**Live demo:** [deploy to Vercel and paste URL here]

---

## Getting started locally

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash free tier works perfectly)

### 1. Clone and install

```bash
git clone <repo-url>
cd allo-inventory
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string from your provider |
| `REDIS_URL` | Redis URL (e.g. `rediss://...` for Upstash) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |
| `CRON_SECRET` | Any random secret string |

### 3. Run migrations and seed

```bash
npx prisma generate
npx prisma db push          # or: npx prisma migrate dev
npm run db:seed             # loads 6 products, 3 warehouses, stock levels
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

1. Push to GitHub and import into Vercel.
2. Set environment variables in the Vercel dashboard (same keys as `.env.example`).
3. `DATABASE_URL` should use your hosted Postgres URL (add `?pgbouncer=true&connection_limit=1` for Supabase).
4. The Vercel Cron job is defined in `vercel.json` and will fire automatically.

---

## How the concurrency guarantee works

This is the core of the exercise. The race condition is:

> Two concurrent requests arrive for the last unit. Without protection, both could read `available = 1`, both decide it's enough, both increment `reservedUnits`, and both succeed — but only one physical unit exists.

### Solution: Redis distributed lock + Postgres SELECT FOR UPDATE

**Layer 1 — Redis lock (`src/lib/lock.ts`)**

When a reservation request arrives, we acquire a Redis lock keyed on `stock:{productId}:{warehouseId}` using `SET NX PX` (set-if-not-exists with expiry). Only one process holds the lock at a time. Concurrent requests for the same SKU+warehouse spin-wait (up to 3 s) then either acquire the lock when it's released or return a 503.

The lock is scoped per SKU+warehouse, so reservations for different products proceed in parallel without blocking each other.

**Layer 2 — Postgres `SELECT … FOR UPDATE` (`src/app/api/reservations/route.ts`)**

Inside the lock, inside a Prisma transaction, we issue a raw `SELECT … FOR UPDATE` on the `StockLevel` row. This ensures that even if two processes bypass the Redis lock (e.g. a direct DB write in tests, or a Redis failure), the database itself serialises access via row-level locking. It's belt-and-suspenders.

**Why both?**

- The Redis lock prevents unnecessary DB contention — most concurrent requests are resolved at the application layer without a DB-level lock conflict.
- The Postgres `FOR UPDATE` is the safety net. If Redis becomes unavailable or a client bypasses the lock, the DB guarantees correctness at the cost of serialised access.

**What happens on conflict?**

- If the Redis lock is held: the second request spin-waits (50–100 ms increments) for up to 3 s, then returns 503.
- If the Postgres check fails (not enough stock): returns 409 with `{ available: N }`.

---

## How reservation expiry works

### In production

A Vercel Cron job is configured in `vercel.json` to hit `/api/cron/expire` every minute (`* * * * *`). This route calls `releaseExpiredReservations()` which:

1. Finds all `PENDING` reservations where `expiresAt < now()`
2. Decrements `reservedUnits` on the corresponding `StockLevel` rows
3. Sets status to `RELEASED`

The cron endpoint is protected by a `CRON_SECRET` header so only Vercel (or authorised callers) can invoke it.

### Lazy cleanup on read

When a client fetches `GET /api/reservations/:id`, the server checks the `expiresAt` in-memory. If the reservation is past expiry and still `PENDING`, it's released immediately before responding. This means stock numbers are always correct at read time, even if the cron missed a cycle.

### Why not Postgres `pg_cron`?

That would also work and would be fully serverless-independent. I chose Vercel Cron + application code because:
- It keeps all business logic in the app layer (easier to test)
- Works with any Postgres provider (Neon, Supabase, Railway) without configuring extensions
- The Vercel Cron dashboard gives visibility into run history

---

## How idempotency works (bonus)

Endpoints that have side effects (`POST /api/reservations`, `POST /api/reservations/:id/confirm`) accept an optional `Idempotency-Key` header.

On **first request**: the handler runs normally and the response is persisted to the `IdempotencyRecord` table (and cached in Redis for 1 hour).

On **retry with the same key**: the stored response is returned immediately without re-executing the handler. This means:
- A network timeout that triggers a retry won't double-book stock
- Clients can safely retry failed requests without checking state first

**Conflict handling**: If two concurrent requests with the same key arrive simultaneously, the `idempotencyRecord.create` will fail with a unique constraint violation for the second one. The error handler reads back the winner's response and returns it, so both callers see a consistent result.

**Scope**: Keys are global (not per-user) — the client is responsible for generating unique keys per logical operation (e.g. `crypto.randomUUID()`). The example frontend generates a time-stamped key per reserve action.

---

## API reference

| Method | Path | Status codes |
|---|---|---|
| GET | `/api/products` | 200 |
| GET | `/api/warehouses` | 200 |
| POST | `/api/reservations` | 201, 400, 404, 409, 503 |
| GET | `/api/reservations/:id` | 200, 404 |
| POST | `/api/reservations/:id/confirm` | 200, 404, 410 |
| POST | `/api/reservations/:id/release` | 200, 404 |
| GET | `/api/cron/expire` | 200, 401 (cron only) |

---

## Trade-offs and things I'd do differently with more time

### What I prioritised
- **Correctness under concurrency** — the Redis lock + Postgres FOR UPDATE belt-and-suspenders approach is the core of the exercise and I'm confident it's race-condition-free.
- **Clear code** — each file has a single responsibility and a comment explaining the "why" not just the "what".
- **Real error surface** — 409 and 410 errors are surfaced to the user, not swallowed.

### Trade-offs made

**Single-node Redis lock vs. Redlock**  
The lock implementation uses a single Redis node (`SET NX PX`). For a multi-node Redis cluster, Redlock (Martin Kleppmann's algorithm) would be needed. Upstash's free tier is single-node, so this is fine for the demo — but I'd note it in a production design doc.

**Spin-wait vs. queue**  
Concurrent requests for the same SKU spin-wait up to 3 s. A smarter approach would be a work queue (BullMQ) so requests are serialised without busy-waiting. The 3 s cap was chosen to be well within any reasonable HTTP timeout.

**No auth**  
There's no user identity or session — reservations are anonymous. In production, reservations would be tied to a user/session and users could only confirm/release their own.

**Polling vs. WebSockets for expiry**  
The countdown timer runs client-side from the initial `expiresAt` timestamp. If the server releases the reservation early (e.g. admin action), the client wouldn't know until it polls or navigates. A WebSocket or SSE channel would handle this better.

**Stock levels as denormalised counters**  
`reservedUnits` on `StockLevel` is a denormalised counter. This is fast to read but requires careful maintenance — every code path that changes reservations must also update the counter. An alternative is to compute available units by summing pending reservations at query time, which is always consistent but slower at scale.

**No optimistic UI**  
The product listing page revalidates on every server render. With `revalidatePath` or SWR, we could show real-time stock updates without a full page reload.

### What I'd add next

- User authentication (NextAuth or Clerk)
- Admin dashboard: view all reservations, manually release, adjust stock
- Webhook/email on confirmation
- Metrics: track reservation-to-confirmation conversion rate per SKU
- Load testing script to verify the lock under real concurrency (e.g. k6)
