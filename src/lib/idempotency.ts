// src/lib/idempotency.ts
/**
 * Idempotency key handling.
 *
 * On first request: execute the handler and store the response.
 * On retry with same key: return stored response without re-executing.
 *
 * Keys are stored in the IdempotencyRecord table.  We also cache them briefly
 * in Redis to make repeat reads cheap without hitting the DB.
 */

import { prisma } from "./prisma";
import { redis } from "./redis";
import { NextResponse } from "next/server";

const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function withIdempotency(
  key: string | null,
  path: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  if (!key) {
    // No idempotency key provided — just run the handler directly
    return handler();
  }

  const cacheKey = `idempotency:${key}`;

  // Fast path: check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    const { body, status } = JSON.parse(cached);
    return NextResponse.json(body, { status });
  }

  // Slower path: check the DB
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (existing) {
    const body = JSON.parse(existing.responseBody);
    // Re-populate cache
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ body, status: existing.statusCode }));
    return NextResponse.json(body, { status: existing.statusCode });
  }

  // First time — execute handler and persist the result
  const response = await handler();

  // Clone response to read body without consuming it
  const cloned = response.clone();
  const body = await cloned.json();
  const status = response.status;

  // Persist synchronously (we could do this async, but sync is simpler and safer)
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        requestPath: path,
        responseBody: JSON.stringify(body),
        statusCode: status,
        reservationId: body?.id ?? null,
      },
    });

    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ body, status }));
  } catch (err) {
    // If persisting fails (e.g. race condition — another process already saved it),
    // read back the winner's response.
    const winner = await prisma.idempotencyRecord.findUnique({ where: { key } });
    if (winner) {
      const winnerBody = JSON.parse(winner.responseBody);
      return NextResponse.json(winnerBody, { status: winner.statusCode });
    }
    // Otherwise fall through and return the response we already computed
    console.error("Failed to persist idempotency record:", err);
  }

  return response;
}
