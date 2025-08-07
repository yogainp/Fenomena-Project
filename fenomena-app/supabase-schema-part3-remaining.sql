-- Part 3: Remaining tables

-- Analysis Results table
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "analysisType" "AnalysisType" NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phenomenonId" TEXT,
    "catatanSurveiId" TEXT,
    "scrappingBeritaId" TEXT,
    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- Catatan Survei table
CREATE TABLE "catatan_survei" (
    "id" TEXT NOT NULL,
    "nomorResponden" INTEGER NOT NULL,
    "respondenId" TEXT NOT NULL,
    "catatan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "catatan_survei_pkey" PRIMARY KEY ("id")
);

-- Scrapping Keywords table
CREATE TABLE "scrapping_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "description" TEXT,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scrapping_keywords_pkey" PRIMARY KEY ("id")
);

-- Scrapping Berita table
CREATE TABLE "scrapping_berita" (
    "id" TEXT NOT NULL,
    "idBerita" TEXT NOT NULL,
    "portalBerita" TEXT NOT NULL,
    "linkBerita" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "tanggalBerita" TIMESTAMP(3) NOT NULL,
    "tanggalScrap" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scrapping_berita_pkey" PRIMARY KEY ("id")
);

-- Scrapping Schedule table
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scrapping_schedules_pkey" PRIMARY KEY ("id")
);