-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "imageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sku" TEXT;
