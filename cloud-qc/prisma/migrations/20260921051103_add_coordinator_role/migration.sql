-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COORDINATOR';

-- CreateTable
CREATE TABLE "NeighbornetCoordinator" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "neighbornetId" TEXT NOT NULL,

    CONSTRAINT "NeighbornetCoordinator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeighbornetCoordinator_neighbornetId_idx" ON "NeighbornetCoordinator"("neighbornetId");

-- CreateIndex
CREATE UNIQUE INDEX "NeighbornetCoordinator_userId_neighbornetId_key" ON "NeighbornetCoordinator"("userId", "neighbornetId");

-- AddForeignKey
ALTER TABLE "NeighbornetCoordinator" ADD CONSTRAINT "NeighbornetCoordinator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeighbornetCoordinator" ADD CONSTRAINT "NeighbornetCoordinator_neighbornetId_fkey" FOREIGN KEY ("neighbornetId") REFERENCES "Neighbornet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
