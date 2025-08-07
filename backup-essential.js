const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = 'C:\\Users\\BPSAdmin\\backup.sql';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-essential';
const MAX_CHUNK_SIZE = 20000; // Larger chunks since we're skipping catatan_survei

function createEssentialBackup() {
  console.log('🔄 Creating essential backup (skipping catatan_survei data)...');
  
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
    dataUsers: [],
    dataRegions: [],
    dataSurveyCategories: [],
    dataPhenomena: [],
    dataAnalysisResults: [],
    dataScrappingKeywords: [],
    dataScrappingBerita: [],
    dataScrappingSchedules: [],
    indexes: [],
    constraints: []
  };

  // Process content line by line
  const lines = content.split('\n');
  let currentSection = 'setup';
  let skipCatatanSurvei = false;

  for (const line of lines) {
    const upperLine = line.toUpperCase().trim();
    
    // Skip catatan_survei data entirely
    if (upperLine.includes('INSERT INTO "CATATAN_SURVEI"') || 
        upperLine.includes('INSERT INTO CATATAN_SURVEI') ||
        upperLine.includes('COPY PUBLIC.CATATAN_SURVEI')) {
      skipCatatanSurvei = true;
      console.log('⏭️  Skipping catatan_survei data...');
      continue;
    }
    
    // End of catatan_survei section
    if (skipCatatanSurvei && (upperLine.includes('INSERT INTO') || upperLine.includes('COPY')) && 
        !upperLine.includes('CATATAN_SURVEI')) {
      skipCatatanSurvei = false;
    }
    
    if (skipCatatanSurvei) continue;
    
    // Determine section based on line content
    if (upperLine.includes('CREATE TYPE')) currentSection = 'types';
    else if (upperLine.includes('CREATE TABLE')) currentSection = 'tables';
    else if (upperLine.includes('INSERT INTO "USERS"') || upperLine.includes('INSERT INTO USERS') || upperLine.includes('COPY PUBLIC.USERS')) currentSection = 'dataUsers';
    else if (upperLine.includes('INSERT INTO "REGIONS"') || upperLine.includes('INSERT INTO REGIONS') || upperLine.includes('COPY PUBLIC.REGIONS')) currentSection = 'dataRegions';
    else if (upperLine.includes('INSERT INTO "SURVEY_CATEGORIES"') || upperLine.includes('INSERT INTO SURVEY_CATEGORIES') || upperLine.includes('COPY PUBLIC.SURVEY_CATEGORIES')) currentSection = 'dataSurveyCategories';
    else if (upperLine.includes('INSERT INTO "PHENOMENA"') || upperLine.includes('INSERT INTO PHENOMENA') || upperLine.includes('COPY PUBLIC.PHENOMENA')) currentSection = 'dataPhenomena';
    else if (upperLine.includes('INSERT INTO "ANALYSIS_RESULTS"') || upperLine.includes('INSERT INTO ANALYSIS_RESULTS') || upperLine.includes('COPY PUBLIC.ANALYSIS_RESULTS')) currentSection = 'dataAnalysisResults';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_KEYWORDS"') || upperLine.includes('INSERT INTO SCRAPPING_KEYWORDS') || upperLine.includes('COPY PUBLIC.SCRAPPING_KEYWORDS')) currentSection = 'dataScrappingKeywords';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_BERITA"') || upperLine.includes('INSERT INTO SCRAPPING_BERITA') || upperLine.includes('COPY PUBLIC.SCRAPPING_BERITA')) currentSection = 'dataScrappingBerita';
    else if (upperLine.includes('INSERT INTO "SCRAPPING_SCHEDULES"') || upperLine.includes('INSERT INTO SCRAPPING_SCHEDULES') || upperLine.includes('COPY PUBLIC.SCRAPPING_SCHEDULES')) currentSection = 'dataScrappingSchedules';
    else if (upperLine.includes('INSERT INTO "_PRISMA_MIGRATIONS"') || upperLine.includes('COPY PUBLIC._PRISMA_MIGRATIONS')) {
      // Skip Prisma migrations entirely
      continue;
    }
    else if (upperLine.includes('CREATE INDEX') || upperLine.includes('CREATE UNIQUE INDEX')) currentSection = 'indexes';
    else if (upperLine.includes('ALTER TABLE') && (upperLine.includes('ADD CONSTRAINT') || upperLine.includes('ADD FOREIGN KEY'))) currentSection = 'constraints';
    else if (upperLine.includes('ALTER TABLE') && upperLine.includes('OWNER TO')) {
      // Skip ownership statements
      continue;
    }

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
  
  // Essential data sections only
  totalFiles += saveSectionAsChunks('04-data-users', sections.dataUsers, 'Users data');
  totalFiles += saveSectionAsChunks('05-data-regions', sections.dataRegions, 'Regions data');
  totalFiles += saveSectionAsChunks('06-data-categories', sections.dataSurveyCategories, 'Survey categories data');
  totalFiles += saveSectionAsChunks('07-data-phenomena', sections.dataPhenomena, 'Phenomena data');
  totalFiles += saveSectionAsChunks('08-data-analysis', sections.dataAnalysisResults, 'Analysis results data');
  totalFiles += saveSectionAsChunks('09-data-keywords', sections.dataScrappingKeywords, 'Scrapping keywords data');
  totalFiles += saveSectionAsChunks('10-data-berita', sections.dataScrappingBerita, 'Scrapping berita data');
  totalFiles += saveSectionAsChunks('11-data-schedules', sections.dataScrappingSchedules, 'Scrapping schedules data');
  
  // Structure sections
  totalFiles += saveSectionAsChunks('12-indexes', sections.indexes, 'Database indexes');
  totalFiles += saveSectionAsChunks('13-constraints', sections.constraints, 'Foreign key constraints');

  // Create execution guide
  const guideContent = `# Database Import Guide - Essential Data Only

## 📁 Location: ${OUTPUT_DIR}

## 📊 Summary
- **Total files:** ${totalFiles}
- **Max file size:** ~${MAX_CHUNK_SIZE} characters
- **Generated:** ${new Date().toLocaleString()}
- **Skipped:** catatan_survei data, prisma migrations, table ownership
- **Note:** This contains all essential data except survey notes

## 🚀 Import Order (Execute in Supabase SQL Editor)

### Phase 1: Database Structure
1. **01-setup-**.sql - Database configuration
2. **02-types-**.sql - Custom types (ENUM, etc.)
3. **03-tables-**.sql - CREATE TABLE statements

### Phase 2: Essential Data (Execute in exact order!)
4. **04-data-users-**.sql - Users (required first)
5. **05-data-regions-**.sql - Regions (required second)
6. **06-data-categories-**.sql - Survey categories (required third)

### Phase 3: Application Data
7. **07-data-phenomena-**.sql - Phenomena records
8. **08-data-analysis-**.sql - Analysis results
9. **09-data-keywords-**.sql - Scrapping keywords
10. **10-data-berita-**.sql - News articles
11. **11-data-schedules-**.sql - Scrapping schedules

### Phase 4: Performance
12. **12-indexes-**.sql - Database indexes
13. **13-constraints-**.sql - Foreign key constraints

## 🗂️ What's NOT Included
- **catatan_survei data** - Survey notes (you can add this later if needed)
- **_prisma_migrations** - Not needed for Supabase
- **Table ownership statements** - Supabase handles this

## ⚠️ Important Notes
- **Execute in exact numerical order**
- **Phase 2 is critical** - users/regions/categories must be first
- **Don't skip files** - each file may contain dependencies
- **If error occurs** - read the error message and fix the specific line

## 🎯 After Import
Your Supabase database will have:
- ✅ All users, regions, categories
- ✅ All phenomena and analysis data  
- ✅ All scrapping keywords and news articles
- ✅ All indexes and constraints
- ❌ Survey notes (catatan_survei) - can be added separately if needed

Generated from: ${INPUT_FILE}
`;

  const guideFile = path.join(OUTPUT_DIR, '00-IMPORT-GUIDE.md');
  fs.writeFileSync(guideFile, guideContent);
  console.log(`📋 Created import guide: 00-IMPORT-GUIDE.md`);

  console.log(`\n🎉 Essential backup created!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📊 Total files: ${totalFiles} (much smaller!)`);
  console.log(`\n💡 Benefits:`);
  console.log(`   ✅ Skipped catatan_survei data (saved hundreds of files)`);
  console.log(`   ✅ Skipped ownership statements (not needed)`);
  console.log(`   ✅ All essential app data included`);
  console.log(`   ✅ Much faster to import`);
}

// Run the consolidation
try {
  createEssentialBackup();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}