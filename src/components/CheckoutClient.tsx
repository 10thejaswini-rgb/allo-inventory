// src/components/CheckoutClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ReservationDTO } from "@/lib/schemas";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function useCountdown(expiresAt: string) {
  const getRemaining = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [expiresAt]);

  const [seconds, setSeconds] = useState(getRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getRemaining());
    }, 500);
    return () => clearInterval(interval);
  }, [getRemaining]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `${mins}:${String(secs).padStart(2, "0")}`;
  const isUrgent = seconds < 60;
  const isExpired = seconds === 0;

  return { seconds, formatted, isUrgent, isExpired };
}

type Status = ReservationDTO["status"];

const StatusBadge = ({ status }: { status: Status }) => {
  const configs: Record<Status, { label: string; cls: string }> = {
    PENDING: {
      label: "Pending",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    CONFIRMED: {
      label: "Confirmed",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    RELEASED: {
      label: "Released",
      cls: "bg-slate-100 text-slate-600 border-slate-200",
    },
  };
  const { label, cls } = configs[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
};

export function CheckoutClient({
  initialReservation,
}: {
  initialReservation: ReservationDTO;
}) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { formatted, isUrgent, isExpired } = useCountdown(reservation.expiresAt);
  const isPending = reservation.status === "PENDING";

  // Auto-update status when timer expires
  useEffect(() => {
    if (isExpired && isPending) {
      setReservation((r) => ({ ...r, status: "RELEASED" }));
    }
  }, [isExpired, isPending]);

  async function handleConfirm() {
    setError(null);
    setActionLoading("confirm");

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `confirm-${reservation.id}`,
        },
      });

      const data = await res.json();

      if (res.status === 410) {
        setError("Your reservation has expired. The items have been released.");
        setReservation((r) => ({ ...r, status: "RELEASED" }));
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to confirm purchase");
        return;
      }

      setReservation(data);
      setSuccessMessage("Purchase confirmed! Your order is being processed.");
    } catch {
      setError("Network error — please try again");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setError(null);
    setActionLoading("cancel");

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to cancel reservation");
        return;
      }

      setReservation((r) => ({ ...r, status: "RELEASED" }));
      setSuccessMessage("Reservation cancelled. Items returned to stock.");
    } catch {
      setError("Network error — please try again");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-6 transition-colors"
      >
        <span>←</span> Back to products
      </button>

      <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Checkout
            </h1>
            <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
              #{reservation.id.slice(-8).toUpperCase()}
            </p>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Product details */}
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {reservation.productName}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {reservation.warehouseName} · qty {reservation.quantity}
              </p>
            </div>
            <p className="font-semibold font-mono text-[var(--text-primary)] whitespace-nowrap">
              {formatPrice(reservation.productPrice * reservation.quantity)}
            </p>
          </div>
        </div>

        {/* Timer — only shown while pending */}
        {isPending && (
          <div
            className={`px-6 py-4 border-b border-[var(--border)] flex items-center justify-between ${
              isUrgent ? "bg-red-50" : "bg-amber-50"
            }`}
          >
            <div>
              <p
                className={`text-xs font-medium uppercase tracking-wide ${
                  isUrgent ? "text-red-600" : "text-amber-600"
                }`}
              >
                Reservation expires in
              </p>
              <p
                className={`text-2xl font-mono font-semibold mt-0.5 ${
                  isUrgent
                    ? "text-red-600 animate-pulse-subtle"
                    : "text-amber-700"
                }`}
              >
                {formatted}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${
                isUrgent
                  ? "border-red-200 text-red-500"
                  : "border-amber-200 text-amber-600"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
        )}

        {/* Success / error messages */}
        {successMessage && (
          <div className="mx-6 mt-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm animate-slide-up">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm animate-slide-up">
            {error}
          </div>
        )}

        {/* Expiry notice */}
        {reservation.status === "RELEASED" && !successMessage && (
          <div className="mx-6 mt-5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-4 py-3 text-sm animate-slide-up">
            This reservation has been released. The items are back in stock.
          </div>
        )}

        {/* Confirmed notice */}
        {reservation.status === "CONFIRMED" && (
          <div className="mx-6 mt-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 animate-slide-up">
            <p className="font-medium text-sm">Order confirmed</p>
            <p className="text-xs mt-0.5 text-emerald-600">
              {reservation.productName} × {reservation.quantity} from{" "}
              {reservation.warehouseName}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {isPending && (
            <>
              <button
                onClick={handleConfirm}
                disabled={!!actionLoading || isExpired}
                className="w-full py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "confirm" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming purchase…
                  </span>
                ) : (
                  "Confirm purchase"
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={!!actionLoading}
                className="w-full py-2.5 px-4 border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] font-medium rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "cancel" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                    Cancelling…
                  </span>
                ) : (
                  "Cancel reservation"
                )}
              </button>
            </>
          )}

          {!isPending && (
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 px-4 border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] font-medium rounded-lg transition-colors text-sm"
            >
              Back to products
            </button>
          )}
        </div>
      </div>

      {/* Reservation metadata */}
      <div className="mt-4 px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-muted)] space-y-1">
        <div className="flex justify-between">
          <span>reservation_id</span>
          <span className="text-[var(--text-secondary)]">{reservation.id}</span>
        </div>
        <div className="flex justify-between">
          <span>created_at</span>
          <span className="text-[var(--text-secondary)]">
            {new Date(reservation.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>expires_at</span>
          <span className="text-[var(--text-secondary)]">
            {new Date(reservation.expiresAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
