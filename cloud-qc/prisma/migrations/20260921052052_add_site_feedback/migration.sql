-- CreateEnum
CREATE TYPE "SiteFeedbackStatus" AS ENUM ('NEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "SiteFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SiteFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "resolvedAt" TIMESTAMP(3),
    "path" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "suggestion" TEXT,
    "context" JSONB,
    "screenshot" TEXT,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "SiteFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteFeedback_status_createdAt_idx" ON "SiteFeedback"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteFeedback" ADD CONSTRAINT "SiteFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
