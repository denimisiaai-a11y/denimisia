-- AlterTable
ALTER TABLE "Wishlist" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Wishlist_shareToken_key" ON "Wishlist"("shareToken");
