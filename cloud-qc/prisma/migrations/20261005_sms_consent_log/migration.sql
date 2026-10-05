-- Append-only SMS consent log. Purely additive: one new enum, one new table,
-- its indexes and a nullable FK. Nothing existing is altered or dropped.

-- CreateEnum
CREATE TYPE "SmsConsentAction" AS ENUM ('GRANTED', 'REVOKED');

-- CreateTable
CREATE TABLE "SmsConsentEvent" (
    "id" TEXT NOT NULL,
    "action" "SmsConsentAction" NOT NULL,
    "phone" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsConsentEvent_phone_createdAt_idx" ON "SmsConsentEvent"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "SmsConsentEvent_userId_idx" ON "SmsConsentEvent"("userId");

-- AddForeignKey
ALTER TABLE "SmsConsentEvent" ADD CONSTRAINT "SmsConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
