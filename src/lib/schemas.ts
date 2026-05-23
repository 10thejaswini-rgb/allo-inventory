// src/lib/schemas.ts
import { z } from "zod";

// ── Request schemas ────────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity: z.number().int().positive("quantity must be a positive integer"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ── Response types ────────────────────────────────────────────────────────────

export type WarehouseDTO = {
  id: string;
  name: string;
  location: string;
};

export type StockLevelDTO = {
  warehouseId: string;
  warehouseName: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

export type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stockLevels: StockLevelDTO[];
};

export type ReservationDTO = {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string; // ISO string
  createdAt: string;
};

export type ApiError = {
  error: string;
  code?: string;
};
