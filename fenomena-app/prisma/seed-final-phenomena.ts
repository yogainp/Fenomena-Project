import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating comprehensive phenomena data...');

  // Get or create all necessary data
  let users = await prisma.user.findMany();
  let regions = await prisma.region.findMany();
  let categories = await prisma.surveyCategory.findMany();

  console.log(`Found: ${users.length} users, ${regions.length} regions, ${categories.length} categories`);

  // Create categories if none exist
  if (categories.length === 0) {
    console.log('📊 Creating survey categories...');
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
      await prisma.surveyCategory.create({ data: category });
    }
    categories = await prisma.surveyCategory.findMany();
  }

  // Create regions if none exist
  if (regions.length === 0) {
    console.log('🗺️ Creating regions...');
    const regionData = [
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

    for (const region of regionData) {
      await prisma.region.create({ data: region });
    }
    regions = await prisma.region.findMany();
  }

  // Create users if none exist
  if (users.length === 0) {
    console.log('👤 Creating users...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    const userPassword = await bcrypt.hash('user123', 12);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@fenomena.com',
        username: 'admin',
        password: adminPassword,
        role: 'ADMIN',
        regionId: regions[0]?.id,
      },
    });
    
    const user = await prisma.user.create({
      data: {
        email: 'user@fenomena.com',
        username: 'testuser',
        password: userPassword,
        role: 'USER',
        regionId: regions[2]?.id,
      },
    });
    
    users = [admin, user];
  }

  // Phenomena templates that work with any category names
  const phenomenaData = [
    {
      title: 'Peningkatan Pengeluaran Rumah Tangga untuk Pendidikan',
      description: 'Terjadi peningkatan signifikan pengeluaran rumah tangga menengah untuk biaya pendidikan, mencapai 18% dari total pengeluaran. Hal ini didorong oleh kesadaran orang tua akan pentingnya investasi pendidikan berkualitas untuk anak-anak mereka. Peningkatan ini terlihat pada semua strata ekonomi, dengan kelas menengah atas meningkat 25% dan menengah bawah naik 12%. Program bantuan pendidikan pemerintah juga meningkatkan akses pendidikan berkualitas.'
    },
    {
      title: 'Penurunan Konsumsi Protein Hewani di Rumah Tangga',
      description: 'Data menunjukkan penurunan konsumsi protein hewani sebesar 15% pada rumah tangga. Penurunan ini disebabkan oleh kenaikan harga daging sapi dan ayam yang tidak diimbangi dengan peningkatan pendapatan keluarga. Masyarakat beralih ke protein nabati dan ikan lokal sebagai alternatif. Dampaknya terlihat terutama pada keluarga dengan pendapatan menengah ke bawah.'
    },
    {
      title: 'Kenaikan Akses Internet Rumah Tangga',
      description: 'Penetrasi internet rumah tangga mencapai 78%, naik dari 65% tahun sebelumnya. Peningkatan ini didorong oleh program digitalisasi pemerintah dan kebutuhan work from home pasca pandemi. Mayoritas akses melalui smartphone dengan paket data unlimited yang semakin terjangkau. Dampak positif terlihat pada pendidikan online dan UMKM digital.'
    },
    {
      title: 'Lonjakan Pekerja Sektor Digital',
      description: 'Jumlah pekerja di sektor teknologi informasi dan komunikasi meningkat 85% dalam setahun terakhir. Pertumbuhan ini didorong oleh berkembangnya startup lokal, layanan e-commerce, dan digital marketing. Rata-rata upah sektor ini Rp 4.2 juta, tertinggi setelah sektor keuangan. Program pelatihan digital skill pemerintah turut mendukung pertumbuhan ini.'
    },
    {
      title: 'Tingkat Pengangguran Terbuka Menurun Signifikan',
      description: 'Tingkat Pengangguran Terbuka (TPT) turun menjadi 3.8%, terendah dalam 5 tahun terakhir. Penurunan ini didorong oleh pertumbuhan sektor perkebunan kelapa sawit dan karet yang menyerap banyak tenaga kerja. Program pelatihan kerja pemerintah juga berhasil meningkatkan skill matching antara pencari kerja dan kebutuhan industri.'
    },
    {
      title: 'Revolusi Varietas Padi Unggul',
      description: 'Adopsi varietas padi unggul Inpari 32 dan Inpari 42 mencapai 85% dari total luas tanam. Produktivitas meningkat dari 4.2 ton/ha menjadi 5.8 ton/ha. Program pendampingan teknis dan subsidi benih dari pemerintah berhasil meningkatkan produksi padi 38% dibanding musim tanam sebelumnya. Kualitas gabah juga meningkat dengan kadar air optimal.'
    },
    {
      title: 'Ekspansi Perkebunan Kelapa Sawit',
      description: 'Luas perkebunan kelapa sawit bertambah 12,000 hektar dalam setahun, mencapai total 185,000 hektar. Produktivitas rata-rata 22 ton TBS/ha/tahun dengan melibatkan 15,000 petani plasma. Peningkatan ini didukung oleh program kemitraan BUMN dan replanting kebun tua dengan bibit unggul yang tahan penyakit.'
    },
    {
      title: 'Berkembangnya Industri Pengolahan Hasil Pertanian',
      description: 'Industri hilir kelapa sawit tumbuh dengan 5 pabrik baru beroperasi. Kapasitas olah mencapai 850 ton TBS/hari menghasilkan CPO, kernel, dan produk turunan. Nilai tambah industri naik 45% dengan penyerapan tenaga kerja 2,300 orang. Ekspor produk olahan meningkat ke negara ASEAN dan China.'
    },
    {
      title: 'Industri Makanan Ringan Skala UMKM Berkembang Pesat',
      description: 'Sektor industri makanan ringan mengalami transformasi dengan 450 UMKM beralih ke kemasan modern dan marketing digital. Produk seperti kerupuk ikan, dodol, dan kue tradisional mulai menembus pasar nasional melalui e-commerce. Omzet rata-rata UMKM naik 180% dengan dukungan program One Village One Product.'
    },
    {
      title: 'E-Commerce Mengubah Lanskap Retail',
      description: 'Penetrasi e-commerce mencapai 65% dari total transaksi retail. Toko konvensional beradaptasi dengan model omni-channel, menggabungkan offline dan online. Platform lokal seperti marketplace regional tumbuh 120% dengan GMV Rp 250 miliar. Sektor fashion, elektronik, dan F&B mendominasi transaksi online.'
    },
    {
      title: 'Perdagangan Lintas Batas Meningkat Signifikan',
      description: 'Volume perdagangan lintas batas naik 35% dengan nilai mencapai USD 450 juta. Komoditas utama ekspor adalah CPO, karet, dan produk pertanian, sedangkan impor didominasi elektronik dan tekstil. Pembukaan jalur baru dan digitalisasi dokumen perdagangan mempercepat proses clearance barang.'
    },
    {
      title: 'Pasar Tradisional Berevolusi dengan Sistem Digital',
      description: 'Pasar tradisional mengadopsi sistem pembayaran digital dengan 78% pedagang menerima e-wallet dan QR code. Sistem inventory digital membantu manajemen stok dan harga yang transparan. Volume transaksi harian naik 25% dengan rata-rata Rp 450 juta per hari di 5 pasar utama.'
    }
  ];

  let totalCreated = 0;

  // Create phenomena across all categories and regions
  console.log('\n🔬 Creating diverse phenomena...');
  
  for (let i = 0; i < 150; i++) { // Create 150 diverse phenomena
    const phenomenon = phenomenaData[i % phenomenaData.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    
    // Add regional context to title
    const contextualTitle = `${phenomenon.title} di ${region.city}`;
    
    // Generate random date in 2024
    const randomDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

    try {
      await prisma.phenomenon.create({
        data: {
          title: contextualTitle,
          description: phenomenon.description,
          userId: user.id,
          categoryId: category.id,
          regionId: region.id,
          createdAt: randomDate,
        },
      });
      totalCreated++;
      
      if (totalCreated % 20 === 0) {
        console.log(`   ✓ Created ${totalCreated} phenomena...`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to create phenomenon: ${contextualTitle.substring(0, 50)}...`);
    }
  }

  console.log(`\n🎉 Successfully created ${totalCreated} diverse phenomena!`);
  console.log(`📊 Categories: ${categories.map(c => c.name).join(', ')}`);
  console.log(`🗺️ Regions: ${regions.length} regions covered`);
  console.log('✅ Comprehensive phenomena creation completed!');
  
  // Display summary
  const summary = await prisma.phenomenon.groupBy({
    by: ['categoryId'],
    _count: { _all: true }
  });
  
  console.log('\n📈 Distribution Summary:');
  for (const item of summary) {
    const category = categories.find(c => c.id === item.categoryId);
    console.log(`   ${category?.name}: ${item._count._all} phenomena`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error creating phenomena:', e);
    await prisma.$disconnect();
    process.exit(1);
  });