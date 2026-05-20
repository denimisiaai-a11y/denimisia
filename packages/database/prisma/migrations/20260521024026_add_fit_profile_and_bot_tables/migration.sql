-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fitProfile" JSONB;

-- CreateTable
CREATE TABLE "BotSynonym" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "aliases" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotUnrecognizedQuery" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotUnrecognizedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotSynonym_dimension_idx" ON "BotSynonym"("dimension");

-- CreateIndex
CREATE UNIQUE INDEX "BotSynonym_dimension_canonical_key" ON "BotSynonym"("dimension", "canonical");

-- CreateIndex
CREATE INDEX "BotUnrecognizedQuery_createdAt_idx" ON "BotUnrecognizedQuery"("createdAt");
