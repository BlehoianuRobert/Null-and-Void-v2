ALTER TABLE "Device"
ADD COLUMN "lastTempC" DOUBLE PRECISION,
ADD COLUMN "lastPressureHpa" DOUBLE PRECISION,
ADD COLUMN "lastEnvAt" TIMESTAMP(3);

CREATE INDEX "Device_lastEnvAt_idx" ON "Device"("lastEnvAt");
