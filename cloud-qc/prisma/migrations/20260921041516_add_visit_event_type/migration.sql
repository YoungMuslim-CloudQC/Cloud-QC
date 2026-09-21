-- CreateEnum
CREATE TYPE "VisitEventType" AS ENUM ('VISIT', 'BASH', 'SR_EVENT');

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "eventType" "VisitEventType" NOT NULL DEFAULT 'VISIT';
