-- Part 5: Foreign Key Constraints

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