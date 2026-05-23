// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.idempotencyRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi North", location: "New Delhi, Delhi" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
    }),
  ]);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        description:
          "Premium over-ear headphones with 30-hour battery life and active noise cancellation.",
        price: 24999,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        description:
          "Tenkeyless mechanical keyboard with tactile brown switches and RGB backlighting.",
        price: 8999,
        imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "4K Webcam Pro",
        description:
          "Ultra HD webcam with auto-focus, built-in ring light, and dual microphone.",
        price: 12499,
        imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Hub 12-in-1",
        description:
          "Multiport adapter with HDMI 4K, 100W PD, SD card reader, and 4 USB ports.",
        price: 4999,
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Mouse",
        description:
          "Vertical ergonomic wireless mouse with 6 programmable buttons and 90-day battery.",
        price: 3499,
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Portable SSD 1TB",
        description:
          "Rugged USB-C SSD with 1050 MB/s read speed, IP55 rated for dust and water.",
        price: 9999,
        imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400",
      },
    }),
  ]);

  const [headphones, keyboard, webcam, hub, mouse, ssd] = products;

  // Create stock levels — deliberately keep some low to demo the 409 scenario
  await prisma.stockLevel.createMany({
    data: [
      // Headphones
      { productId: headphones.id, warehouseId: mumbai.id, totalUnits: 15, reservedUnits: 0 },
      { productId: headphones.id, warehouseId: delhi.id, totalUnits: 8, reservedUnits: 0 },
      { productId: headphones.id, warehouseId: bangalore.id, totalUnits: 3, reservedUnits: 0 },

      // Keyboard
      { productId: keyboard.id, warehouseId: mumbai.id, totalUnits: 25, reservedUnits: 0 },
      { productId: keyboard.id, warehouseId: delhi.id, totalUnits: 12, reservedUnits: 0 },
      { productId: keyboard.id, warehouseId: bangalore.id, totalUnits: 0, reservedUnits: 0 },

      // Webcam
      { productId: webcam.id, warehouseId: mumbai.id, totalUnits: 5, reservedUnits: 0 },
      { productId: webcam.id, warehouseId: delhi.id, totalUnits: 2, reservedUnits: 0 }, // Low stock
      { productId: webcam.id, warehouseId: bangalore.id, totalUnits: 7, reservedUnits: 0 },

      // Hub
      { productId: hub.id, warehouseId: mumbai.id, totalUnits: 30, reservedUnits: 0 },
      { productId: hub.id, warehouseId: delhi.id, totalUnits: 18, reservedUnits: 0 },
      { productId: hub.id, warehouseId: bangalore.id, totalUnits: 22, reservedUnits: 0 },

      // Mouse
      { productId: mouse.id, warehouseId: mumbai.id, totalUnits: 1, reservedUnits: 0 }, // Very low
      { productId: mouse.id, warehouseId: delhi.id, totalUnits: 9, reservedUnits: 0 },
      { productId: mouse.id, warehouseId: bangalore.id, totalUnits: 14, reservedUnits: 0 },

      // SSD
      { productId: ssd.id, warehouseId: mumbai.id, totalUnits: 6, reservedUnits: 0 },
      { productId: ssd.id, warehouseId: delhi.id, totalUnits: 4, reservedUnits: 0 },
      { productId: ssd.id, warehouseId: bangalore.id, totalUnits: 0, reservedUnits: 0 },
    ],
  });

  console.log("✅ Seed complete.");
  console.log(`   ${products.length} products`);
  console.log(`   3 warehouses`);
  console.log(`   ${products.length * 3} stock level records`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
