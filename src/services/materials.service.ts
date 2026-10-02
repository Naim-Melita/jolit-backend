import { CODIGOS } from "../lib/errorCodes.js";
import {
  normalizarCodigo,
  prefijoDeMaterial,
  prefijoLibre,
} from "../lib/codigoDePieza.js";
import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { slugify } from "../lib/slug.js";
import type { materialSchema } from "../schemas.js";
import type { z } from "zod";

type MaterialInput = z.infer<typeof materialSchema>;
type UpdateMaterialInput = Partial<MaterialInput>;

const campos = {
  id: true,
  name: true,
  slug: true,
  prefix: true,
} as const;

export async function listMaterials() {
  return prisma.material.findMany({
    orderBy: { id: "asc" },
    select: campos,
  });
}

/**
 * El prefijo con el que este material arma los codigos.
 *
 * Si se carga a mano se respeta; si no, sale del nombre. En los dos casos se
 * esquivan los que ya estan tomados.
 */
async function resolverPrefijo(nombre: string, pedido?: string, exceptoId?: number) {
  const tomados = await prisma.material.findMany({
    where: exceptoId ? { id: { not: exceptoId } } : {},
    select: { prefix: true },
  });

  const propuesto = pedido?.trim()
    ? normalizarCodigo(pedido).slice(0, 3).padEnd(3, "X")
    : prefijoDeMaterial(nombre);

  return prefijoLibre(
    propuesto,
    tomados.map((m) => m.prefix)
  );
}

/**
 * El enlace, siempre en formato de enlace.
 *
 * Lo mismo que en las categorias: el campo es libre y lo que se escribe a
 * mano se normaliza, para que no queden enlaces con mayusculas ni espacios.
 */
function resolverSlug(nombre: string, pedido?: string | null) {
  const aMano = pedido?.trim() ? slugify(pedido) : "";

  return aMano || slugify(nombre);
}

export async function createMaterial(input: MaterialInput) {
  const slug = resolverSlug(input.name, input.slug);
  const slugTaken = await prisma.material.findUnique({ where: { slug } });

  if (slugTaken) {
    throw badRequest("Ya hay un material con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  return prisma.material.create({
    data: {
      name: input.name,
      slug,
      prefix: await resolverPrefijo(input.name, input.prefix),
    },
    select: campos,
  });
}

export async function updateMaterial(id: number, input: UpdateMaterialInput) {
  const material = await prisma.material.findUnique({ where: { id } });

  if (!material) {
    throw notFound("No encontramos ese material.", CODIGOS.MATERIAL_NO_ENCONTRADO);
  }

  const nextSlug =
    input.slug !== undefined || input.name !== undefined
      ? resolverSlug(input.name ?? material.name, input.slug)
      : material.slug;
  const slugTaken = await prisma.material.findFirst({
    where: { id: { not: id }, slug: nextSlug },
  });

  if (slugTaken) {
    throw badRequest("Ya hay un material con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  const nextName = input.name ?? material.name;

  return prisma.material.update({
    where: { id },
    data: {
      name: nextName,
      slug: nextSlug,
      // Solo cambia si lo mandan: el prefijo puede estar pegado en piezas que
      // ya salieron, asi que no se toca por renombrar el material.
      prefix:
        input.prefix === undefined
          ? undefined
          : await resolverPrefijo(nextName, input.prefix, id),
    },
    select: campos,
  });
}

export async function deleteMaterial(id: number) {
  const material = await prisma.material.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!material) {
    throw notFound("No encontramos ese material.", CODIGOS.MATERIAL_NO_ENCONTRADO);
  }

  // Igual que con las categorias: borrarlo dejaria piezas cuyo codigo dice
  // BLA sin que exista ya ningun "acero blanco" que lo explique.
  if (material._count.products > 0) {
    throw badRequest(
      "No se puede borrar un material que todavia tiene productos.",
      CODIGOS.MATERIAL_CON_PRODUCTOS
    );
  }

  await prisma.material.delete({ where: { id } });
}
