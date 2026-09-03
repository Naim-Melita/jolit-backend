-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentPreferenceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "orders_paymentPreferenceId_idx" ON "orders"("paymentPreferenceId");
