-- Caregiver notifications: optional hat alert OR phone safety motion (exactly one).

ALTER TABLE "CaregiverNotification" ALTER COLUMN "alertLogId" DROP NOT NULL;

ALTER TABLE "CaregiverNotification" ADD COLUMN "safetyMotionAlertId" TEXT;

CREATE INDEX "CaregiverNotification_safetyMotionAlertId_idx" ON "CaregiverNotification"("safetyMotionAlertId");

ALTER TABLE "CaregiverNotification" ADD CONSTRAINT "CaregiverNotification_safetyMotionAlertId_fkey" FOREIGN KEY ("safetyMotionAlertId") REFERENCES "SafetyMotionAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaregiverNotification" ADD CONSTRAINT "CaregiverNotification_source_chk" CHECK (
  ("alertLogId" IS NOT NULL AND "safetyMotionAlertId" IS NULL)
  OR ("alertLogId" IS NULL AND "safetyMotionAlertId" IS NOT NULL)
);
