-- CreateTable
CREATE TABLE "scrapping_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portalUrl" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL DEFAULT 5,
    "delayMs" INTEGER NOT NULL DEFAULT 2000,
    "cronSchedule" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrapping_schedules_pkey" PRIMARY KEY ("id")
);
