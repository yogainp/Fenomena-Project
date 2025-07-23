import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Kalimantan Barat regions first
  console.log('🗺️ Seeding Kalimantan Barat regions...');
  
  const kalimantanBaratRegions = [
    // Kota
    { province: 'Kalimantan Barat', city: 'Kota Pontianak', regionCode: '6171' },
    { province: 'Kalimantan Barat', city: 'Kota Singkawang', regionCode: '6172' },
    
    // Kabupaten
    { province: 'Kalimantan Barat', city: 'Kabupaten Sambas', regionCode: '6101' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Bengkayang', regionCode: '6102' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Landak', regionCode: '6103' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Mempawah', regionCode: '6104' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Sanggau', regionCode: '6105' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Ketapang', regionCode: '6106' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Sintang', regionCode: '6107' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Kapuas Hulu', regionCode: '6108' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Sekadau', regionCode: '6109' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Melawi', regionCode: '6110' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Kayong Utara', regionCode: '6111' },
    { province: 'Kalimantan Barat', city: 'Kabupaten Kubu Raya', regionCode: '6112' },
  ];

  const createdRegions = [];
  for (const regionData of kalimantanBaratRegions) {
    const region = await prisma.region.upsert({
      where: { regionCode: regionData.regionCode },
      update: {},
      create: regionData,
    });
    createdRegions.push(region);
    console.log(`   ✓ ${region.city} (${region.regionCode})`);
  }

  // Get default regions for users
  const pontianakRegion = createdRegions.find(r => r.regionCode === '6171');
  const sambasRegion = createdRegions.find(r => r.regionCode === '6101');

  // Create admin user with region
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fenomena.com' },
    update: {},
    create: {
      email: 'admin@fenomena.com',
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
      regionId: pontianakRegion?.id, // Admin di Kota Pontianak
    },
  });

  // Create regular user with region
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@fenomena.com' },
    update: {},
    create: {
      email: 'user@fenomena.com',
      username: 'testuser',
      password: userPassword,
      role: 'USER',
      regionId: sambasRegion?.id, // User di Kabupaten Sambas
    },
  });

  console.log('👤 Created users:');
  console.log('   Admin - Email: admin@fenomena.com, Password: admin123');
  console.log('   User  - Email: user@fenomena.com, Password: user123');

  // Create sample survey categories
  const categories = [
    {
      name: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      description: 'Survei yang mengumpulkan data kondisi sosial ekonomi rumah tangga'
    },
    {
      name: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      description: 'Survei untuk mengumpulkan data ketenagakerjaan'
    },
    {
      name: 'Survei Pertanian',
      description: 'Survei yang berkaitan dengan sektor pertanian dan perkebunan'
    },
    {
      name: 'Survei Industri',
      description: 'Survei untuk mengumpulkan data industri manufaktur'
    },
    {
      name: 'Survei Perdagangan',
      description: 'Survei yang mengumpulkan data perdagangan dalam dan luar negeri'
    }
  ];

  for (const category of categories) {
    await prisma.surveyCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log('📊 Created survey categories');

  // Create sample survey periods
  const periods = [
    {
      name: 'Triwulan I 2024',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    },
    {
      name: 'Triwulan II 2024',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
    },
    {
      name: 'Triwulan III 2024',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30'),
    },
    {
      name: 'Triwulan IV 2024',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-12-31'),
    },
    {
      name: 'Semester I 2024',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-30'),
    }
  ];

  for (const period of periods) {
    await prisma.surveyPeriod.upsert({
      where: { name: period.name },
      update: {},
      create: period,
    });
  }

  console.log('📅 Created survey periods');

  // Get created data for sample phenomena
  const createdCategories = await prisma.surveyCategory.findMany();
  const createdPeriods = await prisma.surveyPeriod.findMany();

  // Create sample phenomena with regions
  const phenomena = [
    {
      title: 'Peningkatan Tingkat Pengangguran di Daerah Urban Sambas',
      description: 'Terjadi peningkatan tingkat pengangguran terbuka di daerah perkotaan Kabupaten Sambas, terutama pada kelompok usia produktif 20-35 tahun. Hal ini dipengaruhi oleh perlambatan ekonomi dan PHK massal di sektor manufaktur kecil.',
      userId: user.id,
      categoryId: createdCategories.find(c => c.name.includes('SAKERNAS'))?.id || createdCategories[0].id,
      periodId: createdPeriods.find(p => p.name.includes('Triwulan II'))?.id || createdPeriods[0].id,
      regionId: sambasRegion?.id || createdRegions[0].id, // User dapat input di wilayahnya
    },
    {
      title: 'Penurunan Konsumsi Rumah Tangga di Kota Pontianak',
      description: 'Terjadi penurunan rata-rata konsumsi per kapita rumah tangga di Kota Pontianak, khususnya untuk komoditas non-makanan. Penurunan ini terlihat signifikan pada kelompok pengeluaran menengah ke bawah.',
      userId: admin.id,
      categoryId: createdCategories.find(c => c.name.includes('SUSENAS'))?.id || createdCategories[0].id,
      periodId: createdPeriods.find(p => p.name.includes('Triwulan III'))?.id || createdPeriods[1].id,
      regionId: pontianakRegion?.id || createdRegions[0].id, // Admin dapat input di wilayahnya
    },
    {
      title: 'Kenaikan Produktivitas Pertanian Padi di Kabupaten Sanggau',
      description: 'Terjadi peningkatan produktivitas padi per hektar di Kabupaten Sanggau, didukung oleh penggunaan varietas unggul dan perbaikan sistem irigasi.',
      userId: admin.id,
      categoryId: createdCategories.find(c => c.name.includes('Pertanian'))?.id || createdCategories[2].id,
      periodId: createdPeriods.find(p => p.name.includes('Semester I'))?.id || createdPeriods[4].id,
      regionId: createdRegions.find(r => r.regionCode === '6105')?.id || createdRegions[4].id, // Kabupaten Sanggau
    }
  ];

  for (const phenomenon of phenomena) {
    await prisma.phenomenon.create({
      data: phenomenon,
    });
  }

  console.log('🔬 Created sample phenomena');
  console.log('✅ Seeding completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });