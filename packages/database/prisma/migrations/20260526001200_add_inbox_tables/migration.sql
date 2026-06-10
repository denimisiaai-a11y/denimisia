-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ThreadCloseReason" AS ENUM ('ADMIN_RESOLVED', 'CUSTOMER_RESOLVED', 'INACTIVE_14D');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'ADMIN', 'BOT');

-- CreateTable
CREATE TABLE "InboxThread" (
    "id" TEXT NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "closeReason" "ThreadCloseReason",
    "closedAt" TIMESTAMP(3),
    "userId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdminEmailAt" TIMESTAMP(3),
    "consecutiveAdminMessages" INTEGER NOT NULL DEFAULT 0,
    "customerLastSeenAt" TIMESTAMP(3),

    CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxThread_status_lastMessageAt_idx" ON "InboxThread"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "InboxThread_guestEmail_idx" ON "InboxThread"("guestEmail");

-- CreateIndex
CREATE INDEX "InboxThread_userId_idx" ON "InboxThread"("userId");

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "images" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inReplyToId" TEXT,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxMessage_threadId_createdAt_idx" ON "InboxMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_inReplyToId_fkey" FOREIGN KEY ("inReplyToId") REFERENCES "InboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InboxMagicLink" (
    "token" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxMagicLink_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "InboxMagicLink_threadId_idx" ON "InboxMagicLink"("threadId");

-- CreateIndex
CREATE INDEX "InboxMagicLink_expiresAt_idx" ON "InboxMagicLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "InboxMagicLink" ADD CONSTRAINT "InboxMagicLink_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
