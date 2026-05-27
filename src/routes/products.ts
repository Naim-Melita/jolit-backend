import { Router } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import { badRequest, notFound } from "../lib/http.js";
import { nextId, readDb, slugify, toMoney, writeDb } from "../lib/store.js";
import { productSchema, updateProductSchema } from "../schemas.js";

export const productsRouter = Router();

productsRouter.get("/", (req, res) => {
  const db = readDb();
  const category = String(req.query.category ?? "");
  const search = String(req.query.search ?? "").trim().toLowerCase();

  const products = db.products.filter((product) => {
    product.featured ??= false;
    product.galleryImages ??= [product.imageUrl];
    const matchesCategory = !category || category === "todos" || product.category === category;
    const matchesSearch =
      !search ||
      product.name.toLowerCase().includes(search) ||
      product.description.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  res.json(products);
});

productsRouter.get("/:slug", (req, res) => {
  const db = readDb();
  const product = db.products.find((item) => item.slug === req.params.slug);

  if (!product) throw notFound("Product not found");
  product.featured ??= false;
  product.galleryImages ??= [product.imageUrl];

  res.json(product);
});

productsRouter.post("/", requireAdmin, (req, res) => {
  const input = productSchema.parse(req.body);
  const db = readDb();
  const slug = input.slug ?? slugify(input.name);

  if (!db.categories.some((category) => category.slug === input.category)) {
    throw badRequest("Category does not exist");
  }

  if (db.products.some((product) => product.slug === slug)) {
    throw badRequest("Product slug already exists");
  }

  const product = {
    id: nextId(db.products),
    slug,
    name: input.name,
    description: input.description,
    price: toMoney(input.price),
    stock: input.stock,
    imageUrl: input.imageUrl,
    galleryImages: uniqueGalleryImages(input.imageUrl, input.galleryImages),
    category: input.category,
    featured: input.featured,
  };

  db.products.push(product);
  writeDb(db);
  res.status(201).json(product);
});

productsRouter.patch("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const input = updateProductSchema.parse(req.body);
  const db = readDb();
  const product = db.products.find((item) => item.id === id);

  if (!product) throw notFound("Product not found");

  const nextCategory = input.category ?? product.category;
  if (!db.categories.some((category) => category.slug === nextCategory)) {
    throw badRequest("Category does not exist");
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : product.slug);
  const slugTaken = db.products.some((item) => item.id !== id && item.slug === nextSlug);

  if (slugTaken) throw badRequest("Product slug already exists");

  product.slug = nextSlug;
  product.name = input.name ?? product.name;
  product.description = input.description ?? product.description;
  product.price = input.price === undefined ? product.price : toMoney(input.price);
  product.stock = input.stock ?? product.stock;
  product.imageUrl = input.imageUrl ?? product.imageUrl;
  product.galleryImages =
    input.galleryImages === undefined
      ? product.galleryImages ?? [product.imageUrl]
      : uniqueGalleryImages(product.imageUrl, input.galleryImages);
  product.category = nextCategory;
  product.featured = input.featured ?? product.featured ?? false;

  writeDb(db);
  res.json(product);
});

productsRouter.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const db = readDb();
  const exists = db.products.some((item) => item.id === id);

  if (!exists) throw notFound("Product not found");

  db.products = db.products.filter((item) => item.id !== id);
  writeDb(db);
  res.status(204).send();
});

function uniqueGalleryImages(imageUrl: string, galleryImages: string[]) {
  return Array.from(new Set([imageUrl, ...galleryImages].filter(Boolean)));
}
