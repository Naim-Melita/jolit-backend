import "dotenv/config";
import { armarCodigo, serieDe } from "../lib/codigoDePieza.js";
import { prisma } from "../lib/prisma.js";

/**
 * Reinicia los codigos de pieza: los borra todos y los vuelve a numerar
 * desde 0001, serie por serie.
 *
 *   npm run codigos:reiniciar            muestra que haria, no toca nada
 *   npm run codigos:reiniciar -- --aplicar   lo hace
 *
 * Una serie es el par categoria + material. Dentro de cada una, las piezas se
 * numeran por antiguedad (por id), asi que la primera que cargaste queda
 * 0001.
 *
 * CUIDADO: si una pieza ya tiene la etiqueta pegada, su codigo nuevo deja de
 * coincidir con el papel. Correr esto solo antes de etiquetar, o volviendo a
 * etiquetar despues.
 *
 * Los codigos viejos quedan impresos en los comprobantes de pedidos que ya
 * salieron. Eso no se toca: el comprobante guarda su propia copia del codigo
 * al momento de la compra, asi que un pedido viejo sigue mostrando lo que
 * decia la etiqueta cuando se vendio.
 */

const aplicar = process.argv.includes("--aplicar");

async function main() {
  const productos = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { name: true, prefix: true } },
      material: { select: { name: true, prefix: true } },
    },
  });

  if (productos.length === 0) {
    console.log("\nNo hay productos cargados.\n");
    return;
  }

  const contadorPorSerie = new Map<string, number>();
  const cambios: Array<{ id: number; nombre: string; antes: string; ahora: string }> = [];

  for (const producto of productos) {
    const serie = serieDe(producto.category.prefix, producto.material?.prefix);
    const numero = (contadorPorSerie.get(serie) ?? 0) + 1;
    contadorPorSerie.set(serie, numero);

    cambios.push({
      id: producto.id,
      nombre: producto.name,
      antes: producto.sku ?? "(sin código)",
      ahora: armarCodigo(serie, numero),
    });
  }

  console.log(`\n${aplicar ? "Reiniciando" : "Prueba en seco"}: ${cambios.length} piezas\n`);
  console.log("  ANTES           AHORA           PIEZA");
  for (const c of cambios) {
    const flecha = c.antes === c.ahora ? "=" : " ";
    console.log(`${flecha} ${c.antes.padEnd(15)} ${c.ahora.padEnd(15)} ${c.nombre}`);
  }

  const sinMaterial = productos.filter((p) => !p.material).length;
  if (sinMaterial > 0) {
    console.log(
      `\n${sinMaterial} de ${productos.length} piezas no tienen material cargado, asi que su` +
        "\ncodigo queda con el formato corto (ARO-0001). Cargales el material y" +
        "\nvolve a correr esto para que queden como ARO-BLA-0001."
    );
  }

  if (!aplicar) {
    console.log("\nNo se cambio nada. Para aplicarlo:\n");
    console.log("  npm run códigos:reiniciar -- --aplicar\n");
    return;
  }

  // Se hace en dos pasadas dentro de una transaccion porque el codigo es
  // unico: asignar directo chocaria con la pieza que todavia lo tiene. Se
  // vacian todos primero y recien despues se escriben los nuevos.
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ data: { sku: null } });

    for (const c of cambios) {
      await tx.product.update({ where: { id: c.id }, data: { sku: c.ahora } });
    }
  });

  console.log("\nListo. Los códigos quedaron reiniciados.\n");
}

main()
  .catch((error) => {
    console.error("\nNo se pudo reiniciar:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
