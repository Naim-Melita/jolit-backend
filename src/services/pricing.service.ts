import { CODIGOS } from "../lib/errorCodes.js";
import { badRequest } from "../lib/http.js";
import { toMoney } from "../lib/money.js";
import { prisma } from "../lib/prisma.js";

export type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export type PricedItem = {
  productId: number;
  slug: string;
  name: string;
  /** Codigo interno, si la pieza tiene uno cargado. */
  sku: string | null;
  /** Foto principal al momento de comprar, para el mail y el comprobante. */
  imageUrl: string;
  price: string;
  quantity: number;
  subtotal: string;
};

/**
 * Resuelve precio y subtotal de los items contra la base de datos.
 * El cliente solo manda productId y quantity: la plata siempre sale de aca.
 */
export async function priceItems(
  client: PrismaTransaction,
  inputItems: Array<{ productId: number; quantity: number }>,
  options: { checkStock: boolean }
): Promise<{ items: PricedItem[]; subtotal: number }> {
  const items: PricedItem[] = [];
  let subtotal = 0;

  for (const item of inputItems) {
    const product = await client.product.findUnique({
      where: { id: item.productId },
      include: {
        inventory: true,
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        prices: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!product) {
      throw badRequest(
      "Uno de los productos que elegiste ya no esta disponible.",
      CODIGOS.PRODUCTO_NO_ENCONTRADO
    );
    }

    if (options.checkStock) {
      const stock = product.inventory?.quantity ?? 0;
      if (stock < item.quantity) {
        throw badRequest(
        `Nos quedamos sin stock de ${product.name}.`,
        CODIGOS.STOCK_INSUFICIENTE
      );
      }
    }

    const activePrice = product.prices[0];
    if (!activePrice) {
      throw badRequest(
        `${product.name} no tiene un precio cargado.`,
        CODIGOS.PRODUCTO_SIN_PRECIO
      );
    }

    const price = Number(activePrice.amount.toString());
    const itemSubtotal = price * item.quantity;
    subtotal += itemSubtotal;

    items.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      imageUrl: product.images[0]?.url ?? "",
      price: toMoney(price),
      quantity: item.quantity,
      subtotal: toMoney(itemSubtotal),
    });
  }

  return { items, subtotal };
}
