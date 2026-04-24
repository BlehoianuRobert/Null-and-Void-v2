-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CAREGIVER', 'BLIND_USER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'NEAR', 'MEDIUM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareRelationship" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "blindUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "CareRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "batteryLevel" INTEGER,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "thresholdCritical" INTEGER NOT NULL DEFAULT 30,
    "thresholdNear" INTEGER NOT NULL DEFAULT 80,
    "thresholdMedium" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "distanceCm" INTEGER NOT NULL,
    "severity" "Severity" NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverNotification" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "alertLogId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',

    CONSTRAINT "CaregiverNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "CareRelationship_caregiverId_idx" ON "CareRelationship"("caregiverId");

-- CreateIndex
CREATE INDEX "CareRelationship_blindUserId_idx" ON "CareRelationship"("blindUserId");

-- CreateIndex
CREATE INDEX "CareRelationship_isActive_idx" ON "CareRelationship"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CareRelationship_caregiverId_blindUserId_key" ON "CareRelationship"("caregiverId", "blindUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE INDEX "Device_ownerId_idx" ON "Device"("ownerId");

-- CreateIndex
CREATE INDEX "Device_isOnline_idx" ON "Device"("isOnline");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AlertLog_deviceId_idx" ON "AlertLog"("deviceId");

-- CreateIndex
CREATE INDEX "AlertLog_userId_idx" ON "AlertLog"("userId");

-- CreateIndex
CREATE INDEX "AlertLog_severity_idx" ON "AlertLog"("severity");

-- CreateIndex
CREATE INDEX "AlertLog_triggeredAt_idx" ON "AlertLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "AlertLog_acknowledgedById_idx" ON "AlertLog"("acknowledgedById");

-- CreateIndex
CREATE INDEX "CaregiverNotification_caregiverId_idx" ON "CaregiverNotification"("caregiverId");

-- CreateIndex
CREATE INDEX "CaregiverNotification_readAt_idx" ON "CaregiverNotification"("readAt");

-- CreateIndex
CREATE INDEX "CaregiverNotification_sentAt_idx" ON "CaregiverNotification"("sentAt");

-- AddForeignKey
ALTER TABLE "CareRelationship" ADD CONSTRAINT "CareRelationship_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRelationship" ADD CONSTRAINT "CareRelationship_blindUserId_fkey" FOREIGN KEY ("blindUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverNotification" ADD CONSTRAINT "CaregiverNotification_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverNotification" ADD CONSTRAINT "CaregiverNotification_alertLogId_fkey" FOREIGN KEY ("alertLogId") REFERENCES "AlertLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
