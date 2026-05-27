import { Router } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import { categorySchema } from "../schemas.js";
import { badRequest, notFound } from "../lib/http.js";
import { nextId, readDb, slugify, writeDb } from "../lib/store.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", (_req, res) => {
  const db = readDb();
  res.json(db.categories);
});

categoriesRouter.post("/", requireAdmin, (req, res) => {
  const input = categorySchema.parse(req.body);
  const db = readDb();
  const slug = input.slug ?? slugify(input.name);

  if (db.categories.some((category) => category.slug === slug)) {
    throw badRequest("Category slug already exists");
  }

  const category = {
    id: nextId(db.categories),
    name: input.name,
    slug,
  };

  db.categories.push(category);
  writeDb(db);
  res.status(201).json(category);
});

categoriesRouter.patch("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const input = categorySchema.partial().parse(req.body);
  const db = readDb();
  const category = db.categories.find((item) => item.id === id);

  if (!category) throw notFound("Category not found");

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : category.slug);
  const slugTaken = db.categories.some(
    (item) => item.id !== id && item.slug === nextSlug
  );

  if (slugTaken) throw badRequest("Category slug already exists");

  category.name = input.name ?? category.name;
  category.slug = nextSlug;
  writeDb(db);
  res.json(category);
});

categoriesRouter.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const db = readDb();
  const category = db.categories.find((item) => item.id === id);

  if (!category) throw notFound("Category not found");

  const hasProducts = db.products.some((product) => product.category === category.slug);
  if (hasProducts) {
    throw badRequest("Cannot delete a category with products");
  }

  db.categories = db.categories.filter((item) => item.id !== id);
  writeDb(db);
  res.status(204).send();
});
