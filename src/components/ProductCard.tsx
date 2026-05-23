// src/components/ProductCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDTO } from "@/lib/schemas";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function StockBadge({ available }: { available: number }) {
  if (available === 0) {
    return (
      <span className="text-xs font-mono font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
        Out of stock
      </span>
    );
  }
  if (available <= 3) {
    return (
      <span className="text-xs font-mono font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
        {available} left
      </span>
    );
  }
  return (
    <span className="text-xs font-mono font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
      {available} units
    </span>
  );
}

export function ProductCard({ product }: { product: ProductDTO }) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    product.stockLevels[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stockLevels.find(
    (s) => s.warehouseId === selectedWarehouse
  );
  const available = selectedStock?.availableUnits ?? 0;

  async function handleReserve() {
    setError(null);
    setLoading(true);

    try {
      const idempotencyKey = `reserve-${product.id}-${selectedWarehouse}-${Date.now()}`;
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(
          `Not enough stock. Only ${data.available ?? 0} unit(s) available.`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Reservation failed");
        return;
      }

      // Navigate to the checkout page
      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 animate-slide-up">
      {/* Product image */}
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-44 object-cover bg-[var(--bg)]"
        />
      )}

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Title & price */}
        <div>
          <h2 className="font-semibold text-[var(--text-primary)] leading-snug mb-1">
            {product.name}
          </h2>
          {product.description && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
              {product.description}
            </p>
          )}
          <p className="text-lg font-semibold font-mono text-[var(--accent)] mt-2">
            {formatPrice(product.price)}
          </p>
        </div>

        {/* Warehouse selector */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1.5 block">
            Warehouse
          </label>
          <div className="flex flex-col gap-1.5">
            {product.stockLevels.map((s) => (
              <label
                key={s.warehouseId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  selectedWarehouse === s.warehouseId
                    ? "border-[var(--accent)] bg-sky-50"
                    : "border-[var(--border)] hover:bg-[var(--bg)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`warehouse-${product.id}`}
                    value={s.warehouseId}
                    checked={selectedWarehouse === s.warehouseId}
                    onChange={() => {
                      setSelectedWarehouse(s.warehouseId);
                      setError(null);
                    }}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[var(--text-primary)]">{s.warehouseName}</span>
                </div>
                <StockBadge available={s.availableUnits} />
              </label>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1.5 block">
            Quantity
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] font-mono text-lg leading-none transition-colors"
            >
              −
            </button>
            <span className="font-mono text-[var(--text-primary)] w-8 text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(available, q + 1))}
              disabled={quantity >= available}
              className="w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] font-mono text-lg leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Reserve button */}
        <button
          onClick={handleReserve}
          disabled={loading || available === 0}
          className="mt-auto w-full py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Reserving…
            </span>
          ) : available === 0 ? (
            "Out of Stock"
          ) : (
            "Reserve"
          )}
        </button>
      </div>
    </div>
  );
}
