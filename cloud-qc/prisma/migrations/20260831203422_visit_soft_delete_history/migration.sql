-- CreateEnum
CREATE TYPE "VisitHistoryAction" AS ENUM ('CREATED', 'EDITED', 'DELETED', 'RESTORED');

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VisitHistory" (
    "id" TEXT NOT NULL,
    "action" "VisitHistoryAction" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,

    CONSTRAINT "VisitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitHistory_visitId_performedAt_idx" ON "VisitHistory"("visitId", "performedAt");

-- CreateIndex
CREATE INDEX "Visit_deletedAt_idx" ON "Visit"("deletedAt");

-- AddForeignKey
ALTER TABLE "VisitHistory" ADD CONSTRAINT "VisitHistory_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitHistory" ADD CONSTRAINT "VisitHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
