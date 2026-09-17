import { CODIGOS } from "../lib/errorCodes.js";
import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import type { categorySchema } from "../schemas.js";
import type { z } from "zod";

type CategoryInput = z.infer<typeof categorySchema>;
type UpdateCategoryInput = Partial<CategoryInput>;

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function createCategory(input: CategoryInput) {
  const slug = input.slug ?? slugify(input.name);
  const slugTaken = await prisma.category.findUnique({ where: { slug } });

  if (slugTaken) {
    throw badRequest("Ya hay una categoria con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function updateCategory(id: number, input: UpdateCategoryInput) {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) throw notFound("No encontramos esa categoria.", CODIGOS.CATEGORIA_NO_ENCONTRADA);

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : category.slug);
  const slugTaken = await prisma.category.findFirst({
    where: {
      id: { not: id },
      slug: nextSlug,
    },
  });

  if (slugTaken) {
    throw badRequest("Ya hay una categoria con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  return prisma.category.update({
    where: { id },
    data: {
      name: input.name ?? category.name,
      slug: nextSlug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function deleteCategory(id: number) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) throw notFound("No encontramos esa categoria.", CODIGOS.CATEGORIA_NO_ENCONTRADA);

  if (category._count.products > 0) {
    throw badRequest(
      "No se puede borrar una categoria que todavia tiene productos.",
      CODIGOS.CATEGORIA_CON_PRODUCTOS
    );
  }

  await prisma.category.delete({ where: { id } });
}
