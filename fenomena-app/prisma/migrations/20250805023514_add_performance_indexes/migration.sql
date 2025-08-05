-- CreateIndex
CREATE INDEX "catatan_survei_categoryId_regionId_idx" ON "catatan_survei"("categoryId", "regionId");

-- CreateIndex
CREATE INDEX "catatan_survei_createdAt_idx" ON "catatan_survei"("createdAt");

-- CreateIndex
CREATE INDEX "phenomena_categoryId_regionId_idx" ON "phenomena"("categoryId", "regionId");

-- CreateIndex
CREATE INDEX "phenomena_createdAt_idx" ON "phenomena"("createdAt");

-- CreateIndex
CREATE INDEX "phenomena_userId_idx" ON "phenomena"("userId");

-- CreateIndex
CREATE INDEX "scrapping_berita_tanggalBerita_idx" ON "scrapping_berita"("tanggalBerita");

-- CreateIndex
CREATE INDEX "scrapping_berita_matchedKeywords_idx" ON "scrapping_berita"("matchedKeywords");

-- CreateIndex
CREATE INDEX "scrapping_berita_judul_idx" ON "scrapping_berita"("judul");

-- CreateIndex
CREATE INDEX "scrapping_berita_portalBerita_idx" ON "scrapping_berita"("portalBerita");
