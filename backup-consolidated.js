const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = 'C:\\Users\\BPSAdmin\\backup.sql';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-consolidated';
const MAX_CHUNK_SIZE = 15000; // Larger chunks for efficiency

function consolidateBackup() {
  console.log('🔄 Creating consolidated backup parts...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read the entire backup file
  console.log('📖 Reading backup file...');
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  
  // Split content into logical sections
  const sections = {
    setup: [],
    types: [],
    tables: [],
    ownership: [],
    dataUsers: [],
    dataRegions: [],
    dataSurveyCategories: [],
    dataPhenomena: [],
    dataCatatanSurvei: [],
    dataAnalysisResults: [],
    dataScrappingKeywords: [],
    dataScrappingBerita: [],
    dataScrappingSchedules: [],
    dataOther: [],
    indexes: [],
    constraints: []
  };

  // Process content line by line
  const lines = content.split('\n');
  let currentSection = 'setup';
  let currentChunk = '';

  for (const line of lines) {
    const upperLine = line.toUpperCase().trim();
    
    // Determine section based on line content
    if (upperLine.includes('CREATE TYPE')) currentSection = 'types';
    else if (upperLine.includes('CREATE TABLE')) currentSection = 'tables';
    else if (upperLine.includes('ALTER TABLE') && upperLine.includes('OWNER TO')) currentSection = 'ownership';
    else if (upperLine.includes('INSERT INTO "USERS"') || upperLine.includes('INSERT INTO USERS')) currentSection = 'dataUsers';
    else if (upperLine.includes('INSERT INTO "REGIONS"') || upperLine.includes('INSERT INTO REGIONS')) currentSection = 'dataRegions';
    else if (upperLine.includes('INSERT INTO "SURVEY_CATEGORIES"') || upperLine.includes('INSERT INTO SURVEY_CATEGORIES')) currentSection = 'dataSurveyCategories';
    else if (upperLine.includes('INSERT INTO "PHENOMENA"') || upperLine.includes('INSERT INTO PHENOMENA')) currentSection = 'dataPhenomena';
    else if (upperLine.includes('INSERT INTO "CATATAN_SURVEI"') || upperLine.includes('INSERT INTO CATATAN_SURVEI')) currentSection = 'dataCatatanSurvei';
    else if (upperLine.includes('INSERT INTO "ANALYSIS_RESULTS"') || upperLine.includes('INSERT INTO ANALYSIS_RESULTS')) currentSection = 'dataAnalysisResults';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_KEYWORDS"') || upperLine.includes('INSERT INTO SCRAPPING_KEYWORDS')) currentSection = 'dataScrappingKeywords';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_BERITA"') || upperLine.includes('INSERT INTO SCRAPPING_BERITA')) currentSection = 'dataScrappingBerita';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_SCHEDULES"') || upperLine.includes('INSERT INTO SCRAPPING_SCHEDULES')) currentSection = 'dataScrappingSchedules';
    else if (upperLine.includes('INSERT INTO "_PRISMA_MIGRATIONS"')) {
      // Skip Prisma migrations entirely
      continue;
    }
    else if (upperLine.includes('INSERT INTO')) currentSection = 'dataOther';
    else if (upperLine.includes('CREATE INDEX') || upperLine.includes('CREATE UNIQUE INDEX')) currentSection = 'indexes';
    else if (upperLine.includes('ALTER TABLE') && (upperLine.includes('ADD CONSTRAINT') || upperLine.includes('ADD FOREIGN KEY'))) currentSection = 'constraints';

    // Add line to current section
    sections[currentSection].push(line);
  }

  // Helper function to save section as chunks
  function saveSectionAsChunks(sectionName, lines, description) {
    if (lines.length === 0) return 0;
    
    let chunkIndex = 1;
    let currentChunk = '';
    let totalSaved = 0;
    
    for (const line of lines) {
      const testChunk = currentChunk + line + '\n';
      
      if (testChunk.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
        // Save current chunk
        const filename = `${sectionName}-${chunkIndex.toString().padStart(2, '0')}.sql`;
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, currentChunk.trim());
        console.log(`✅ Saved: ${filename} (${currentChunk.length} chars) - ${description}`);
        
        chunkIndex++;
        totalSaved++;
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    // Save final chunk
    if (currentChunk.trim()) {
      const filename = `${sectionName}-${chunkIndex.toString().padStart(2, '0')}.sql`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, currentChunk.trim());
      console.log(`✅ Saved: ${filename} (${currentChunk.length} chars) - ${description}`);
      totalSaved++;
    }
    
    return totalSaved;
  }

  // Save all sections
  let totalFiles = 0;
  
  totalFiles += saveSectionAsChunks('01-setup', sections.setup, 'Database setup and configuration');
  totalFiles += saveSectionAsChunks('02-types', sections.types, 'Custom PostgreSQL types');
  totalFiles += saveSectionAsChunks('03-tables', sections.tables, 'Table creation');
  totalFiles += saveSectionAsChunks('04-ownership', sections.ownership, 'Table ownership (optional)');
  
  // Data sections
  totalFiles += saveSectionAsChunks('05-data-users', sections.dataUsers, 'Users data');
  totalFiles += saveSectionAsChunks('06-data-regions', sections.dataRegions, 'Regions data');
  totalFiles += saveSectionAsChunks('07-data-categories', sections.dataSurveyCategories, 'Survey categories data');
  totalFiles += saveSectionAsChunks('08-data-phenomena', sections.dataPhenomena, 'Phenomena data');
  totalFiles += saveSectionAsChunks('09-data-catatan', sections.dataCatatanSurvei, 'Catatan survei data');
  totalFiles += saveSectionAsChunks('10-data-analysis', sections.dataAnalysisResults, 'Analysis results data');
  totalFiles += saveSectionAsChunks('11-data-keywords', sections.dataScrappingKeywords, 'Scrapping keywords data');
  totalFiles += saveSectionAsChunks('12-data-berita', sections.dataScrappingBerita, 'Scrapping berita data');
  totalFiles += saveSectionAsChunks('13-data-schedules', sections.dataScrappingSchedules, 'Scrapping schedules data');
  totalFiles += saveSectionAsChunks('14-data-other', sections.dataOther, 'Other data');
  
  // Structure sections
  totalFiles += saveSectionAsChunks('15-indexes', sections.indexes, 'Database indexes');
  totalFiles += saveSectionAsChunks('16-constraints', sections.constraints, 'Foreign key constraints');

  // Create execution guide
  const guideContent = `# Database Import Guide - Consolidated Version

## 📁 Location: ${OUTPUT_DIR}

## 📊 Summary
- **Total files:** ${totalFiles}
- **Max file size:** ~${MAX_CHUNK_SIZE} characters
- **Generated:** ${new Date().toLocaleString()}
- **Note:** Prisma migrations skipped (not needed for Supabase)

## 🚀 Import Order (Execute in Supabase SQL Editor)

### Phase 1: Setup & Structure
1. **01-setup-**.sql - Database configuration
2. **02-types-**.sql - Custom types (ENUM, etc.)
3. **03-tables-**.sql - CREATE TABLE statements
4. **04-ownership-**.sql - Table ownership (optional, can skip)

### Phase 2: Essential Data (Execute in order)
5. **05-data-users-**.sql - Users (required for foreign keys)
6. **06-data-regions-**.sql - Regions (required for foreign keys)  
7. **07-data-categories-**.sql - Survey categories (required)

### Phase 3: Application Data
8. **08-data-phenomena-**.sql - Phenomena records
9. **09-data-catatan-**.sql - Survey notes
10. **11-data-keywords-**.sql - Scrapping keywords
11. **12-data-berita-**.sql - News articles (largest section)
12. **13-data-schedules-**.sql - Scrapping schedules
13. **10-data-analysis-**.sql - Analysis results (run after phenomena/catatan)
14. **14-data-other-**.sql - Other data

### Phase 4: Performance & Integrity
15. **15-indexes-**.sql - Database indexes (improves performance)
16. **16-constraints-**.sql - Foreign key constraints

## ⚠️ Important Notes

- **Execute files in numerical order within each phase**
- **Phase 2 data is critical** - users/regions must be imported first
- **Skip errors on "already exists"** - it means data is already there
- **Large sections (berita)** may have multiple parts (12-data-berita-01.sql, 12-data-berita-02.sql, etc.)
- **Take breaks** - Supabase has rate limits

## 🔧 Tips
- Copy & paste file contents into Supabase SQL Editor
- If a statement fails, try running just that line
- Check Supabase logs for detailed error messages
- Contact support if stuck on specific errors

Generated automatically from: ${INPUT_FILE}
`;

  const guideFile = path.join(OUTPUT_DIR, '00-IMPORT-GUIDE.md');
  fs.writeFileSync(guideFile, guideContent);
  console.log(`📋 Created import guide: 00-IMPORT-GUIDE.md`);

  console.log(`\n🎉 Consolidated backup created!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📊 Total files: ${totalFiles} (much more manageable!)`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open: ${OUTPUT_DIR}`);
  console.log(`   2. Read: 00-IMPORT-GUIDE.md`);
  console.log(`   3. Follow the import phases in order`);
}

// Run the consolidation
try {
  consolidateBackup();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}