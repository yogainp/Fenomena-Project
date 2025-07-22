import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMoreData() {
  console.log('🌱 Adding more diverse phenomena data...');

  // Get existing users, categories, and periods
  const users = await prisma.user.findMany();
  const categories = await prisma.surveyCategory.findMany();
  const periods = await prisma.surveyPeriod.findMany();

  const adminUser = users.find(u => u.role === 'ADMIN');
  const regularUser = users.find(u => u.role === 'USER');

  // Diverse phenomena data from different survey types
  const morePhenomena = [
    // SUSENAS related phenomena
    {
      title: 'Penurunan Akses Pendidikan di Daerah Terpencil',
      description: 'Terjadi penurunan partisipasi sekolah anak usia 7-15 tahun di daerah terpencil, terutama di wilayah kepulauan. Faktor utama adalah keterbatasan akses transportasi dan kurangnya fasilitas pendidikan.',
      categoryId: categories.find(c => c.name.includes('SUSENAS'))?.id || categories[0].id,
      periodId: periods.find(p => p.name.includes('Triwulan I'))?.id || periods[0].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Kenaikan Pengeluaran Kesehatan Rumah Tangga',
      description: 'Rata-rata pengeluaran untuk kesehatan per rumah tangga mengalami kenaikan signifikan, terutama untuk biaya pengobatan dan pemeriksaan kesehatan. Fenomena ini terjadi di seluruh kelompok ekonomi.',
      categoryId: categories.find(c => c.name.includes('SUSENAS'))?.id || categories[0].id,
      periodId: periods.find(p => p.name.includes('Triwulan III'))?.id || periods[2].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Perubahan Pola Konsumsi Pangan Masyarakat',
      description: 'Terjadi pergeseran pola konsumsi dari beras ke konsumsi pangan alternatif seperti jagung dan ubi. Perubahan ini lebih terlihat di daerah rural dan berdampak pada ketahanan pangan keluarga.',
      categoryId: categories.find(c => c.name.includes('SUSENAS'))?.id || categories[0].id,
      periodId: periods.find(p => p.name.includes('Semester I'))?.id || periods[4].id,
      userId: regularUser?.id || users[0].id,
    },

    // SAKERNAS related phenomena  
    {
      title: 'Peningkatan Pekerja Informal di Sektor Digital',
      description: 'Terjadi lonjakan signifikan pekerja informal di sektor digital seperti ojek online, kurir, dan e-commerce. Fenomena ini mengubah struktur ketenagakerjaan traditional.',
      categoryId: categories.find(c => c.name.includes('SAKERNAS'))?.id || categories[1].id,
      periodId: periods.find(p => p.name.includes('Triwulan II'))?.id || periods[1].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Gender Gap dalam Partisipasi Kerja',
      description: 'Kesenjangan partisipasi kerja antara laki-laki dan perempuan masih tinggi, terutama di sektor formal. Banyak perempuan terpaksa bekerja di sektor informal dengan upah rendah.',
      categoryId: categories.find(c => c.name.includes('SAKERNAS'))?.id || categories[1].id,
      periodId: periods.find(p => p.name.includes('Triwulan IV'))?.id || periods[3].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Skill Mismatch di Pasar Tenaga Kerja',
      description: 'Terjadi ketidaksesuaian antara keterampilan yang dimiliki pencari kerja dengan kebutuhan industri. Hal ini menyebabkan tingginya angka pengangguran terdidik.',
      categoryId: categories.find(c => c.name.includes('SAKERNAS'))?.id || categories[1].id,
      periodId: periods.find(p => p.name.includes('Triwulan III'))?.id || periods[2].id,
      userId: adminUser?.id || users[0].id,
    },

    // Pertanian related phenomena
    {
      title: 'Adopsi Teknologi Smart Farming oleh Petani',
      description: 'Sebagian petani mulai mengadopsi teknologi smart farming seperti sensor kelembaban tanah dan drone untuk monitoring. Adopsi masih terbatas pada petani dengan modal besar.',
      categoryId: categories.find(c => c.name.includes('Pertanian'))?.id || categories[2].id,
      periodId: periods.find(p => p.name.includes('Triwulan I'))?.id || periods[0].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Penurunan Luas Lahan Pertanian',
      description: 'Konversi lahan pertanian ke non-pertanian terus terjadi, terutama di daerah peri-urban. Hal ini mengancam ketahanan pangan dan pendapatan petani.',
      categoryId: categories.find(c => c.name.includes('Pertanian'))?.id || categories[2].id,
      periodId: periods.find(p => p.name.includes('Triwulan II'))?.id || periods[1].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Fluktuasi Harga Komoditas Pertanian',
      description: 'Harga komoditas pertanian mengalami fluktuasi yang tinggi, terutama pada musim panen dan paceklik. Hal ini mempengaruhi stabilitas pendapatan petani.',
      categoryId: categories.find(c => c.name.includes('Pertanian'))?.id || categories[2].id,
      periodId: periods.find(p => p.name.includes('Triwulan IV'))?.id || periods[3].id,
      userId: regularUser?.id || users[0].id,
    },

    // Industri related phenomena
    {
      title: 'Otomasi Industri dan Pengurangan Tenaga Kerja',
      description: 'Implementasi teknologi otomasi di sektor industri manufaktur menyebabkan pengurangan kebutuhan tenaga kerja manual. Dampaknya terasa pada industri tekstil dan elektronik.',
      categoryId: categories.find(c => c.name.includes('Industri'))?.id || categories[3].id,
      periodId: periods.find(p => p.name.includes('Triwulan II'))?.id || periods[1].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Peningkatan Industri Kreatif Lokal',
      description: 'Industri kreatif seperti kerajinan, fashion, dan kuliner mengalami pertumbuhan signifikan. Didukung oleh platform digital dan tren konsumen yang mendukung produk lokal.',
      categoryId: categories.find(c => c.name.includes('Industri'))?.id || categories[3].id,
      periodId: periods.find(p => p.name.includes('Semester I'))?.id || periods[4].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Relokasi Industri ke Kawasan Industri Baru',
      description: 'Banyak industri berpindah ke kawasan industri baru di luar Jakarta untuk efisiensi biaya. Relokasi ini mempengaruhi penyerapan tenaga kerja di kedua wilayah.',
      categoryId: categories.find(c => c.name.includes('Industri'))?.id || categories[3].id,
      periodId: periods.find(p => p.name.includes('Triwulan III'))?.id || periods[2].id,
      userId: adminUser?.id || users[0].id,
    },

    // Perdagangan related phenomena
    {
      title: 'Boom E-commerce dan Perubahan Perilaku Konsumen',
      description: 'Pertumbuhan e-commerce yang pesat mengubah perilaku berbelanja masyarakat. Toko fisik tradisional mengalami penurunan omzet, sementara marketplace digital tumbuh pesat.',
      categoryId: categories.find(c => c.name.includes('Perdagangan'))?.id || categories[4].id,
      periodId: periods.find(p => p.name.includes('Triwulan I'))?.id || periods[0].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Defisit Neraca Perdagangan Regional',
      description: 'Beberapa wilayah mengalami defisit neraca perdagangan karena tingginya impor barang konsumsi. Hal ini mempengaruhi nilai tukar dan daya beli masyarakat lokal.',
      categoryId: categories.find(c => c.name.includes('Perdagangan'))?.id || categories[4].id,
      periodId: periods.find(p => p.name.includes('Triwulan IV'))?.id || periods[3].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Pertumbuhan Ekspor Produk Digital',
      description: 'Ekspor produk dan layanan digital seperti software, game, dan konten kreatif mengalami pertumbuhan eksponensial. Sektor ini menjadi sumber devisa baru yang potensial.',
      categoryId: categories.find(c => c.name.includes('Perdagangan'))?.id || categories[4].id,
      periodId: periods.find(p => p.name.includes('Semester I'))?.id || periods[4].id,
      userId: regularUser?.id || users[0].id,
    },

    // Cross-sector phenomena
    {
      title: 'Dampak Climate Change terhadap Produktivitas',
      description: 'Perubahan iklim mulai berdampak signifikan pada berbagai sektor, terutama pertanian dan perikanan. Cuaca ekstrem menyebabkan gagal panen dan penurunan hasil tangkapan.',
      categoryId: categories.find(c => c.name.includes('Pertanian'))?.id || categories[2].id,
      periodId: periods.find(p => p.name.includes('Triwulan II'))?.id || periods[1].id,
      userId: adminUser?.id || users[0].id,
    },
    {
      title: 'Digitalisasi UMKM dan Akses Permodalan',
      description: 'UMKM yang melakukan digitalisasi memiliki akses permodalan yang lebih baik melalui fintech. Namun masih banyak UMKM yang belum mampu beradaptasi dengan teknologi digital.',
      categoryId: categories.find(c => c.name.includes('Perdagangan'))?.id || categories[4].id,
      periodId: periods.find(p => p.name.includes('Triwulan III'))?.id || periods[2].id,
      userId: regularUser?.id || users[0].id,
    },
    {
      title: 'Work From Home dan Produktivitas Kerja',
      description: 'Penerapan work from home mengubah dinamika kerja dan produktivitas karyawan. Sebagian sektor mengalami peningkatan produktivitas, namun sektor lain menghadapi tantangan kolaborasi.',
      categoryId: categories.find(c => c.name.includes('SAKERNAS'))?.id || categories[1].id,
      periodId: periods.find(p => p.name.includes('Triwulan I'))?.id || periods[0].id,
      userId: adminUser?.id || users[0].id,
    },
  ];

  // Insert all phenomena
  for (const phenomenon of morePhenomena) {
    await prisma.phenomenon.create({
      data: phenomenon,
    });
  }

  console.log(`🔬 Created ${morePhenomena.length} additional phenomena`);
  console.log('✅ More diverse data seeding completed!');
}

addMoreData()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error adding more data:', e);
    await prisma.$disconnect();
    process.exit(1);
  });