-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('COORDINATOR', 'SR_COORDINATOR', 'CORE_TEAM');

-- CreateEnum
CREATE TYPE "RequestedRole" AS ENUM ('MEMBER', 'COORDINATOR');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('MEMBER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- DropForeignKey
ALTER TABLE "NeighbornetCoordinator" DROP CONSTRAINT "NeighbornetCoordinator_neighbornetId_fkey";

-- DropForeignKey
ALTER TABLE "NeighbornetCoordinator" DROP CONSTRAINT "NeighbornetCoordinator_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "requestedNeighbornetId" TEXT,
ADD COLUMN     "requestedRole" "RequestedRole";

-- DropTable
DROP TABLE "NeighbornetCoordinator";

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeNeighbornetId" TEXT,
    "scopeSubregion" TEXT,
    "inheritsFromUserId" TEXT,
    "transitionEndsAt" TIMESTAMP(3),
    "grantedById" TEXT,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleType_idx" ON "UserRoleAssignment"("roleType");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_scopeNeighbornetId_idx" ON "UserRoleAssignment"("scopeNeighbornetId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_scopeSubregion_idx" ON "UserRoleAssignment"("scopeSubregion");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_inheritsFromUserId_idx" ON "UserRoleAssignment"("inheritsFromUserId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_transitionEndsAt_idx" ON "UserRoleAssignment"("transitionEndsAt");

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_scopeNeighbornetId_fkey" FOREIGN KEY ("scopeNeighbornetId") REFERENCES "Neighbornet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_inheritsFromUserId_fkey" FOREIGN KEY ("inheritsFromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

