const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = 'C:\\Users\\BPSAdmin\\backup.sql';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-parts-small';
const MAX_CHUNK_SIZE = 5000; // Much smaller chunks for SQL editor
const MAX_INSERT_STATEMENTS = 10; // Max INSERT statements per chunk

function splitSQLBackup() {
  console.log('🔄 Starting SQL backup split (small chunks)...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read the entire backup file
  console.log('📖 Reading backup file...');
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  
  // Split by lines first to handle large INSERT statements
  const lines = content.split('\n');
  console.log(`📊 Found ${lines.length} lines`);

  let currentChunk = '';
  let chunkIndex = 1;
  let totalChunks = 0;
  let insertCount = 0;
  let currentType = 'setup';

  // Helper function to save chunk
  function saveChunk(chunkContent, index, description) {
    if (!chunkContent.trim()) return;
    
    const filename = `backup-part-${index.toString().padStart(3, '0')}-${description}.sql`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Clean up chunk content
    let cleanContent = chunkContent.trim();
    if (!cleanContent.endsWith(';')) {
      cleanContent += ';';
    }
    
    fs.writeFileSync(filepath, cleanContent);
    console.log(`✅ Saved: ${filename} (${cleanContent.length} chars)`);
    totalChunks++;
    return totalChunks;
  }

  // Helper function to determine statement type
  function getStatementType(line) {
    const upperLine = line.toUpperCase().trim();
    if (upperLine.includes('CREATE TYPE')) return 'types';
    if (upperLine.includes('CREATE TABLE')) return 'tables';
    if (upperLine.includes('ALTER TABLE') && upperLine.includes('OWNER TO')) return 'ownership';
    if (upperLine.includes('INSERT INTO')) return 'data';
    if (upperLine.includes('COPY ') && upperLine.includes(' FROM')) return 'copy-start';
    if (upperLine.includes('CREATE INDEX') || upperLine.includes('CREATE UNIQUE INDEX')) return 'indexes';
    if (upperLine.includes('ALTER TABLE') && upperLine.includes('ADD CONSTRAINT')) return 'constraints';
    if (upperLine.includes('ALTER TABLE') && upperLine.includes('ADD FOREIGN KEY')) return 'foreign-keys';
    if (upperLine.startsWith('--')) return 'comment';
    if (upperLine.startsWith('SET ') || upperLine.includes('SELECT PG_CATALOG')) return 'config';
    return 'other';
  }

  let inCopyBlock = false;
  let copyBuffer = '';

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = getStatementType(line);
    
    // Handle COPY blocks specially (large data inserts)
    if (lineType === 'copy-start') {
      inCopyBlock = true;
      copyBuffer = line + '\n';
      continue;
    }
    
    if (inCopyBlock) {
      if (line.trim() === '\\.') {
        // End of COPY block
        copyBuffer += line + '\n';
        
        // Split large COPY blocks into smaller INSERT statements
        const copyLines = copyBuffer.split('\n');
        const tableName = copyLines[0].match(/COPY\s+[\w\."]+\.(\w+)/i)?.[1] || 'unknown';
        const columns = copyLines[0].match(/\((.*?)\)/)?.[1] || '';
        
        // Convert COPY to INSERT statements in small batches
        let insertChunk = '';
        let insertBatch = 0;
        
        for (let j = 1; j < copyLines.length - 2; j++) {
          const dataLine = copyLines[j].trim();
          if (!dataLine) continue;
          
          // Convert tab-separated values to INSERT
          const values = dataLine.split('\t').map(val => {
            if (val === '\\N') return 'NULL';
            return `'${val.replace(/'/g, "''")}'`;
          }).join(', ');
          
          insertChunk += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
          
          if (insertChunk.length > MAX_CHUNK_SIZE || j % 5 === 0) {
            saveChunk(insertChunk, chunkIndex++, `${tableName}-data-${insertBatch++}`);
            insertChunk = '';
          }
        }
        
        if (insertChunk.trim()) {
          saveChunk(insertChunk, chunkIndex++, `${tableName}-data-${insertBatch}`);
        }
        
        inCopyBlock = false;
        copyBuffer = '';
        continue;
      } else {
        copyBuffer += line + '\n';
        continue;
      }
    }
    
    // Handle regular SQL statements
    const testChunk = currentChunk + line + '\n';
    
    // Determine if we should start a new chunk
    let shouldSplit = false;
    
    if (lineType === 'data') {
      insertCount++;
      if (insertCount >= MAX_INSERT_STATEMENTS) {
        shouldSplit = true;
        insertCount = 0;
      }
    }
    
    if (testChunk.length > MAX_CHUNK_SIZE || shouldSplit) {
      if (currentChunk.trim()) {
        saveChunk(currentChunk, chunkIndex++, currentType);
      }
      currentChunk = line + '\n';
      currentType = lineType;
    } else {
      currentChunk += line + '\n';
      if (lineType !== 'comment' && lineType !== 'config') {
        currentType = lineType;
      }
    }
  }

  // Save the final chunk
  if (currentChunk.trim()) {
    saveChunk(currentChunk, chunkIndex++, currentType);
  }

  // Create execution guide
  const guideFile = path.join(OUTPUT_DIR, '00-IMPORT-GUIDE.md');
  const guideContent = `# SQL Backup Import Guide

## 📁 Location
\`${OUTPUT_DIR}\`

## 📊 Summary
- **Total parts:** ${totalChunks}
- **Max chunk size:** ${MAX_CHUNK_SIZE} characters
- **Generated:** ${new Date().toLocaleString()}

## 🚀 Import Instructions

### Step 1: Schema First
1. Run files containing \`-types-\` first
2. Run files containing \`-tables-\` next
3. Run files containing \`-ownership-\` (optional)

### Step 2: Data Import
1. Run files containing \`-data-\` 
2. Skip any files with \`_prisma_migrations\` (not needed for Supabase)

### Step 3: Indexes & Constraints
1. Run files containing \`-indexes-\`
2. Run files containing \`-constraints-\`
3. Run files containing \`-foreign-keys-\`

## ⚠️ Important Notes

- **Execute in Supabase SQL Editor** one by one
- **If a file fails:** Try running it again after dependencies are loaded
- **Skip Prisma files:** Any file mentioning \`_prisma_migrations\`
- **Check logs:** Supabase will show detailed error messages

## 🔧 Troubleshooting

- **"Table already exists":** Skip that file, it's already imported
- **"Column doesn't exist":** Run table creation files first
- **"Foreign key constraint":** Run referenced table data first

## 📋 File Types

- \`-types-\`: Custom PostgreSQL types (ENUM, etc.)
- \`-tables-\`: CREATE TABLE statements  
- \`-data-\`: INSERT INTO statements
- \`-indexes-\`: CREATE INDEX statements
- \`-constraints-\`: ALTER TABLE ADD CONSTRAINT
- \`-ownership-\`: ALTER TABLE OWNER (usually optional)
`;
  
  fs.writeFileSync(guideFile, guideContent);
  console.log(`📋 Created import guide: 00-IMPORT-GUIDE.md`);
  
  console.log(`\n🎉 Backup split completed!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📊 Total parts created: ${totalChunks}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open: ${OUTPUT_DIR}`);
  console.log(`   2. Read: 00-IMPORT-GUIDE.md`);
  console.log(`   3. Import parts to Supabase SQL Editor in order`);
}

// Run the split function
try {
  splitSQLBackup();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}