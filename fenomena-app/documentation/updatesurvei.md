# Update Struktur Database Survey - Migrasi dari survey_periods ke survey_categories

**Tanggal**: 04 Agustus 2025  
**Versi**: 2.1  
**Jenis Update**: Database Migration & UI Enhancement

## 📋 Overview

Melakukan migrasi struktur database untuk memindahkan informasi periode survei dari tabel terpisah `survey_periods` ke dalam tabel `survey_categories`. Perubahan ini bertujuan untuk menyederhanakan struktur database dan meningkatkan user experience dengan filter berbasis tanggal.

## 🗃️ Perubahan Database

### Schema Changes

**1. Tabel `survey_categories` - Penambahan Field:**
```sql
ALTER TABLE "survey_categories" ADD COLUMN "periodeSurvei" TEXT;
ALTER TABLE "survey_categories" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "survey_categories" ADD COLUMN "endDate" TIMESTAMP(3);
```

**2. Model `Phenomenon` - Penghapusan Relasi:**
- ❌ Hapus field `periodId` dan relasi ke `SurveyPeriod`
- ✅ Tetap menggunakan relasi ke `SurveyCategory` yang sudah mengandung info periode

**3. Model `CatatanSurvei` - Penyederhanaan:**
- ❌ Hapus field `periodId` dan relasi ke `SurveyPeriod`
- ✅ Update unique constraint dari `[categoryId, periodId, nomorResponden]` menjadi `[categoryId, nomorResponden]`
- ✅ Update format `respondenId` dari `"${categoryId}-${periodId}-${nomorResponden}"` menjadi `"${categoryId}-${nomorResponden}"`

**4. Tabel `survey_periods` - Penghapusan Lengkap:**
- ❌ Drop table `survey_periods` beserta semua data dan relasinya

## 🔄 Data Migration

### Migration Script Execution:
1. **Backup data** periode dari `survey_periods`
2. **Copy data** ke field baru di `survey_categories`
3. **Update references** di tabel `phenomena` dan `catatan_survei`
4. **Drop foreign keys** dan **hapus tabel** `survey_periods`

### Data Mapping:
```javascript
// Contoh mapping data
SurveyPeriod.name -> SurveyCategory.periodeSurvei
SurveyPeriod.startDate -> SurveyCategory.startDate  
SurveyPeriod.endDate -> SurveyCategory.endDate
```

## 🌐 Perubahan Frontend

### Halaman dengan Filter Date Range (6 halaman):

**1. `/catalog` - Katalog Fenomena**
- ❌ Dropdown "Periode Survei"
- ✅ Input "Tanggal Mulai" + "Tanggal Selesai"

**2. `/phenomena` - Kelola Fenomena**  
- ❌ Dropdown "Periode Survei"
- ✅ Input "Tanggal Mulai" + "Tanggal Selesai"

**3. `/analytics` - Analisis & Visualisasi**
- ❌ Dropdown "Filter Periode"
- ✅ Input "Tanggal Mulai" + "Tanggal Selesai"

**4. `/download-fenomena` - Download Data**
- ❌ Dropdown "Periode Survei"
- ✅ Input "Tanggal Mulai" + "Tanggal Selesai"

**5. `/analisis-catatan-survei` - Analisis Catatan**
- ❌ Dropdown "Periode Survei"  
- ✅ Input "Tanggal Mulai" + "Tanggal Selesai"

**6. `/phenomena/add` - Tambah Fenomena**
- ❌ Field "Periode Survei" dari form
- ✅ Otomatis menggunakan periode dari kategori yang dipilih

### Halaman dengan Filter Kategori Saja (1 halaman):

**7. `/catatan-survei` - Upload Catatan Survei**
- ❌ Dropdown "Periode Survei" dihapus sepenuhnya
- ✅ Hanya filter "Kategori Survei"

## 🔧 Perubahan API

### API Endpoints Updated:

**1. `/api/periods`**
- ❌ Query dari tabel `survey_periods`
- ✅ Query dari `survey_categories` dengan filter `WHERE periodeSurvei IS NOT NULL`

**2. `/api/phenomena`**
- ✅ Support parameter `startDate` dan `endDate`
- ✅ Filter berdasarkan `category.startDate` dan `category.endDate`
- ❌ Hapus include relasi `period`
- ✅ Update include `category` dengan field `periodeSurvei`, `startDate`, `endDate`

**3. Schema Validation**
- ❌ Remove `periodId` requirement dari `phenomenonSchema`
- ✅ Validasi langsung ke `categoryId` saja

## 📱 UI/UX Improvements

### Grid Layout Updates:
- **Sebelum**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (3 filter)
- **Sesudah**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` atau `lg:grid-cols-5` (4-5 filter)

### Filter Experience:
- **Sebelum**: Dropdown dengan daftar periode preset
- **Sesudah**: Date picker untuk rentang tanggal fleksibel

### Form Simplification:
- **Add Phenomena**: Berkurang dari 5 field menjadi 4 field
- **Catatan Survei**: Berkurang dari 2 dropdown menjadi 1 dropdown

## 🗄️ Database Files

### Migration Files:
- `20250804023702_add_period_fields_to_survey_categories/migration.sql`
- `20250804030000_remove_survey_period_relations/migration.sql`

### Scripts:
- `migrate-periods-to-categories.js` (temporary, deleted after use)
- `migrate-remove-period-relations.js` (temporary, deleted after use)

## ✅ Testing & Validation

### Account Verification:
- ✅ Admin account `admin@fenomena.com` telah diverifikasi
- ✅ Kredensial: email=admin@fenomena.com, password=admin123

### Data Integrity:
- ✅ Semua data periode berhasil dimigrasikan
- ✅ Relasi data tetap konsisten
- ✅ Unique constraints berfungsi dengan baik

## 🎯 Benefits

### Database:
- **Simplifikasi**: Mengurangi 1 tabel dan kompleksitas JOIN
- **Performance**: Query lebih cepat tanpa JOIN tambahan
- **Maintenance**: Struktur data lebih mudah dipahami

### User Experience:  
- **Fleksibilitas**: Filter tanggal lebih intuitif dan fleksibel
- **Konsistensi**: UI yang lebih konsisten di semua halaman
- **Efisiensi**: Form yang lebih sederhana dan mudah digunakan

## 🔍 Compatibility

### Backward Compatibility:
- ✅ API masih support parameter `periodId` untuk kompatibilitas mundur
- ✅ Data existing tetap dapat diakses
- ✅ Export/import data masih berfungsi normal

## 📊 Impact Summary

| Komponen | Sebelum | Sesudah | Status |
|----------|---------|---------|---------|
| Database Tables | 8 tables | 7 tables | ✅ Simplified |
| Model Relations | Complex JOIN | Direct access | ✅ Optimized |
| Frontend Filters | Dropdown preset | Date range picker | ✅ Enhanced |
| Form Fields | 5 required fields | 4 required fields | ✅ Simplified |
| API Endpoints | 2 tables query | 1 table query | ✅ Streamlined |

---

**Commit Messages:**
1. `a4a87dd` - Migrasi struktur database survey_periods ke survey_categories
2. `72786d3` - Selesaikan migrasi struktur database: hapus tabel survey_periods

**Total Files Modified**: 14 files
**Lines Added**: 978 lines  
**Lines Removed**: 1009 lines