import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().min(1),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0),
  imageUrl: z.string().url(),
  galleryImages: z.array(z.string().url()).optional().default([]),
  category: z.string().min(2),
  featured: z.coerce.boolean().optional().default(false),
});

export const updateProductSchema = productSchema.partial();
