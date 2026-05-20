-- CreateEnum
CREATE TYPE "TagDimension" AS ENUM ('silhouette', 'rise', 'length', 'wash', 'sleeve', 'neckline', 'closure', 'warmth', 'season', 'occasion', 'material', 'pattern');

-- CreateTable
CREATE TABLE "ProductTag" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dimension" "TagDimension" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTag_dimension_value_idx" ON "ProductTag"("dimension", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTag_productId_dimension_value_key" ON "ProductTag"("productId", "dimension", "value");

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
