ALTER TABLE "Device"
ADD COLUMN "lastPhoneSpeedMps" DOUBLE PRECISION,
ADD COLUMN "lastPhoneSpeedAt" TIMESTAMP(3);

CREATE INDEX "Device_lastPhoneSpeedAt_idx" ON "Device"("lastPhoneSpeedAt");
