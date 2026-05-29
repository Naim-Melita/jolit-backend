import type { Product } from "../types.js";

type ProductWithRelations = {
  id: number;
  slug: string;
  name: string;
  description: string;
  featured: boolean;
  category: {
    slug: string;
  };
  images: Array<{
    url: string;
    position: number;
    isPrimary: boolean;
  }>;
  prices: Array<{
    amount: { toString(): string };
    active: boolean;
  }>;
  inventory: {
    quantity: number;
  } | null;
};

export function toProductResponse(product: ProductWithRelations): Product {
  const images = [...product.images].sort((a, b) => a.position - b.position);
  const primaryImage =
    images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? "";
  const activePrice =
    product.prices.find((price) => price.active) ?? product.prices[0];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: formatMoney(activePrice?.amount),
    stock: product.inventory?.quantity ?? 0,
    imageUrl: primaryImage,
    galleryImages: images.map((image) => image.url),
    category: product.category.slug,
    featured: product.featured,
  };
}

function formatMoney(value: { toString(): string } | undefined) {
  return Number(value?.toString() ?? 0).toFixed(2);
}
