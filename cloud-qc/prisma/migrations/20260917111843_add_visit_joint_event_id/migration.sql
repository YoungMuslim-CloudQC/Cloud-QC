-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "jointEventId" TEXT;

-- CreateIndex
CREATE INDEX "Visit_jointEventId_idx" ON "Visit"("jointEventId");
