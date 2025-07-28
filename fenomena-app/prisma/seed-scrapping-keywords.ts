import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedScrappingKeywords() {
  console.log('Seeding default scrapping keywords...');

  const defaultKeywords = [
    // Location keywords (requested)
    { keyword: 'kapuas hulu', category: 'lokasi', description: 'Kabupaten Kapuas Hulu' },
    { keyword: 'kubu raya', category: 'lokasi', description: 'Kabupaten Kubu Raya' },
    { keyword: 'sujiwo', category: 'lokasi', description: 'Wilayah Sujiwo' },
    
    // Additional economic keywords
    { keyword: 'inflasi', category: 'ekonomi', description: 'Terkait dengan inflasi ekonomi' },
    { keyword: 'deflasi', category: 'ekonomi', description: 'Terkait dengan deflasi ekonomi' },
    { keyword: 'investasi', category: 'ekonomi', description: 'Kegiatan investasi' },
    { keyword: 'ekspor', category: 'ekonomi', description: 'Kegiatan ekspor' },
    { keyword: 'impor', category: 'ekonomi', description: 'Kegiatan impor' },
    
    // Development keywords
    { keyword: 'pembangunan', category: 'pembangunan', description: 'Kegiatan pembangunan' },
    { keyword: 'infrastruktur', category: 'pembangunan', description: 'Proyek infrastruktur' },
    { keyword: 'renovasi', category: 'pembangunan', description: 'Kegiatan renovasi' },
    { keyword: 'konstruksi', category: 'pembangunan', description: 'Kegiatan konstruksi' },
    
    // Social keywords
    { keyword: 'pendidikan', category: 'sosial', description: 'Terkait bidang pendidikan' },
    { keyword: 'kesehatan', category: 'sosial', description: 'Terkait bidang kesehatan' },
    { keyword: 'kemiskinan', category: 'sosial', description: 'Isu kemiskinan' },
    { keyword: 'kesejahteraan', category: 'sosial', description: 'Kesejahteraan masyarakat' },
    
    // Technology keywords
    { keyword: 'digitalisasi', category: 'teknologi', description: 'Proses digitalisasi' },
    { keyword: 'otomatisasi', category: 'teknologi', description: 'Proses otomatisasi' },
    { keyword: 'inovasi', category: 'teknologi', description: 'Kegiatan inovasi' },
    
    // Environment keywords
    { keyword: 'lingkungan', category: 'lingkungan', description: 'Isu lingkungan' },
    { keyword: 'polusi', category: 'lingkungan', description: 'Masalah polusi' },
    { keyword: 'konservasi', category: 'lingkungan', description: 'Kegiatan konservasi' },
    
    // Government/Policy keywords
    { keyword: 'kebijakan', category: 'pemerintahan', description: 'Kebijakan pemerintah' },
    { keyword: 'regulasi', category: 'pemerintahan', description: 'Regulasi pemerintah' },
    { keyword: 'program', category: 'pemerintahan', description: 'Program pemerintah' },
  ];

  // Insert keywords using upsert to avoid duplicates
  for (const keywordData of defaultKeywords) {
    try {
      await prisma.scrappingKeyword.upsert({
        where: { keyword: keywordData.keyword },
        update: {
          category: keywordData.category,
          description: keywordData.description,
          isActive: true,
        },
        create: {
          keyword: keywordData.keyword,
          category: keywordData.category,
          description: keywordData.description,
          isActive: true,
          matchCount: 0,
        },
      });
      console.log(`✓ Keyword "${keywordData.keyword}" seeded successfully`);
    } catch (error) {
      console.error(`✗ Error seeding keyword "${keywordData.keyword}":`, error);
    }
  }

  // Get final count
  const totalKeywords = await prisma.scrappingKeyword.count();
  const activeKeywords = await prisma.scrappingKeyword.count({
    where: { isActive: true },
  });

  console.log(`\n📊 Seeding completed:`);
  console.log(`   Total keywords: ${totalKeywords}`);
  console.log(`   Active keywords: ${activeKeywords}`);
  console.log(`   Categories: ${Array.from(new Set(defaultKeywords.map(k => k.category))).join(', ')}`);
}

async function main() {
  try {
    await seedScrappingKeywords();
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { seedScrappingKeywords };