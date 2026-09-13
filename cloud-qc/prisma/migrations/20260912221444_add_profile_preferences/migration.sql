-- CreateEnum
CREATE TYPE "DigestCadence" AS ENUM ('OFF', 'WEEKLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'BOTH');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestCadence" "DigestCadence" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "smsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "theme" TEXT DEFAULT 'default';
