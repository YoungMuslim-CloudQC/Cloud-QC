-- AlterTable
ALTER TABLE "Neighbornet" ADD COLUMN     "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "Neighbornet_archivedAt_idx" ON "Neighbornet"("archivedAt");

-- AddForeignKey
ALTER TABLE "Neighbornet" ADD CONSTRAINT "Neighbornet_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
