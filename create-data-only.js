const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-supabase-ready';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-data-only';

function createDataOnlyBackup() {
  console.log('🔄 Creating DATA-ONLY backup (safe for existing schema)...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all data files (skip structure files)
  const files = fs.readdirSync(INPUT_DIR).filter(f => {
    return f.endsWith('.sql') && 
           !f.includes('01-setup') && 
           !f.includes('02-types') && 
           !f.includes('03-tables') &&
           !f.includes('12-indexes') &&
           !f.includes('13-constraints');
  });
  
  console.log(`📁 Found ${files.length} data files to process`);

  let totalProcessed = 0;

  for (const filename of files) {
    const inputPath = path.join(INPUT_DIR, filename);
    const outputPath = path.join(OUTPUT_DIR, filename);
    
    console.log(`🔧 Processing: ${filename}`);
    
    const content = fs.readFileSync(inputPath, 'utf8');
    const cleanedContent = cleanDataFile(content);
    
    if (cleanedContent.trim()) {
      fs.writeFileSync(outputPath, cleanedContent);
      totalProcessed++;
    }
  }

  // Create safe import guide
  const guideContent = `# 🛡️ DATA-ONLY Import Guide - SAFE VERSION

## ⚠️ **PENTING - BACA INI!**

File ini **AMAN** untuk database yang sudah punya schema. 
File ini **HANYA berisi data INSERT**, tidak ada CREATE TABLE/TYPE.

## 📁 Location: ${OUTPUT_DIR}

## ✅ **Yang Disertakan:**
- ✅ **INSERT statements** only
- ✅ **Tidak ada CREATE** statements
- ✅ **Tidak ada ALTER** statements  
- ✅ **Aman untuk schema existing**

## 🚀 **Cara Import (AMAN):**

### **Step 1: Essential Data (WAJIB URUT!)**
\`\`\`
1. 04-data-users-01.sql     → Users data
2. 05-data-regions-01.sql   → Regions data  
3. 06-data-categories-01.sql → Categories data
\`\`\`

### **Step 2: Application Data**
\`\`\`
4. 07-data-phenomena-*.sql (5 files)     → Phenomena
5. 08-data-analysis-*.sql (67 files)     → Analysis results
6. 09-data-keywords-01.sql               → Keywords
7. 10-data-berita-*.sql (19 files)       → News articles
8. 11-data-schedules-01.sql              → Schedules
\`\`\`

## ⚠️ **IMPORTANT:**
- **SKIP** jika ada error "duplicate key" (artinya data sudah ada)
- **LANJUTKAN** ke file berikutnya jika ada duplicate
- **Urutan tetap penting** untuk foreign key dependencies

## 🎯 **Hasil:**
Database Anda akan terisi data tanpa mengubah struktur yang sudah ada.

---
**✅ 100% SAFE untuk database dengan schema existing!** 🛡️
`;

  const guideFile = path.join(OUTPUT_DIR, '00-DATA-ONLY-GUIDE.md');
  fs.writeFileSync(guideFile, guideContent);

  console.log(`\n✅ DATA-ONLY backup created!`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`📊 Files processed: ${totalProcessed}`);
  console.log(`\n🛡️ SAFE for existing schema!`);
}

function cleanDataFile(content) {
  let cleaned = content;
  
  // Remove all structure-related statements
  cleaned = cleaned.replace(/CREATE TABLE[^;]+;/gi, '');
  cleaned = cleaned.replace(/CREATE TYPE[^;]+;/gi, '');
  cleaned = cleaned.replace(/ALTER TABLE[^;]+;/gi, '');
  cleaned = cleaned.replace(/CREATE INDEX[^;]+;/gi, '');
  cleaned = cleaned.replace(/CREATE UNIQUE INDEX[^;]+;/gi, '');
  cleaned = cleaned.replace(/ADD CONSTRAINT[^;]+;/gi, '');
  
  // Remove comments and empty lines
  cleaned = cleaned.replace(/--[^\n]*/g, '');
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Keep only INSERT statements
  const lines = cleaned.split('\n');
  const insertLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('INSERT INTO') || trimmed === '';
  });
  
  return insertLines.join('\n').trim();
}

// Run the conversion
try {
  createDataOnlyBackup();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}