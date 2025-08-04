import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dummy phenomena...');

  // Get existing data
  const users = await prisma.user.findMany();
  const categories = await prisma.surveyCategory.findMany();
  const regions = await prisma.region.findMany();

  if (users.length === 0 || categories.length === 0 || regions.length === 0) {
    console.log('❌ No users, categories, or regions found. Please run main seed first.');
    return;
  }

  // Update categories with periods if they don't have them
  console.log('📅 Updating categories with periods...');
  
  const categoryUpdates = [
    {
      name: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      periodeSurvei: 'Triwulan I 2024',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31')
    },
    {
      name: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      periodeSurvei: 'Triwulan II 2024',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30')
    },
    {
      name: 'Survei Pertanian',
      periodeSurvei: 'Semester I 2024',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-30')
    },
    {
      name: 'Survei Industri',
      periodeSurvei: 'Triwulan III 2024',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30')
    },
    {
      name: 'Survei Perdagangan',
      periodeSurvei: 'Triwulan IV 2024',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-12-31')
    }
  ];

  for (const update of categoryUpdates) {
    await prisma.surveyCategory.updateMany({
      where: { name: update.name },
      data: {
        periodeSurvei: update.periodeSurvei,
        startDate: update.startDate,
        endDate: update.endDate
      }
    });
  }

  // Get updated categories
  const updatedCategories = await prisma.surveyCategory.findMany();
  
  // Comprehensive dummy phenomena data
  const phenomena = [
    // SUSENAS - Survei Sosial Ekonomi Nasional
    {
      title: 'Peningkatan Pengeluaran Rumah Tangga untuk Pendidikan di Kota Pontianak',
      description: 'Terjadi peningkatan signifikan pengeluaran rumah tangga menengah untuk biaya pendidikan, mencapai 18% dari total pengeluaran. Hal ini didorong oleh kesadaran orang tua akan pentingnya investasi pendidikan berkualitas untuk anak-anak mereka. Peningkatan ini terlihat pada semua strata ekonomi, dengan kelas menengah atas meningkat 25% dan menengah bawah naik 12%.',
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      regionCode: '6171' // Kota Pontianak
    },
    {
      title: 'Penurunan Konsumsi Protein Hewani di Kabupaten Sambas',
      description: 'Data menunjukkan penurunan konsumsi protein hewani sebesar 15% pada rumah tangga di kabupaten Sambas. Penurunan ini disebabkan oleh kenaikan harga daging sapi dan ayam yang tidak diimbangi dengan peningkatan pendapatan keluarga. Masyarakat beralih ke protein nabati dan ikan lokal sebagai alternatif.',
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      regionCode: '6101' // Kabupaten Sambas
    },
    {
      title: 'Kenaikan Akses Internet Rumah Tangga di Kota Singkawang',
      description: 'Penetrasi internet rumah tangga di Kota Singkawang mencapai 78%, naik dari 65% tahun sebelumnya. Peningkatan ini didorong oleh program digitalisasi pemerintah dan kebutuhan work from home pasca pandemi. Mayoritas akses melalui smartphone dengan paket data unlimited yang semakin terjangkau.',
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      regionCode: '6172' // Kota Singkawang
    },
    {
      title: 'Perubahan Pola Konsumsi Energi Rumah Tangga di Kabupaten Ketapang',
      description: 'Rumah tangga di Kabupaten Ketapang menunjukkan transisi dari LPG ke gas alam dan listrik untuk kebutuhan memasak. Penggunaan listrik untuk memasak naik 45% seiring dengan perbaikan infrastruktur kelistrikan. Program konversi energi pemerintah juga mendorong adopsi kompor induksi pada 30% rumah tangga urban.',
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      regionCode: '6106' // Kabupaten Ketapang
    },
    {
      title: 'Meningkatnya Kepemilikan Kendaraan Bermotor di Kabupaten Kubu Raya',
      description: 'Kepemilikan sepeda motor per rumah tangga di Kabupaten Kubu Raya naik menjadi 1.8 unit, tertinggi di Kalimantan Barat. Peningkatan ini didorong oleh kemudahan kredit motor dan kebutuhan mobilitas akibat perluasan area pemukiman. Mobil pribadi juga naik 12% terutama di kecamatan yang berbatasan dengan Pontianak.',
      categoryName: 'Survei Sosial Ekonomi Nasional (SUSENAS)',
      regionCode: '6112' // Kabupaten Kubu Raya
    },

    // SAKERNAS - Survei Angkatan Kerja Nasional  
    {
      title: 'Penurunan Tingkat Partisipasi Angkatan Kerja Perempuan di Kabupaten Landak',
      description: 'Tingkat Partisipasi Angkatan Kerja (TPAK) perempuan di Kabupaten Landak turun menjadi 52.3%, lebih rendah 5 poin dari rata-rata provinsi. Penurunan ini disebabkan oleh terbatasnya kesempatan kerja formal untuk perempuan dan tanggung jawab domestik yang masih tinggi. Sektor informal masih mendominasi dengan 68% pekerja perempuan.',
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      regionCode: '6103' // Kabupaten Landak
    },
    {
      title: 'Lonjakan Pekerja Sektor Digital di Kota Pontianak',
      description: 'Jumlah pekerja di sektor teknologi informasi dan komunikasi di Kota Pontianak meningkat 85% dalam setahun terakhir. Pertumbuhan ini didorong oleh berkembangnya startup lokal, layanan e-commerce, dan digital marketing. Rata-rata upah sektor ini Rp 4.2 juta, tertinggi setelah sektor keuangan.',
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      regionCode: '6171' // Kota Pontianak
    },
    {
      title: 'Tingkat Pengangguran Terbuka Menurun di Kabupaten Sintang',
      description: 'Tingkat Pengangguran Terbuka (TPT) di Kabupaten Sintang turun menjadi 3.8%, terendah dalam 5 tahun terakhir. Penurunan ini didorong oleh pertumbuhan sektor perkebunan kelapa sawit dan karet yang menyerap banyak tenaga kerja. Program pelatihan kerja pemerintah juga berhasil meningkatkan skill matching antara pencari kerja dan kebutuhan industri.',
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      regionCode: '6107' // Kabupaten Sintang
    },
    {
      title: 'Peningkatan Pekerja Migran ke Malaysia dari Kabupaten Bengkayang',
      description: 'Jumlah pekerja migran dari Kabupaten Bengkayang ke Malaysia naik 22% dibanding tahun lalu. Sektor perkebunan dan konstruksi menjadi tujuan utama dengan upah rata-rata RM 1,200 per bulan. Pemerintah daerah meningkatkan program pelatihan bahasa dan keterampilan untuk memastikan perlindungan dan kesejahteraan pekerja migran.',
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      regionCode: '6102' // Kabupaten Bengkayang
    },
    {
      title: 'Pertumbuhan Sektor Jasa di Kabupaten Sanggau',
      description: 'Sektor jasa di Kabupaten Sanggau tumbuh 15% dengan penyerapan tenaga kerja mencapai 28% dari total angkatan kerja. Subsektor perdagangan, restoran, dan jasa transportasi online mengalami pertumbuhan tertinggi. Kemunculan platform digital dan e-commerce lokal menciptakan peluang kerja baru bagi generasi muda.',
      categoryName: 'Survei Angkatan Kerja Nasional (SAKERNAS)',
      regionCode: '6105' // Kabupaten Sanggau
    },

    // Survei Pertanian
    {
      title: 'Revolusi Varietas Padi Unggul di Kabupaten Sekadau',
      description: 'Adopsi varietas padi unggul Inpari 32 dan Inpari 42 di Kabupaten Sekadau mencapai 85% dari total luas tanam. Produktivitas meningkat dari 4.2 ton/ha menjadi 5.8 ton/ha. Program pendampingan teknis dan subsidi benih dari pemerintah berhasil meningkatkan produksi padi 38% dibanding musim tanam sebelumnya.',
      categoryName: 'Survei Pertanian',
      regionCode: '6109' // Kabupaten Sekadau
    },
    {
      title: 'Ekspansi Perkebunan Kelapa Sawit di Kabupaten Melawi',
      description: 'Luas perkebunan kelapa sawit di Kabupaten Melawi bertambah 12,000 hektar dalam setahun, mencapai total 185,000 hektar. Produktivitas rata-rata 22 ton TBS/ha/tahun dengan melibatkan 15,000 petani plasma. Peningkatan ini didukung oleh program kemitraan BUMN dan replanting kebun tua dengan bibit unggul.',
      categoryName: 'Survei Pertanian',
      regionCode: '6110' // Kabupaten Melawi
    },
    {
      title: 'Diversifikasi Tanaman Hortikultura di Kabupaten Kapuas Hulu',
      description: 'Petani di Kabupaten Kapuas Hulu mulai beralih ke tanaman hortikultura dengan 3,500 hektar lahan baru untuk sayuran dan buah-buahan. Cabai, tomat, dan pepaya menjadi komoditas unggulan dengan nilai jual tinggi. Program green house dan irigasi tetes meningkatkan produktivitas mencapai 3x lipat dibanding sistem konvensional.',
      categoryName: 'Survei Pertanian',
      regionCode: '6108' // Kabupaten Kapuas Hulu
    },
    {
      title: 'Peningkatan Produksi Karet di Kabupaten Ketapang',
      description: 'Produksi karet di Kabupaten Ketapang meningkat 25% setelah program replanting dan pelatihan teknik sadap yang benar. Kualitas lateks meningkat dengan kadar karet kering mencapai 35%. Pembentukan kelompok tani dan koperasi berhasil memperkuat posisi tawar petani dalam rantai pemasaran karet.',
      categoryName: 'Survei Pertanian',
      regionCode: '6106' // Kabupaten Ketapang
    },
    {
      title: 'Budidaya Ikan Air Tawar Berkembang di Kabupaten Sintang',
      description: 'Budidaya ikan air tawar di Kabupaten Sintang mengalami boom dengan 2,800 unit kolam baru. Ikan lele, nila, dan patin menjadi komoditas utama dengan produktivitas 15 kg/m². Program bantuan bibit dan pakan dari dinas perikanan mendorong 1,200 keluarga terlibat dalam usaha budidaya ikan.',
      categoryName: 'Survei Pertanian',
      regionCode: '6107' // Kabupaten Sintang
    },

    // Survei Industri
    {
      title: 'Berkembangnya Industri Pengolahan Kelapa Sawit di Kota Pontianak',
      description: 'Industri hilir kelapa sawit di Kota Pontianak tumbuh dengan 5 pabrik baru beroperasi. Kapasitas olah mencapai 850 ton TBS/hari menghasilkan CPO, kernel, dan produk turunan. Nilai tambah industri naik 45% dengan penyerapan tenaga kerja 2,300 orang. Ekspor produk olahan sawit meningkat ke negara ASEAN dan China.',
      categoryName: 'Survei Industri',
      regionCode: '6171' // Kota Pontianak
    },
    {
      title: 'Industri Makanan Ringan Skala UMKM Berkembang di Kota Singkawang',
      description: 'Sektor industri makanan ringan di Kota Singkawang mengalami transformasi dengan 450 UMKM beralih ke kemasan modern dan marketing digital. Produk seperti kerupuk ikan, dodol, dan kue tradisional mulai menembus pasar nasional melalui e-commerce. Omzet rata-rata UMKM naik 180% dengan dukungan program One Village One Product.',
      categoryName: 'Survei Industri',
      regionCode: '6172' // Kota Singkawang
    },
    {
      title: 'Industri Furniture Rotan Mengalami Kebangkitan di Kabupaten Sintang',
      description: 'Industri furniture rotan di Kabupaten Sintang bangkit dengan 85 pengrajin aktif memproduksi furniture berkualitas ekspor. Nilai produksi mencapai Rp 15 miliar per tahun dengan pasar utama Jakarta, Surabaya, dan ekspor ke Amerika Serikat. Program sertifikasi kualitas dan desain modern meningkatkan daya saing produk lokal.',
      categoryName: 'Survei Industri',
      regionCode: '6107' // Kabupaten Sintang
    },
    {
      title: 'Pertumbuhan Industri Pengolahan Karet di Kabupaten Sanggau',
      description: 'Industri pengolahan karet di Kabupaten Sanggau berkembang dengan 3 pabrik RSS (Ribbed Smoked Sheet) baru berkapasitas 120 ton/bulan. Kualitas produk memenuhi standar internasional dengan grade RSS 1 dan RSS 2. Kemitraan dengan petani karet lokal menjamin pasokan bahan baku stabil sepanjang tahun.',
      categoryName: 'Survei Industri',
      regionCode: '6105' // Kabupaten Sanggau
    },
    {
      title: 'Industri Kerajinan Bambu Menemukan Pasar Baru di Kabupaten Landak',
      description: 'Industri kerajinan bambu di Kabupaten Landak mengalami inovasi dengan 120 pengrajin menghasilkan produk bernilai tinggi seperti furniture, dekorasi, dan alat musik tradisional. Pelatihan desain dan teknologi finishing meningkatkan kualitas produk. Ekspor ke Malaysia dan Singapura mencapai nilai USD 180,000 per tahun.',
      categoryName: 'Survei Industri',
      regionCode: '6103' // Kabupaten Landak
    },

    // Survei Perdagangan
    {
      title: 'Perdagangan Lintas Batas Entikong-Tebedu Meningkat Signifikan',
      description: 'Volume perdagangan melalui pos lintas batas Entikong-Tebedu naik 35% dengan nilai mencapai USD 450 juta. Komoditas utama ekspor adalah CPO, karet, dan produk pertanian, sedangkan impor didominasi elektronik dan tekstil. Pembukaan jalur baru dan digitalisasi dokumen perdagangan mempercepat proses clearance barang.',
      categoryName: 'Survei Perdagangan',
      regionCode: '6105' // Kabupaten Sanggau (Entikong)
    },
    {
      title: 'E-Commerce Mengubah Lanskap Retail di Kota Pontianak',
      description: 'Penetrasi e-commerce di Kota Pontianak mencapai 65% dari total transaksi retail. Toko konvensional beradaptasi dengan model omni-channel, menggabungkan offline dan online. Platform lokal seperti marketplace regional tumbuh 120% dengan GMV Rp 250 miliar. Sektor fashion, elektronik, dan F&B mendominasi transaksi online.',
      categoryName: 'Survei Perdagangan',
      regionCode: '6171' // Kota Pontianak
    },
    {
      title: 'Pasar Tradisional Berevolusi dengan Sistem Digital di Kabupaten Mempawah',
      description: 'Pasar tradisional di Kabupaten Mempawah mengadopsi sistem pembayaran digital dengan 78% pedagang menerima e-wallet dan QR code. Sistem inventory digital membantu manajemen stok dan harga yang transparan. Volume transaksi harian naik 25% dengan rata-rata Rp 450 juta per hari di 5 pasar utama.',
      categoryName: 'Survei Perdagangan',
      regionCode: '6104' // Kabupaten Mempawah
    },
    {
      title: 'Perdagangan Ikan dan Hasil Laut Berkembang di Kabupaten Kayong Utara',
      description: 'Sektor perdagangan ikan dan hasil laut di Kabupaten Kayong Utara tumbuh 40% dengan sistem cold chain yang mempertahankan kesegaran produk. Ekspor udang dan ikan ke Jakarta dan Surabaya mencapai 150 ton per bulan. Koperasi nelayan berperan dalam stabilisasi harga dan quality control produk perikanan.',
      categoryName: 'Survei Perdagangan',
      regionCode: '6111' // Kabupaten Kayong Utara
    },
    {
      title: 'Tumbuhnya Pusat Distribusi Regional di Kabupaten Bengkayang',
      description: 'Kabupaten Bengkayang muncul sebagai pusat distribusi regional dengan 15 gudang besar beroperasi. Lokasi strategis di jalur trans-Kalimantan mendukung distribusi barang ke seluruh Kalbar dan Kalteng. Throughput logistik mencapai 25,000 ton per bulan dengan komoditas utama sembako, pupuk, dan produk industri.',
      categoryName: 'Survei Perdagangan',
      regionCode: '6102' // Kabupaten Bengkayang
    }
  ];

  // Create phenomena data
  let createdCount = 0;
  
  for (const phenomenonData of phenomena) {
    try {
      // Find matching category and region
      const category = updatedCategories.find(c => c.name === phenomenonData.categoryName);
      const region = regions.find(r => r.regionCode === phenomenonData.regionCode);
      const user = users[Math.floor(Math.random() * users.length)]; // Random user

      if (!category || !region) {
        console.log(`⚠️ Skipping: ${phenomenonData.title} - Category or region not found`);
        continue;
      }

      await prisma.phenomenon.create({
        data: {
          title: phenomenonData.title,
          description: phenomenonData.description,
          userId: user.id,
          categoryId: category.id,
          regionId: region.id,
          createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1), // Random date in 2024
        },
      });

      createdCount++;
      console.log(`   ✓ Created: ${phenomenonData.title}`);
    } catch (error) {
      console.log(`   ❌ Failed to create: ${phenomenonData.title}`, error);
    }
  }

  console.log(`\n🔬 Created ${createdCount} dummy phenomena across all categories and regions`);
  console.log('✅ Dummy phenomena seeding completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding dummy phenomena:', e);
    await prisma.$disconnect();
    process.exit(1);
  });