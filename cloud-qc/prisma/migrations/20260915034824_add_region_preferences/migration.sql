-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestSubAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "homeRegion" TEXT,
ADD COLUMN     "homeSubArea" TEXT;
