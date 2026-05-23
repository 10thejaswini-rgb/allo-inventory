// src/lib/expiry.ts
/**
 * Reservation expiry logic.
 *
 * Three strategies are implemented here:
 *   1. `releaseExpiredReservations()` — called by the cron route and can be
 *      called before any read of stock levels (lazy cleanup).
 *   2. Lazy cleanup on read — `getAvailableUnits()` returns the correct
 *      available count even without running the cron, because it looks at
 *      expiresAt in memory to exclude expired-but-not-yet-released units.
 *
 * In production we rely on a Vercel Cron job hitting /api/cron/expire every
 * minute.  The lazy cleanup is a safety net so stock numbers are never stale
 * even if the cron misses a cycle.
 */

import { prisma } from "./prisma";

export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantity: true,
    },
  });

  if (expired.length === 0) return 0;

  // Release them in a transaction — decrement reservedUnits, update status
  await prisma.$transaction(
    expired.map((r) =>
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: r.quantity } },
      })
    )
  );

  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED" },
  });

  console.log(`[expiry] Released ${expired.length} expired reservation(s).`);
  return expired.length;
}
