-- CreateTable
CREATE TABLE "SafetyMotionAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peakMagnitudeMs2" DOUBLE PRECISION NOT NULL,
    "deltaMs2" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "SafetyMotionAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyMotionAlert_userId_triggeredAt_idx" ON "SafetyMotionAlert"("userId", "triggeredAt");

-- CreateIndex
CREATE INDEX "SafetyMotionAlert_triggeredAt_idx" ON "SafetyMotionAlert"("triggeredAt");

-- AddForeignKey
ALTER TABLE "SafetyMotionAlert" ADD CONSTRAINT "SafetyMotionAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
