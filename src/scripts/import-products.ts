import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { leerCsv } from "../lib/csv.js";
import { leerPrecio } from "../lib/precio.js";
import { prisma } from "../lib/prisma.js";
import { normalizarCodigo, siguienteCodigo } from "../lib/codigoDePieza.js";
import { slugify } from "../lib/slug.js";
import { uploadImageToCloudinary } from "../services/uploads.service.js";

/**
 * Carga productos desde una planilla.
 *
 *   npm run productos:importar -- --archivo=productos.csv --probar
 *   npm run productos:importar -- --archivo=productos.csv --fotos=./fotos
 *
 * Columnas de la planilla (la primera fila son los titulos):
 *
 *   nombre       obligatorio
 *   codigo       opcional, el codigo interno de la pieza
 *   descripcion  obligatorio
 *   precio       obligatorio
 *   stock        obligatorio
 *   categoria    obligatorio, se crea sola si no existe
 *   fotos        opcional, varias separadas con |
 *   destacado    opcional, "si" para que aparezca primero
 *
 * En "fotos" pueden ir URLs ya subidas, o nombres de archivo de la carpeta
 * que se pase en --fotos, que se suben solos a Cloudinary.
 *
 * Como funciona:
 *
 * - Valida TODA la planilla antes de escribir nada. Si una fila esta mal, no
 *   se importa ninguna: es preferible corregir la planilla a quedarse con
 *   media carga hecha.
 * - Con --probar muestra que haria y no toca la base.
 * - Identifica los productos por su enlace (derivado del nombre): correr el
 *   comando dos veces ACTUALIZA, no duplica. Si te equivocaste en un precio,
 *   arreglas la planilla y lo corres de nuevo.
 * - Nunca borra productos. Lo que no este en la planilla queda como esta.
 */

type Fila = {
  numeroDeFila: number;
  nombre: string;
  codigo: string;
  slug: string;
  descripcion: string;
  precio: number;
  stock: number;
  categoria: string;
  categoriaSlug: string;
  fotos: string[];
  destacado: boolean;
};

function leerOpcion(nombre: string) {
  const prefijo = `--${nombre}=`;
  const encontrado = process.argv.find((a) => a.startsWith(prefijo));
  return encontrado ? encontrado.slice(prefijo.length) : "";
}

const tieneBandera = (nombre: string) => process.argv.includes(`--${nombre}`);

const esUrl = (valor: string) => /^https?:\/\//i.test(valor);

function interpretarFila(
  registro: Record<string, string>,
  numeroDeFila: number
): { fila?: Fila; errores: string[] } {
  const errores: string[] = [];
  const texto = (columna: string) => (registro[columna] ?? "").trim();

  const nombre = texto("nombre");
  const codigo = texto("codigo");
  const descripcion = texto("descripcion");
  const categoria = texto("categoria");
  const precioCrudo = texto("precio");
  const stockCrudo = texto("stock");

  if (!nombre) errores.push("falta el nombre");
  if (!descripcion) errores.push("falta la descripcion");
  if (!categoria) errores.push("falta la categoria");

  const precio = leerPrecio(precioCrudo);
  if (precio === null) errores.push(`el precio "${precioCrudo}" no se entiende`);
  else if (precio <= 0) errores.push("el precio tiene que ser mayor a cero");

  const stock = Number(stockCrudo);
  if (!stockCrudo) errores.push("falta el stock");
  else if (!Number.isInteger(stock) || stock < 0) {
    errores.push(`el stock "${stockCrudo}" tiene que ser un numero entero`);
  }

  const fotos = texto("fotos")
    .split("|")
    .map((f) => f.trim())
    .filter(Boolean);

  const destacado = ["si", "sí", "x", "true", "1"].includes(
    texto("destacado").toLowerCase()
  );

  if (errores.length > 0) return { errores };

  return {
    errores: [],
    fila: {
      numeroDeFila,
      nombre,
      codigo,
      slug: slugify(nombre),
      descripcion,
      precio: precio as number,
      stock,
      categoria,
      categoriaSlug: slugify(categoria),
      fotos,
      destacado,
    },
  };
}

/** Resuelve cada foto a una URL, subiendo a Cloudinary las que sean archivos. */
async function resolverFotos(
  fila: Fila,
  carpeta: string,
  archivosDisponibles: string[],
  cache: Map<string, string>
) {
  const urls: string[] = [];

  for (const foto of fila.fotos) {
    if (esUrl(foto)) {
      urls.push(foto);
      continue;
    }

    if (cache.has(foto)) {
      urls.push(cache.get(foto) as string);
      continue;
    }

    const archivo = archivosDisponibles.find(
      (a) => a.toLowerCase() === foto.toLowerCase()
    );

    if (!archivo) {
      throw new Error(`no encontre la foto "${foto}" en ${carpeta}`);
    }

    const contenido = await readFile(path.join(carpeta, archivo));
    const subida = await uploadImageToCloudinary({
      buffer: contenido,
      originalName: archivo,
    });

    cache.set(foto, subida.imageUrl);
    urls.push(subida.imageUrl);
  }

  return urls;
}

/**
 * Codigo de la pieza: el de la planilla si lo trae, o uno correlativo de la
 * categoria. Con cien filas, dejar que se generen solos evita repetidos.
 */
async function codigoParaLaFila(fila: Fila, categoria: { id: number; name: string }) {
  if (fila.codigo) return normalizarCodigo(fila.codigo);

  const existentes = await prisma.product.findMany({
    where: { categoryId: categoria.id, sku: { not: null } },
    select: { sku: true },
  });

  return siguienteCodigo(categoria.name, existentes.map((p) => p.sku as string));
}

async function guardarProducto(fila: Fila, urls: string[]) {
  const categoria = await prisma.category.upsert({
    where: { slug: fila.categoriaSlug },
    create: { slug: fila.categoriaSlug, name: fila.categoria },
    update: {},
  });

  const producto = await prisma.product.upsert({
    where: { slug: fila.slug },
    create: {
      slug: fila.slug,
      sku: await codigoParaLaFila(fila, categoria),
      name: fila.nombre,
      description: fila.descripcion,
      featured: fila.destacado,
      categoryId: categoria.id,
    },
    update: {
      ...(fila.codigo ? { sku: normalizarCodigo(fila.codigo) } : {}),
      name: fila.nombre,
      description: fila.descripcion,
      featured: fila.destacado,
      categoryId: categoria.id,
    },
  });

  // Las fotos solo se reemplazan si la planilla trae alguna: asi se puede
  // corregir un precio sin volver a subir las imagenes.
  if (urls.length > 0) {
    await prisma.productImage.deleteMany({ where: { productId: producto.id } });
    await prisma.productImage.createMany({
      data: urls.map((url, indice) => ({
        productId: producto.id,
        url,
        alt: fila.nombre,
        position: indice,
        isPrimary: indice === 0,
      })),
    });
  }

  const precioActual = await prisma.productPrice.findFirst({
    where: { productId: producto.id, active: true },
  });

  if (!precioActual || Number(precioActual.amount.toString()) !== fila.precio) {
    await prisma.productPrice.updateMany({
      where: { productId: producto.id, active: true },
      data: { active: false },
    });
    await prisma.productPrice.create({
      data: {
        productId: producto.id,
        amount: fila.precio,
        currency: "ARS",
        active: true,
      },
    });
  }

  await prisma.inventory.upsert({
    where: { productId: producto.id },
    create: { productId: producto.id, quantity: fila.stock },
    update: { quantity: fila.stock },
  });

  return producto;
}

async function main() {
  const archivo = leerOpcion("archivo");
  const carpetaFotos = leerOpcion("fotos");
  const soloProbar = tieneBandera("probar");

  if (!archivo) {
    console.error(
      "Falta la planilla.\n\n" +
        "  npm run productos:importar -- --archivo=productos.csv --probar\n" +
        "  npm run productos:importar -- --archivo=productos.csv --fotos=./fotos\n"
    );
    process.exit(1);
  }

  const contenido = await readFile(path.resolve(archivo), "utf8");
  const registros = leerCsv(contenido);

  if (registros.length === 0) {
    console.error("La planilla no tiene filas.");
    process.exit(1);
  }

  // --- 1) validar todo antes de tocar la base
  const filas: Fila[] = [];
  const problemas: string[] = [];
  const slugsVistos = new Map<string, number>();

  registros.forEach((registro, indice) => {
    const numeroDeFila = indice + 2; // +1 por los titulos, +1 porque se cuenta desde 1
    const { fila, errores } = interpretarFila(registro, numeroDeFila);

    if (!fila) {
      problemas.push(`  fila ${numeroDeFila}: ${errores.join("; ")}`);
      return;
    }

    const repetida = slugsVistos.get(fila.slug);
    if (repetida) {
      problemas.push(
        `  fila ${numeroDeFila}: "${fila.nombre}" repite el nombre de la fila ${repetida}`
      );
      return;
    }

    slugsVistos.set(fila.slug, numeroDeFila);
    filas.push(fila);
  });

  if (problemas.length > 0) {
    console.error(`\nLa planilla tiene ${problemas.length} problema(s):\n`);
    console.error(problemas.join("\n"));
    console.error("\nNo se importo nada. Corregi la planilla y volve a correr.\n");
    process.exit(1);
  }

  // --- 2) resumen de lo que va a pasar
  const existentes = await prisma.product.findMany({
    where: { slug: { in: filas.map((f) => f.slug) } },
    select: { slug: true },
  });
  const yaEstan = new Set(existentes.map((p) => p.slug));

  const nuevos = filas.filter((f) => !yaEstan.has(f.slug));
  const actualizados = filas.filter((f) => yaEstan.has(f.slug));
  const categorias = new Set(filas.map((f) => f.categoria));
  const sinFoto = filas.filter((f) => f.fotos.length === 0);

  console.log("");
  console.log(`Planilla: ${archivo}`);
  console.log(`  filas leidas : ${filas.length}`);
  console.log(`  nuevos       : ${nuevos.length}`);
  console.log(`  a actualizar : ${actualizados.length}`);
  console.log(`  categorias   : ${[...categorias].join(", ")}`);
  console.log("");

  if (sinFoto.length > 0) {
    console.log(`  ${sinFoto.length} producto(s) sin foto:`);
    for (const f of sinFoto.slice(0, 5)) {
      console.log(`    fila ${f.numeroDeFila}: ${f.nombre}`);
    }
    if (sinFoto.length > 5) console.log(`    ...y ${sinFoto.length - 5} mas`);
    console.log("");
    console.log("  Un producto sin foto no se puede mostrar en la tienda.");
    console.log("");
  }

  console.log("Primeras filas, como las entendi:");
  for (const f of filas.slice(0, 5)) {
    console.log(
      `  ${f.nombre}${f.codigo ? ` [${f.codigo}]` : ""}  |  $${f.precio.toLocaleString("es-AR")}  |  stock ${f.stock}  |  ${f.categoria}  |  ${f.fotos.length} foto(s)`
    );
  }
  console.log("");

  if (soloProbar) {
    console.log("Modo prueba: no se escribio nada.");
    console.log("Revisa los precios de arriba y, si estan bien, corre sin --probar.\n");
    return;
  }

  // --- 3) importar
  const archivosDisponibles = carpetaFotos
    ? await readdir(path.resolve(carpetaFotos))
    : [];
  const cacheDeFotos = new Map<string, string>();

  let hechos = 0;

  for (const fila of filas) {
    try {
      const urls = await resolverFotos(
        fila,
        carpetaFotos,
        archivosDisponibles,
        cacheDeFotos
      );
      await guardarProducto(fila, urls);
      hechos += 1;
      console.log(`  [${hechos}/${filas.length}] ${fila.nombre}`);
    } catch (error: any) {
      console.error(
        `\nSe corto en la fila ${fila.numeroDeFila} ("${fila.nombre}"): ${error?.message ?? error}`
      );
      console.error(
        `Se importaron ${hechos} productos. Corregi y volve a correr: los ya importados se actualizan, no se duplican.\n`
      );
      process.exit(1);
    }
  }

  console.log("");
  console.log(`Listo: ${hechos} producto(s) en la tienda.`);
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
