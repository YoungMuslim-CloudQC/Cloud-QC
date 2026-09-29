-- AlterEnum
ALTER TYPE "DigestCadence" ADD VALUE 'TRIMESTER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertOnNewFeedback" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CoordinatorVisitReview" (
    "id" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,

    CONSTRAINT "CoordinatorVisitReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoordinatorVisitReview_userId_idx" ON "CoordinatorVisitReview"("userId");

-- CreateIndex
CREATE INDEX "CoordinatorVisitReview_visitId_idx" ON "CoordinatorVisitReview"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatorVisitReview_userId_visitId_key" ON "CoordinatorVisitReview"("userId", "visitId");

-- AddForeignKey
ALTER TABLE "CoordinatorVisitReview" ADD CONSTRAINT "CoordinatorVisitReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorVisitReview" ADD CONSTRAINT "CoordinatorVisitReview_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

