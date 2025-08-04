-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AnalysisType" ADD VALUE 'FENOMENA_INSIGHTS';
ALTER TYPE "AnalysisType" ADD VALUE 'CORRELATION_MATRIX';

-- AlterTable
ALTER TABLE "survey_categories" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "periodeSurvei" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);
