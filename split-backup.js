const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = 'C:\\Users\\BPSAdmin\\backup.sql';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-parts';
const MAX_CHUNK_SIZE = 8000; // characters per chunk (safe for SQL editor)

function splitSQLBackup() {
  console.log('🔄 Starting SQL backup split...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read the entire backup file
  console.log('📖 Reading backup file...');
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  
  // Split by statements (lines ending with ;)
  const statements = content.split(/;\s*\n/);
  console.log(`📊 Found ${statements.length} SQL statements`);

  let currentChunk = '';
  let chunkIndex = 1;
  let totalChunks = 0;

  // Helper function to save chunk
  function saveChunk(chunkContent, index, description) {
    const filename = `backup-part-${index.toString().padStart(3, '0')}-${description}.sql`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, chunkContent.trim() + ';');
    console.log(`✅ Saved: ${filename} (${chunkContent.length} chars)`);
    totalChunks++;
  }

  // Process each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    
    // Skip empty statements
    if (!statement) continue;

    // Determine statement type for better organization
    let statementType = 'data';
    if (statement.includes('CREATE TYPE')) {
      statementType = 'types';
    } else if (statement.includes('CREATE TABLE')) {
      statementType = 'tables';
    } else if (statement.includes('CREATE INDEX') || statement.includes('CREATE UNIQUE INDEX')) {
      statementType = 'indexes';
    } else if (statement.includes('ALTER TABLE') && statement.includes('ADD CONSTRAINT')) {
      statementType = 'constraints';
    } else if (statement.includes('INSERT INTO')) {
      statementType = 'data';
    } else if (statement.includes('COPY') || statement.includes('\\\.')) {
      statementType = 'copy-data';
    }

    // Check if adding this statement would exceed chunk size
    const testChunk = currentChunk + statement + ';\n';
    
    if (testChunk.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk and start new one
      saveChunk(currentChunk, chunkIndex, statementType);
      chunkIndex++;
      currentChunk = statement + ';\n';
    } else {
      // Add to current chunk
      currentChunk += statement + ';\n';
    }
  }

  // Save the final chunk if it has content
  if (currentChunk.trim()) {
    saveChunk(currentChunk, chunkIndex, 'final');
  }

  // Create execution order file
  const orderFile = path.join(OUTPUT_DIR, '00-EXECUTION-ORDER.txt');
  const orderContent = `
EXECUTION ORDER FOR SQL BACKUP PARTS
====================================

IMPORTANT: Execute these files in the order listed below in Supabase SQL Editor.

Files in directory: ${OUTPUT_DIR}

Total parts: ${totalChunks}

RECOMMENDED EXECUTION ORDER:
1. First run the files containing CREATE TYPE and CREATE TABLE statements
2. Then run files with INSERT INTO statements (data)
3. Finally run files with CREATE INDEX and ALTER TABLE statements

NOTE: 
- Some files may fail if dependencies don't exist yet
- If a file fails, try running it again after running dependency files
- Skip any Prisma-specific tables (like _prisma_migrations)

Generated on: ${new Date().toLocaleString()}
`;
  
  fs.writeFileSync(orderFile, orderContent);
  console.log(`📋 Created execution order file: 00-EXECUTION-ORDER.txt`);
  
  console.log(`\n🎉 Backup split completed!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📊 Total parts created: ${totalChunks}`);
  console.log(`\n💡 Tips:`);
  console.log(`   - Execute files in numerical order`);
  console.log(`   - Skip _prisma_migrations table data`);
  console.log(`   - If a file fails, try again after dependencies are loaded`);
}

// Run the split function
try {
  splitSQLBackup();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}