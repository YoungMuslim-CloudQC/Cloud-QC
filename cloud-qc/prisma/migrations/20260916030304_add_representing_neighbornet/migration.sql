-- AlterTable
ALTER TABLE "User" ADD COLUMN     "representingNeighbornetId" TEXT;

-- CreateIndex
CREATE INDEX "User_representingNeighbornetId_idx" ON "User"("representingNeighbornetId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_representingNeighbornetId_fkey" FOREIGN KEY ("representingNeighbornetId") REFERENCES "Neighbornet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
