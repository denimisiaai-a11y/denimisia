-- Fit-silhouette engine baseline:
--   1. Silhouette table — two rows (MALE, FEMALE) seeded in Task A4.
--      Holds the body-outline SVG path + landmark coordinates the fit
--      visualizer renders measurements on top of.
--   2. Product.fitLandmarks — per-product JSON column storing the
--      discriminated-union fit data (PantsFit | ShirtFit | JacketFit)
--      defined in @repo/fit-engine/src/types.ts.
--
-- Both are additive; no destructive changes.

-- CreateEnum
CREATE TYPE "SilhouetteGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "fitLandmarks" JSONB;

-- CreateTable
CREATE TABLE "Silhouette" (
    "id" TEXT NOT NULL,
    "gender" "SilhouetteGender" NOT NULL,
    "svgPath" TEXT NOT NULL,
    "viewBox" TEXT NOT NULL,
    "landmarks" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Silhouette_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Silhouette_gender_key" ON "Silhouette"("gender");
