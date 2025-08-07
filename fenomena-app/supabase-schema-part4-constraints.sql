-- Part 4: Indexes and Constraints

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