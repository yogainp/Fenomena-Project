-- Database Schema for Supabase Migration
-- Generated from Prisma schema

-- Create custom types
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

CREATE TYPE "AnalysisType" AS ENUM (
  'DESCRIPTIVE_STATS',
  'TREND_ANALYSIS', 
  'CONTENT_ANALYSIS',
  'THEMATIC_ANALYSIS',
  'CORRELATION_ANALYSIS',
  'SURVEY_NOTE_ANALYSIS',
  'NEWS_SCRAPING_ANALYSIS',
  'FENOMENA_INSIGHTS',
  'CORRELATION_MATRIX'
);

-- Create tables

-- Users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regionId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Survey Categories table
CREATE TABLE "survey_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "periodeSurvei" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_categories_pkey" PRIMARY KEY ("id")
);

-- Regions table
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- Phenomena table
CREATE TABLE "phenomena" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "phenomena_pkey" PRIMARY KEY ("id")
);

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

-- Create unique indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "survey_categories_name_key" ON "survey_categories"("name");
CREATE UNIQUE INDEX "regions_regionCode_key" ON "regions"("regionCode");
CREATE UNIQUE INDEX "catatan_survei_categoryId_nomorResponden_key" ON "catatan_survei"("categoryId", "nomorResponden");
CREATE UNIQUE INDEX "scrapping_keywords_keyword_key" ON "scrapping_keywords"("keyword");
CREATE UNIQUE INDEX "scrapping_berita_idBerita_key" ON "scrapping_berita"("idBerita");

-- Create performance indexes
CREATE INDEX "phenomena_categoryId_regionId_idx" ON "phenomena"("categoryId", "regionId");
CREATE INDEX "phenomena_createdAt_idx" ON "phenomena"("createdAt");
CREATE INDEX "phenomena_userId_idx" ON "phenomena"("userId");
CREATE INDEX "catatan_survei_categoryId_regionId_idx" ON "catatan_survei"("categoryId", "regionId");
CREATE INDEX "catatan_survei_createdAt_idx" ON "catatan_survei"("createdAt");
CREATE INDEX "scrapping_berita_tanggalBerita_idx" ON "scrapping_berita"("tanggalBerita");
CREATE INDEX "scrapping_berita_matchedKeywords_idx" ON "scrapping_berita" USING GIN("matchedKeywords");
CREATE INDEX "scrapping_berita_judul_idx" ON "scrapping_berita"("judul");
CREATE INDEX "scrapping_berita_portalBerita_idx" ON "scrapping_berita"("portalBerita");

-- Add foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phenomena" ADD CONSTRAINT "phenomena_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phenomena" ADD CONSTRAINT "phenomena_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "survey_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phenomena" ADD CONSTRAINT "phenomena_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_phenomenonId_fkey" FOREIGN KEY ("phenomenonId") REFERENCES "phenomena"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_catatanSurveiId_fkey" FOREIGN KEY ("catatanSurveiId") REFERENCES "catatan_survei"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_scrappingBeritaId_fkey" FOREIGN KEY ("scrappingBeritaId") REFERENCES "scrapping_berita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catatan_survei" ADD CONSTRAINT "catatan_survei_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catatan_survei" ADD CONSTRAINT "catatan_survei_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "survey_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catatan_survei" ADD CONSTRAINT "catatan_survei_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "survey_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phenomena" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analysis_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catatan_survei" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scrapping_keywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scrapping_berita" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scrapping_schedules" ENABLE ROW LEVEL SECURITY;