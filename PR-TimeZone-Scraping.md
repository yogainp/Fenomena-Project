# PR Resume: Fix Timezone Scraping Date Conversion Issue

**Date**: September 3, 2025  
**Reporter**: User  
**Priority**: High  
**Status**: Investigation Complete - Ready for Implementation

---

## Executive Summary

**Problem**: Tanggal publish berita yang berhasil di-scraping mengalami perubahan saat konversi ke format tanggal Indonesia. Contoh kasus: tanggal asli "Selasa, 2 September 2025" berubah menjadi "1 September 2025" setelah konversi.

**Impact**: Ketidakakuratan data tanggal publish berita yang dapat mempengaruhi analisis timeline dan kredibilitas data.

**Root Cause**: Masalah pada fungsi parsing tanggal dan kemungkinan timezone conversion di sistem scraping.

---

## Problem Analysis

### Kasus yang Dilaporkan
- **Input**: "Selasa, 2 September 2025"  
- **Expected Output**: "2 September 2025"
- **Actual Output**: "1 September 2025"
- **Delta**: -1 hari

### Symptoms
1. Tanggal bergeser mundur 1 hari secara konsisten
2. Terjadi pada sistem scraping berita dari portal Indonesia
3. Masalah tampak pada display/formatting, bukan pada proses scraping itu sendiri

---

## Technical Investigation

### Service Architecture Status ✅
**CONFIRMED**: Sistem sudah menggunakan service yang benar
- ✅ **Active Service**: `chromium-scraping-service.ts` (untuk development & production)
- ❌ **Deprecated Service**: `scraping-service-chromium.ts` (tidak digunakan lagi)

### Files Using chromium-scraping-service.ts
1. `src/lib/scheduler-service.ts:5-11` - Import semua fungsi scraping
2. `src/app/api/admin/scrapping-berita/execute/route.ts:5-11` - API endpoint
3. `src/app/api/test-chromium/route.ts:2` - Testing endpoint

### Key Functions Involved

#### 1. parseIndonesianDate() - Line 44
```typescript
function parseIndonesianDate(dateString: string): Date {
  // Enhanced Indonesian date parsing function
  // Location: chromium-scraping-service.ts:44-140
}
```

#### 2. parseRelativeDate() - Line 152
```typescript
function parseRelativeDate(relativeText: string): Date {
  // Handles "X jam lalu", "X menit lalu" and absolute dates
  // Location: chromium-scraping-service.ts:152-205
}
```

#### 3. formatDate() - manage-scraping/page.tsx:275
```typescript
// Format with explicit Indonesia timezone
return new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  // ...
}).format(date);
```

---

## Root Cause Analysis

### Primary Suspects

#### 1. Pattern Matching Ambiguity
**Location**: `chromium-scraping-service.ts:76-85`
```typescript
const patterns = [
  // DD/MM/YYYY or DD-MM-YYYY (most common for Kalbar Online)
  /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,  // ← SUSPECT PATTERN
  // Other patterns...
];
```

**Issue**: Pattern ini mengasumsikan format DD/MM/YYYY tapi bisa salah interpretasi.

#### 2. Date Parsing Logic
**Location**: `chromium-scraping-service.ts:96-101`
```typescript
if (i === 0) {
  // DD/MM/YYYY format - most common for Kalbar Online
  day = parseInt(match[1]);
  month = parseInt(match[2]) - 1; // Convert to 0-based month
  year = parseInt(match[3]);
}
```

**Issue**: Handling month conversion (0-based indexing) mungkin tidak konsisten.

#### 3. Timezone Conversion
**Location**: Multiple locations
- Date creation: `new Date(year, month, day)` (creates in local timezone)
- Display formatting: Uses `Asia/Jakarta` timezone
- Storage: Potentially in UTC

### Hypothesis
1. **Timezone Shift**: Date dibuat dalam satu timezone tapi ditampilkan di timezone lain
2. **Off-by-one Error**: Month handling atau day parsing tidak tepat
3. **Pattern Mismatch**: Wrong pattern digunakan untuk format tanggal tertentu

---

## Proposed Solutions

### 1. Unify Date Parsing Functions ⭐ HIGH PRIORITY
- Konsolidasi `parseIndonesianDate()` menjadi satu implementasi konsisten
- Pindahkan ke utility file terpisah: `src/lib/date-utils.ts`
- Improve pattern matching untuk format tanggal Indonesia

### 2. Fix Timezone Handling ⭐ HIGH PRIORITY
- Standardisasi timezone handling di seluruh aplikasi
- Pastikan konsistensi antara parsing, storage, dan display
- Add explicit timezone setting saat membuat Date objects

### 3. Enhanced Logging & Debugging 🔧 MEDIUM PRIORITY
- Add comprehensive logging untuk trace parsing process
- Create debug mode untuk date conversion
- Log both input dan output dengan timezone info

### 4. Unit Testing 🧪 MEDIUM PRIORITY
- Create unit tests untuk berbagai format tanggal Indonesia
- Test edge cases dan timezone conversion
- Validate dengan sample data yang problematic

### 5. Clean Up Deprecated Code 🧹 LOW PRIORITY
- Remove `scraping-service-chromium.ts` (sudah tidak digunakan)
- Clean up imports dan references yang tidak perlu

---

## Action Items

### Phase 1: Investigation & Debugging
- [ ] Add detailed logging ke `parseIndonesianDate()` function
- [ ] Test dengan sample data "Selasa, 2 September 2025"
- [ ] Trace exact point dimana tanggal berubah

### Phase 2: Core Fixes
- [ ] Create `src/lib/date-utils.ts` dengan unified parsing
- [ ] Fix timezone handling di parsing functions
- [ ] Update semua references untuk menggunakan utility baru

### Phase 3: Testing & Validation
- [ ] Create unit tests untuk date parsing
- [ ] Test dengan berbagai format tanggal dari portal Indonesia
- [ ] Validate fix dengan real scraping data

### Phase 4: Cleanup
- [ ] Remove deprecated `scraping-service-chromium.ts`
- [ ] Update documentation
- [ ] Code review dan final testing

---

## File References

### Primary Files
- `src/lib/chromium-scraping-service.ts` - Main scraping service
- `src/app/admin/manage-scraping/page.tsx` - Date display formatting
- `src/lib/scheduler-service.ts` - Uses scraping functions

### Deprecated Files
- `src/lib/scraping-service-chromium.ts` - Not used, can be removed

### Test Files
- `debug-xpath-simple.js` - Debug script
- `test-xpath-debug.js` - Test script

---

## Notes for Implementation

1. **Testing Environment**: Use development environment untuk initial testing
2. **Data Safety**: Backup existing data sebelum implement changes
3. **Gradual Rollout**: Test dengan satu portal terlebih dahulu
4. **Monitoring**: Monitor date accuracy setelah implementasi

---

## Expected Outcome

Setelah implementasi:
- ✅ Tanggal publish berita tetap akurat sesuai aslinya
- ✅ Konsistensi timezone handling di seluruh aplikasi  
- ✅ Robust date parsing untuk berbagai format Indonesia
- ✅ Comprehensive logging untuk troubleshooting
- ✅ Clean codebase tanpa deprecated functions

---

**Next Steps**: Review plan ini, kemudian proceed ke Phase 1 untuk implementasi.