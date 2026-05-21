-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PANTS', 'SHIRTS', 'JACKETS');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "type" "ProductType";

-- CreateIndex
CREATE INDEX "Product_type_isActive_idx" ON "Product"("type", "isActive");
