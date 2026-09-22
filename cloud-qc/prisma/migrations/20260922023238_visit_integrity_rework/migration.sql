-- CreateEnum
CREATE TYPE "VisitDisputeStatus" AS ENUM ('PENDING', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_neighbornetId_fkey";

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "mentionedNeighbornetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subRegion" TEXT,
ALTER COLUMN "neighbornetId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VisitParticipant" ADD COLUMN     "foodRating" SMALLINT,
ADD COLUMN     "halaqahRating" SMALLINT,
ADD COLUMN     "leadershipRating" SMALLINT,
ADD COLUMN     "status" "VisitStatus";

-- CreateTable
CREATE TABLE "VisitNeighbornet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitId" TEXT NOT NULL,
    "neighbornetId" TEXT NOT NULL,

    CONSTRAINT "VisitNeighbornet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitDispute" (
    "id" TEXT NOT NULL,
    "status" "VisitDisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "visitId" TEXT NOT NULL,
    "disputedUserId" TEXT NOT NULL,
    "ownVisitId" TEXT,
    "resolvedById" TEXT,

    CONSTRAINT "VisitDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitNeighbornet_neighbornetId_idx" ON "VisitNeighbornet"("neighbornetId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitNeighbornet_visitId_neighbornetId_key" ON "VisitNeighbornet"("visitId", "neighbornetId");

-- CreateIndex
CREATE INDEX "VisitDispute_status_createdAt_idx" ON "VisitDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VisitDispute_disputedUserId_idx" ON "VisitDispute"("disputedUserId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_neighbornetId_fkey" FOREIGN KEY ("neighbornetId") REFERENCES "Neighbornet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitNeighbornet" ADD CONSTRAINT "VisitNeighbornet_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitNeighbornet" ADD CONSTRAINT "VisitNeighbornet_neighbornetId_fkey" FOREIGN KEY ("neighbornetId") REFERENCES "Neighbornet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitDispute" ADD CONSTRAINT "VisitDispute_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitDispute" ADD CONSTRAINT "VisitDispute_disputedUserId_fkey" FOREIGN KEY ("disputedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitDispute" ADD CONSTRAINT "VisitDispute_ownVisitId_fkey" FOREIGN KEY ("ownVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitDispute" ADD CONSTRAINT "VisitDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
