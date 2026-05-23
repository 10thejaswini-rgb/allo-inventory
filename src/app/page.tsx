// src/app/page.tsx
import { ProductCard } from "@/components/ProductCard";
import type { ProductDTO } from "@/lib/schemas";

async function getProducts(): Promise<ProductDTO[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function HomePage() {
  let products: ProductDTO[] = [];
  let error: string | null = null;

  try {
    products = await getProducts();
  } catch {
    error = "Could not load products. Is the database connected?";
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
          Products
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Select a product and warehouse to reserve inventory.
        </p>
      </div>

      {error && (
        <div className="bg-[var(--danger-bg)] border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-8">
          {error}
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm mt-1">Run the seed script to populate the database.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
