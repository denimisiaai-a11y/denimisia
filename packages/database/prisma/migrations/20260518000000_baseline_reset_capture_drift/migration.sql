-- CreateEnum
CREATE TYPE "CurationSource" AS ENUM ('COLLECTION', 'MANUAL', 'MIXED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_bundleId_fkey";

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_bundleId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variantId_fkey";

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Discount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShippingRate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShippingZone" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SectionCuration" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceMode" "CurationSource" NOT NULL DEFAULT 'COLLECTION',
    "collectionId" TEXT,
    "heading" TEXT,
    "subheading" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "maxItems" INTEGER NOT NULL DEFAULT 12,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionCuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionProduct" (
    "id" TEXT NOT NULL,
    "curationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "customImageAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "originalUrl" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSlot" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mediaKind" "MediaKind" NOT NULL,
    "acceptsVideo" BOOLEAN NOT NULL DEFAULT false,
    "assetId" TEXT,
    "heading" TEXT,
    "subheading" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "groupKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "specWidth" INTEGER NOT NULL,
    "specHeight" INTEGER NOT NULL,
    "specAspect" TEXT NOT NULL,
    "maxBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSlotHistory" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "assetId" TEXT,
    "heading" TEXT,
    "subheading" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "altText" TEXT,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedById" TEXT,

    CONSTRAINT "PageSlotHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionCuration_pageKey_idx" ON "SectionCuration"("pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCuration_pageKey_sectionKey_key" ON "SectionCuration"("pageKey", "sectionKey");

-- CreateIndex
CREATE INDEX "SectionProduct_curationId_position_idx" ON "SectionProduct"("curationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SectionProduct_curationId_productId_key" ON "SectionProduct"("curationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_contentHash_key" ON "MediaAsset"("contentHash");

-- CreateIndex
CREATE INDEX "MediaAsset_kind_idx" ON "MediaAsset"("kind");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE INDEX "PageSlot_pageKey_idx" ON "PageSlot"("pageKey");

-- CreateIndex
CREATE INDEX "PageSlot_groupKey_idx" ON "PageSlot"("groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "PageSlot_pageKey_slotKey_position_key" ON "PageSlot"("pageKey", "slotKey", "position");

-- CreateIndex
CREATE INDEX "PageSlotHistory_slotId_idx" ON "PageSlotHistory"("slotId");

-- CreateIndex
CREATE INDEX "PageSlotHistory_replacedAt_idx" ON "PageSlotHistory"("replacedAt");

-- NOTE: Order_guestEmail_idx is already created as a PARTIAL index by
-- migration 20260517150000_guest_checkout_support (WHERE guestEmail IS
-- NOT NULL). prisma migrate diff cannot express the partial-index WHERE
-- clause in schema.prisma so it asks for a redundant plain-index
-- creation. The partial index is the better one (skips NULLs); leaving
-- it in place. The schema-prisma @@index([guestEmail]) declaration is
-- the closest annotation Prisma's syntax allows.

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCuration" ADD CONSTRAINT "SectionCuration_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionProduct" ADD CONSTRAINT "SectionProduct_curationId_fkey" FOREIGN KEY ("curationId") REFERENCES "SectionCuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionProduct" ADD CONSTRAINT "SectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionProduct" ADD CONSTRAINT "SectionProduct_customImageAssetId_fkey" FOREIGN KEY ("customImageAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSlot" ADD CONSTRAINT "PageSlot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSlotHistory" ADD CONSTRAINT "PageSlotHistory_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PageSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSlotHistory" ADD CONSTRAINT "PageSlotHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

