import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import type { Database, Product } from "../src/types.js";

const dbPath = path.resolve(process.cwd(), "src/data/db.json");

async function readSourceDb() {
  const raw = await fs.readFile(dbPath, "utf-8");
  return JSON.parse(raw) as Database;
}

function uniqueGalleryImages(product: Product) {
  return Array.from(
    new Set([product.imageUrl, ...(product.galleryImages ?? [])].filter(Boolean))
  );
}

async function seedCategories(db: Database) {
  for (const category of db.categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
      update: {
        name: category.name,
        slug: category.slug,
      },
    });
  }
}

async function seedProducts(db: Database) {
  for (const product of db.products) {
    const category = await prisma.category.findUnique({
      where: { slug: product.category },
    });

    if (!category) {
      throw new Error(
        `Cannot seed product "${product.slug}": category "${product.category}" does not exist`
      );
    }

    const savedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        featured: product.featured ?? false,
        categoryId: category.id,
      },
      update: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        featured: product.featured ?? false,
        categoryId: category.id,
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productImage.createMany({
      data: uniqueGalleryImages(product).map((url, index) => ({
        productId: savedProduct.id,
        url,
        alt: product.name,
        position: index,
        isPrimary: index === 0,
      })),
    });

    await prisma.productPrice.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productPrice.create({
      data: {
        productId: savedProduct.id,
        amount: product.price,
        currency: "ARS",
        active: true,
      },
    });

    await prisma.inventory.upsert({
      where: { productId: savedProduct.id },
      create: {
        productId: savedProduct.id,
        quantity: product.stock,
      },
      update: {
        quantity: product.stock,
      },
    });
  }
}

async function seedOrders(db: Database) {
  for (const order of db.orders) {
    await prisma.order.upsert({
      where: { orderNumber: order.orderNumber },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: order.shippingAddress,
        shippingCity: order.shippingCity,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        shippingProvider: order.shippingProvider ?? "Correo Argentino",
        shippingService: order.shippingService ?? "PAQ.AR",
        shippingCost: order.shippingCost ?? "0.00",
        shippingEta: order.shippingEta ?? "",
        shippingTrackingNumber: order.shippingTrackingNumber ?? "",
        shippingTrackingUrl: order.shippingTrackingUrl ?? "",
        status: order.status,
        subtotalAmount: order.subtotalAmount ?? order.totalAmount,
        totalAmount: order.totalAmount,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            slug: item.slug,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        },
        events: {
          create:
            order.events?.map((event) => ({
              type: event.type,
              message: event.message,
              createdAt: new Date(event.createdAt),
            })) ?? [],
        },
      },
      update: {
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingAddress: order.shippingAddress,
        shippingCity: order.shippingCity,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        shippingProvider: order.shippingProvider ?? "Correo Argentino",
        shippingService: order.shippingService ?? "PAQ.AR",
        shippingCost: order.shippingCost ?? "0.00",
        shippingEta: order.shippingEta ?? "",
        shippingTrackingNumber: order.shippingTrackingNumber ?? "",
        shippingTrackingUrl: order.shippingTrackingUrl ?? "",
        status: order.status,
        subtotalAmount: order.subtotalAmount ?? order.totalAmount,
        totalAmount: order.totalAmount,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
      },
    });

    const savedOrder = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: order.orderNumber },
    });

    await prisma.orderItem.deleteMany({
      where: { orderId: savedOrder.id },
    });
    await prisma.orderItem.createMany({
      data: order.items.map((item) => ({
        orderId: savedOrder.id,
        productId: item.productId,
        slug: item.slug,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    });
  }
}

async function seedSettings(db: Database) {
  await prisma.storeSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      storeName: db.settings.storeName,
      whatsappNumber: db.settings.whatsappNumber,
      shipping: db.settings.shipping,
      promoBanner: db.settings.promoBanner,
    },
    update: {
      storeName: db.settings.storeName,
      whatsappNumber: db.settings.whatsappNumber,
      shipping: db.settings.shipping,
      promoBanner: db.settings.promoBanner,
    },
  });
}

async function seedAdmin(db: Database) {
  if (db.admin) {
    await prisma.adminAccount.upsert({
      where: { email: db.admin.email },
      create: {
        name: db.admin.name,
        email: db.admin.email,
        passwordHash: db.admin.passwordHash,
        passwordSalt: db.admin.passwordSalt,
      },
      update: {
        name: db.admin.name,
        passwordHash: db.admin.passwordHash,
        passwordSalt: db.admin.passwordSalt,
      },
    });
    return;
  }

  const email = process.env.ADMIN_EMAIL || "admin@jolit.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const existingAdmin = await prisma.adminAccount.findUnique({ where: { email } });

  if (existingAdmin) return;

  const passwordHash = hashPassword(password);

  await prisma.adminAccount.create({
    data: {
      name: "Admin",
      email,
      passwordHash: passwordHash.hash,
      passwordSalt: passwordHash.salt,
    },
  });
}

async function syncSequences() {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"categories"', 'id'), COALESCE((SELECT MAX(id) FROM "categories"), 1), true)`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"products"', 'id'), COALESCE((SELECT MAX(id) FROM "products"), 1), true)`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"orders"', 'id'), COALESCE((SELECT MAX(id) FROM "orders"), 1), true)`
  );
}

async function main() {
  const db = await readSourceDb();

  await seedCategories(db);
  await seedProducts(db);
  await seedOrders(db);
  await seedSettings(db);
  await seedAdmin(db);
  await syncSequences();

  const categoryCount = await prisma.category.count();
  const productCount = await prisma.product.count();
  const orderCount = await prisma.order.count();

  console.log(
    `Seed completed: ${categoryCount} categories, ${productCount} products, ${orderCount} orders.`
  );
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
