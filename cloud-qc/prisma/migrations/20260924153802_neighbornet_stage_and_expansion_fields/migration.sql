-- CreateEnum
CREATE TYPE "NeighbornetStage" AS ENUM ('ACTIVE', 'EXPANSION');

-- AlterTable
ALTER TABLE "Neighbornet" ADD COLUMN     "driveUploads" BOOLEAN,
ADD COLUMN     "expansionComments" TEXT,
ADD COLUMN     "mediaLead" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postingConsistently" BOOLEAN,
ADD COLUMN     "stage" "NeighbornetStage" NOT NULL DEFAULT 'ACTIVE';
