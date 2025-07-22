import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fenomena.com' },
    update: {},
    create: {
      email: 'admin@fenomena.com',
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@fenomena.com' },
    update: {},
    create: {
      email: 'user@fenomena.com',
      username: 'testuser',
      password: userPassword,
      role: 'USER',
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

  // Create sample phenomena
  const phenomena = [
    {
      title: 'Peningkatan Tingkat Pengangguran di Daerah Urban',
      description: 'Terjadi peningkatan tingkat pengangguran terbuka di daerah perkotaan, terutama pada kelompok usia produktif 20-35 tahun. Hal ini dipengaruhi oleh perlambatan ekonomi dan PHK massal di sektor manufaktur.',
      userId: user.id,
      categoryId: createdCategories.find(c => c.name.includes('SAKERNAS'))?.id || createdCategories[0].id,
      periodId: createdPeriods.find(p => p.name.includes('Triwulan II'))?.id || createdPeriods[0].id,
    },
    {
      title: 'Penurunan Konsumsi Rumah Tangga',
      description: 'Terjadi penurunan rata-rata konsumsi per kapita rumah tangga, khususnya untuk komoditas non-makanan. Penurunan ini terlihat signifikan pada kelompok pengeluaran menengah ke bawah.',
      userId: user.id,
      categoryId: createdCategories.find(c => c.name.includes('SUSENAS'))?.id || createdCategories[0].id,
      periodId: createdPeriods.find(p => p.name.includes('Triwulan III'))?.id || createdPeriods[1].id,
    },
    {
      title: 'Kenaikan Produktivitas Pertanian Padi',
      description: 'Terjadi peningkatan produktivitas padi per hektar di beberapa provinsi, didukung oleh penggunaan varietas unggul dan perbaikan sistem irigasi.',
      userId: admin.id,
      categoryId: createdCategories.find(c => c.name.includes('Pertanian'))?.id || createdCategories[2].id,
      periodId: createdPeriods.find(p => p.name.includes('Semester I'))?.id || createdPeriods[4].id,
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