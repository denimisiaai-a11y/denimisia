-- CreateTable
CREATE TABLE "ProductSizeChart" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeKey" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "bodyValueIn" DOUBLE PRECISION NOT NULL,
    "garmentValueIn" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductSizeChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSizeChart_productId_idx" ON "ProductSizeChart"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSizeChart_productId_sizeKey_dimension_key" ON "ProductSizeChart"("productId", "sizeKey", "dimension");

-- AddForeignKey
ALTER TABLE "ProductSizeChart" ADD CONSTRAINT "ProductSizeChart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
