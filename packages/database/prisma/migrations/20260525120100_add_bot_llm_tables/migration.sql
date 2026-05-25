-- CreateTable
CREATE TABLE "BotLlmQuota" (
    "date" DATE NOT NULL,
    "neuronsUsed" INTEGER NOT NULL DEFAULT 0,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotLlmQuota_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "BotLlmCache" (
    "queryHash" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "retrievedSources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLlmCache_pkey" PRIMARY KEY ("queryHash")
);

-- CreateIndex
CREATE INDEX "BotLlmCache_createdAt_idx" ON "BotLlmCache"("createdAt");

-- CreateTable
CREATE TABLE "BotLlmAudit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "promptHash" TEXT NOT NULL,
    "replyHash" TEXT NOT NULL,
    "retrievedSources" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "outputFiltered" BOOLEAN NOT NULL DEFAULT false,
    "injectionFlagged" BOOLEAN NOT NULL DEFAULT false,
    "queryPreview" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLlmAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotLlmAudit_createdAt_idx" ON "BotLlmAudit"("createdAt");

-- CreateIndex
CREATE INDEX "BotLlmAudit_userId_idx" ON "BotLlmAudit"("userId");
