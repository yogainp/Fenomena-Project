import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking existing data and creating comprehensive dummy phenomena...');

  // First, ensure we have users
  let users = await prisma.user.findMany();
  if (users.length === 0) {
    console.log('👤 Creating initial users...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    const userPassword = await bcrypt.hash('user123', 12);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@fenomena.com',
        username: 'admin',
        password: adminPassword,
        role: 'ADMIN',
      },
    });
    
    const user = await prisma.user.create({
      data: {
        email: 'user@fenomena.com',
        username: 'testuser',
        password: userPassword,
        role: 'USER',
      },
    });
    
    users = [admin, user];
  }

  // Ensure we have regions
  let regions = await prisma.region.findMany();
  if (regions.length === 0) {
    console.log('🗺️ Creating Kalimantan Barat regions...');
    const kalimantanBaratRegions = [
      { province: 'Kalimantan Barat', city: 'Kota Pontianak', regionCode: '6171' },
      { province: 'Kalimantan Barat', city: 'Kota Singkawang', regionCode: '6172' },
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

    for (const regionData of kalimantanBaratRegions) {
      const region = await prisma.region.create({ data: regionData });
      regions.push(region);
    }
  }

  // Ensure we have categories with periods
  let categories = await prisma.surveyCategory.findMany();
  if (categories.length === 0) {
    console.log('📊 Creating survey categories with periods...');
    const categoryData = [
      {
        name: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
        description: 'Survei yang mengumpulkan data kondisi sosial ekonomi rumah tangga',
        periodeSurvei: 'Triwulan I 2024',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      },
      {
        name: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
        description: 'Survei untuk mengumpulkan data ketenagakerjaan',
        periodeSurvei: 'Triwulan II 2024',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30')
      },
      {
        name: 'Survei Pertanian',
        description: 'Survei yang berkaitan dengan sektor pertanian dan perkebunan',
        periodeSurvei: 'Semester I 2024',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30')
      },
      {
        name: 'Survei Industri',
        description: 'Survei untuk mengumpulkan data industri manufaktur',
        periodeSurvei: 'Triwulan III 2024',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-09-30')
      },
      {
        name: 'Survei Perdagangan',
        description: 'Survei yang mengumpulkan data perdagangan dalam dan luar negeri',
        periodeSurvei: 'Triwulan IV 2024',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-31')
      }
    ];

    for (const category of categoryData) {
      const createdCategory = await prisma.surveyCategory.create({ data: category });
      categories.push(createdCategory);
    }
  } else {
    // Update existing categories with periods if they don't have them
    console.log('📅 Updating existing categories with periods...');
    for (const category of categories) {
      if (!category.periodeSurvei) {
        let periodData = {};
        if (category.name.includes('SUSENAS')) {
          periodData = { periodeSurvei: 'Triwulan I 2024', startDate: new Date('2024-01-01'), endDate: new Date('2024-03-31') };
        } else if (category.name.includes('SAKERNAS')) {
          periodData = { periodeSurvei: 'Triwulan II 2024', startDate: new Date('2024-04-01'), endDate: new Date('2024-06-30') };
        } else if (category.name.includes('Pertanian')) {
          periodData = { periodeSurvei: 'Semester I 2024', startDate: new Date('2024-01-01'), endDate: new Date('2024-06-30') };
        } else if (category.name.includes('Industri')) {
          periodData = { periodeSurvei: 'Triwulan III 2024', startDate: new Date('2024-07-01'), endDate: new Date('2024-09-30') };
        } else if (category.name.includes('Perdagangan')) {
          periodData = { periodeSurvei: 'Triwulan IV 2024', startDate: new Date('2024-10-01'), endDate: new Date('2024-12-31') };
        }
        
        if (Object.keys(periodData).length > 0) {
          await prisma.surveyCategory.update({
            where: { id: category.id },
            data: periodData
          });
        }
      }
    }
    categories = await prisma.surveyCategory.findMany();
  }

  console.log(`Found ${users.length} users, ${regions.length} regions, ${categories.length} categories`);

  // Generate comprehensive phenomena data
  const phenomenaTemplates = [
    // SUSENAS Templates
    {
      titles: [
        'Peningkatan Pengeluaran Rumah Tangga untuk Pendidikan di {region}',
        'Penurunan Konsumsi Protein Hewani di {region}',
        'Kenaikan Akses Internet Rumah Tangga di {region}',
        'Perubahan Pola Konsumsi Energi di {region}',
        'Meningkatnya Kepemilikan Kendaraan Bermotor di {region}'
      ],
      descriptions: [
        'Terjadi peningkatan signifikan pengeluaran rumah tangga menengah untuk biaya pendidikan, mencapai 18% dari total pengeluaran. Hal ini didorong oleh kesadaran orang tua akan pentingnya investasi pendidikan berkualitas.',
        'Data menunjukkan penurunan konsumsi protein hewani sebesar 15% pada rumah tangga. Penurunan ini disebabkan oleh kenaikan harga daging yang tidak diimbangi dengan peningkatan pendapatan keluarga.',
        'Penetrasi internet rumah tangga mencapai 78%, naik dari 65% tahun sebelumnya. Peningkatan ini didorong oleh program digitalisasi pemerintah dan kebutuhan work from home pasca pandemi.',
        'Rumah tangga menunjukkan transisi dari LPG ke gas alam dan listrik untuk kebutuhan memasak. Penggunaan listrik untuk memasak naik 45% seiring dengan perbaikan infrastruktur kelistrikan.',
        'Kepemilikan sepeda motor per rumah tangga naik menjadi 1.8 unit. Peningkatan ini didorong oleh kemudahan kredit motor dan kebutuhan mobilitas akibat perluasan area pemukiman.'
      ],
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)'
    },
    // SAKERNAS Templates
    {
      titles: [
        'Penurunan Tingkat Partisipasi Angkatan Kerja Perempuan di {region}',
        'Lonjakan Pekerja Sektor Digital di {region}',
        'Tingkat Pengangguran Terbuka Menurun di {region}',
        'Peningkatan Pekerja Migran ke Malaysia dari {region}',
        'Pertumbuhan Sektor Jasa di {region}'
      ],
      descriptions: [
        'Tingkat Partisipasi Angkatan Kerja (TPAK) perempuan turun menjadi 52.3%, lebih rendah 5 poin dari rata-rata provinsi. Penurunan ini disebabkan oleh terbatasnya kesempatan kerja formal untuk perempuan.',
        'Jumlah pekerja di sektor teknologi informasi dan komunikasi meningkat 85% dalam setahun terakhir. Pertumbuhan ini didorong oleh berkembangnya startup lokal, layanan e-commerce, dan digital marketing.',
        'Tingkat Pengangguran Terbuka (TPT) turun menjadi 3.8%, terendah dalam 5 tahun terakhir. Penurunan ini didorong oleh pertumbuhan sektor perkebunan kelapa sawit dan karet yang menyerap banyak tenaga kerja.',
        'Jumlah pekerja migran ke Malaysia naik 22% dibanding tahun lalu. Sektor perkebunan dan konstruksi menjadi tujuan utama dengan upah rata-rata RM 1,200 per bulan.',
        'Sektor jasa tumbuh 15% dengan penyerapan tenaga kerja mencapai 28% dari total angkatan kerja. Subsektor perdagangan, restoran, dan jasa transportasi online mengalami pertumbuhan tertinggi.'
      ],
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)'
    },
    // Survei Pertanian Templates
    {
      titles: [
        'Revolusi Varietas Padi Unggul di {region}',
        'Ekspansi Perkebunan Kelapa Sawit di {region}',
        'Diversifikasi Tanaman Hortikultura di {region}',
        'Peningkatan Produksi Karet di {region}',
        'Budidaya Ikan Air Tawar Berkembang di {region}'
      ],
      descriptions: [
        'Adopsi varietas padi unggul Inpari 32 dan Inpari 42 mencapai 85% dari total luas tanam. Produktivitas meningkat dari 4.2 ton/ha menjadi 5.8 ton/ha dengan program pendampingan teknis dari pemerintah.',
        'Luas perkebunan kelapa sawit bertambah 12,000 hektar dalam setahun, mencapai total 185,000 hektar. Produktivitas rata-rata 22 ton TBS/ha/tahun dengan melibatkan 15,000 petani plasma.',
        'Petani mulai beralih ke tanaman hortikultura dengan 3,500 hektar lahan baru untuk sayuran dan buah-buahan. Cabai, tomat, dan pepaya menjadi komoditas unggulan dengan nilai jual tinggi.',
        'Produksi karet meningkat 25% setelah program replanting dan pelatihan teknik sadap yang benar. Kualitas lateks meningkat dengan kadar karet kering mencapai 35%.',
        'Budidaya ikan air tawar mengalami boom dengan 2,800 unit kolam baru. Ikan lele, nila, dan patin menjadi komoditas utama dengan produktivitas 15 kg/m².'
      ],
      categoryName: 'Survei Pertanian'
    },
    // Survei Industri Templates
    {
      titles: [
        'Berkembangnya Industri Pengolahan Kelapa Sawit di {region}',
        'Industri Makanan Ringan Skala UMKM Berkembang di {region}',
        'Industri Furniture Rotan Mengalami Kebangkitan di {region}',
        'Pertumbuhan Industri Pengolahan Karet di {region}',
        'Industri Kerajinan Bambu Menemukan Pasar Baru di {region}'
      ],
      descriptions: [
        'Industri hilir kelapa sawit tumbuh dengan 5 pabrik baru beroperasi. Kapasitas olah mencapai 850 ton TBS/hari menghasilkan CPO, kernel, dan produk turunan dengan nilai tambah industri naik 45%.',
        'Sektor industri makanan ringan mengalami transformasi dengan 450 UMKM beralih ke kemasan modern dan marketing digital. Omzet rata-rata UMKM naik 180% dengan dukungan program One Village One Product.',
        'Industri furniture rotan bangkit dengan 85 pengrajin aktif memproduksi furniture berkualitas ekspor. Nilai produksi mencapai Rp 15 miliar per tahun dengan pasar utama Jakarta dan ekspor ke Amerika Serikat.',
        'Industri pengolahan karet berkembang dengan 3 pabrik RSS baru berkapasitas 120 ton/bulan. Kualitas produk memenuhi standar internasional dengan grade RSS 1 dan RSS 2.',
        'Industri kerajinan bambu mengalami inovasi dengan 120 pengrajin menghasilkan produk bernilai tinggi. Ekspor ke Malaysia dan Singapura mencapai nilai USD 180,000 per tahun.'
      ],
      categoryName: 'Survei Industri'
    },
    // Survei Perdagangan Templates  
    {
      titles: [
        'Perdagangan Lintas Batas Meningkat Signifikan di {region}',
        'E-Commerce Mengubah Lanskap Retail di {region}',
        'Pasar Tradisional Berevolusi dengan Sistem Digital di {region}',
        'Perdagangan Ikan dan Hasil Laut Berkembang di {region}',
        'Tumbuhnya Pusat Distribusi Regional di {region}'
      ],
      descriptions: [
        'Volume perdagangan lintas batas naik 35% dengan nilai mencapai USD 450 juta. Komoditas utama ekspor adalah CPO, karet, dan produk pertanian, sedangkan impor didominasi elektronik dan tekstil.',
        'Penetrasi e-commerce mencapai 65% dari total transaksi retail. Toko konvensional beradaptasi dengan model omni-channel, menggabungkan offline dan online dengan GMV Rp 250 miliar.',
        'Pasar tradisional mengadopsi sistem pembayaran digital dengan 78% pedagang menerima e-wallet dan QR code. Volume transaksi harian naik 25% dengan rata-rata Rp 450 juta per hari.',
        'Sektor perdagangan ikan dan hasil laut tumbuh 40% dengan sistem cold chain yang mempertahankan kesegaran produk. Ekspor udang dan ikan mencapai 150 ton per bulan.',
        'Muncul sebagai pusat distribusi regional dengan 15 gudang besar beroperasi. Throughput logistik mencapai 25,000 ton per bulan dengan komoditas utama sembako, pupuk, dan produk industri.'
      ],
      categoryName: 'Survei Perdagangan'
    }
  ];

  let totalCreated = 0;

  // Create phenomena for each category across all regions
  for (const category of categories) {
    const template = phenomenaTemplates.find(t => t.categoryName === category.name);
    if (!template) continue;

    console.log(`\n📊 Creating phenomena for: ${category.name}`);

    // Create 3-4 phenomena for each region for this category
    for (const region of regions) {
      const numPhenomena = Math.floor(Math.random() * 2) + 3; // 3-4 phenomena per region per category
      
      for (let i = 0; i < numPhenomena; i++) {
        const titleIndex = Math.floor(Math.random() * template.titles.length);
        const descIndex = Math.floor(Math.random() * template.descriptions.length);
        const userIndex = Math.floor(Math.random() * users.length);
        
        const title = template.titles[titleIndex].replace('{region}', region.city);
        const description = template.descriptions[descIndex];
        const randomDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

        try {
          await prisma.phenomenon.create({
            data: {
              title,
              description,
              userId: users[userIndex].id,
              categoryId: category.id,
              regionId: region.id,
              createdAt: randomDate,
            },
          });
          totalCreated++;
        } catch (error) {
          console.log(`   ❌ Failed to create phenomenon: ${title.substring(0, 50)}...`);
        }
      }
    }
    
    console.log(`   ✓ Created phenomena for ${regions.length} regions`);
  }

  console.log(`\n🎉 Successfully created ${totalCreated} dummy phenomena!`);
  console.log(`📊 Distribution: ~${Math.floor(totalCreated/categories.length)} phenomena per category`);
  console.log(`🗺️ Coverage: All ${regions.length} regions in Kalimantan Barat`);
  console.log('✅ Comprehensive dummy data creation completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error creating comprehensive dummy data:', e);
    await prisma.$disconnect();
    process.exit(1);
  });