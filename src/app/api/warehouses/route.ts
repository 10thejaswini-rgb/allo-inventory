// src/app/api/warehouses/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WarehouseDTO } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: "asc" },
    });

    const response: WarehouseDTO[] = warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      location: w.location,
    }));

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/warehouses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
