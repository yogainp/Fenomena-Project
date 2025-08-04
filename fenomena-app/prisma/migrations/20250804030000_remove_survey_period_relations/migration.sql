-- DropForeignKey
ALTER TABLE "phenomena" DROP CONSTRAINT IF EXISTS "phenomena_periodId_fkey";
ALTER TABLE "catatan_survei" DROP CONSTRAINT IF EXISTS "catatan_survei_periodId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "catatan_survei_categoryId_periodId_nomorResponden_key";

-- AlterTable
ALTER TABLE "phenomena" DROP COLUMN IF EXISTS "periodId";
ALTER TABLE "catatan_survei" DROP COLUMN IF EXISTS "periodId";

-- Update respondenId format to remove periodId reference
UPDATE "catatan_survei" SET "respondenId" = "categoryId" || '-' || "nomorResponden";

-- CreateIndex  
CREATE UNIQUE INDEX "catatan_survei_categoryId_nomorResponden_key" ON "catatan_survei"("categoryId", "nomorResponden");

-- DropTable
DROP TABLE IF EXISTS "survey_periods";