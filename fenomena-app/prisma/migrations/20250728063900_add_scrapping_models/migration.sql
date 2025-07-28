-- AlterEnum
ALTER TYPE "AnalysisType" ADD VALUE 'NEWS_SCRAPING_ANALYSIS';

-- AlterTable
ALTER TABLE "analysis_results" ADD COLUMN     "scrappingBeritaId" TEXT;

-- CreateTable
CREATE TABLE "scrapping_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "description" TEXT,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrapping_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrapping_berita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrapping_keywords_keyword_key" ON "scrapping_keywords"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "scrapping_berita_idBerita_key" ON "scrapping_berita"("idBerita");

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_scrappingBeritaId_fkey" FOREIGN KEY ("scrappingBeritaId") REFERENCES "scrapping_berita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
