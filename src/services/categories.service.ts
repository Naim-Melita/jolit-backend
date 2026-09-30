import { CODIGOS } from "../lib/errorCodes.js";
import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import {
  normalizarCodigo,
  prefijoDeCategoria,
  prefijoLibre,
} from "../lib/codigoDePieza.js";
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
      prefix: true,
    },
  });
}

/**
 * El prefijo con el que esta categoria arma los codigos de sus piezas.
 *
 * Si se carga a mano se respeta; si no, sale del nombre. En los dos casos se
 * esquivan los que ya estan tomados: dos categorias con el mismo prefijo
 * harian que el codigo deje de decir que es la pieza.
 */
async function resolverPrefijo(nombre: string, pedido?: string, exceptoId?: number) {
  const tomados = await prisma.category.findMany({
    where: exceptoId ? { id: { not: exceptoId } } : {},
    select: { prefix: true },
  });

  const propuesto = pedido?.trim()
    ? normalizarCodigo(pedido).slice(0, 3).padEnd(3, "X")
    : prefijoDeCategoria(nombre);

  return prefijoLibre(
    propuesto,
    tomados.map((c) => c.prefix)
  );
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
      prefix: await resolverPrefijo(input.name, input.prefix),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      prefix: true,
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

  const nextName = input.name ?? category.name;

  return prisma.category.update({
    where: { id },
    data: {
      name: nextName,
      slug: nextSlug,
      // Solo cambia si lo mandan: el prefijo puede estar pegado en piezas
      // que ya salieron, asi que no se toca por renombrar la categoria.
      prefix:
        input.prefix === undefined
          ? undefined
          : await resolverPrefijo(nextName, input.prefix, id),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      prefix: true,
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
