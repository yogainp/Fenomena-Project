const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-essential';
const OUTPUT_DIR = 'C:\\Dev\\Fenomena Project\\backup-supabase-ready';

function convertCopyToInsert() {
  console.log('🔄 Converting COPY statements to INSERT statements...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all SQL files from input directory
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.sql'));
  console.log(`📁 Found ${files.length} SQL files to convert`);

  let totalConverted = 0;

  for (const filename of files) {
    const inputPath = path.join(INPUT_DIR, filename);
    const outputPath = path.join(OUTPUT_DIR, filename);
    
    console.log(`🔧 Processing: ${filename}`);
    
    const content = fs.readFileSync(inputPath, 'utf8');
    const convertedContent = convertFileContent(content);
    
    fs.writeFileSync(outputPath, convertedContent);
    totalConverted++;
  }

  // Copy the guide file
  const guideFile = path.join(INPUT_DIR, '00-IMPORT-GUIDE.md');
  if (fs.existsSync(guideFile)) {
    const guideContent = fs.readFileSync(guideFile, 'utf8');
    const updatedGuide = guideContent.replace(
      /backup-essential/g, 
      'backup-supabase-ready'
    ).replace(
      '# Database Import Guide - Essential Data Only',
      '# Database Import Guide - Supabase Ready'
    );
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '00-IMPORT-GUIDE.md'), updatedGuide);
  }

  console.log(`\n✅ Conversion completed!`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`📊 Files converted: ${totalConverted}`);
  console.log(`\n🎯 Ready for Supabase import!`);
}

function convertFileContent(content) {
  let converted = content;
  
  // Remove Prisma-specific constraints and references
  converted = converted.replace(/ALTER TABLE.*_prisma_migrations.*\n/gi, '');
  converted = converted.replace(/.*_prisma_migrations.*/gi, '');
  
  // Convert COPY statements to INSERT
  converted = converted.replace(
    /COPY\s+[\w\."]+\.(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin;\n([\s\S]*?)\\\.\n/gi,
    (match, tableName, columns, data) => {
      const cleanColumns = columns.replace(/"/g, '');
      const dataLines = data.trim().split('\n');
      
      let insertStatements = '';
      for (const line of dataLines) {
        if (line.trim() && !line.startsWith('--')) {
          const values = line.split('\t').map(val => {
            if (val === '\\N' || val === 'NULL') return 'NULL';
            if (val === 't') return 'true';
            if (val === 'f') return 'false';
            // Escape single quotes and wrap in quotes
            return `'${val.replace(/'/g, "''")}'`;
          }).join(', ');
          
          insertStatements += `INSERT INTO ${tableName} (${cleanColumns}) VALUES (${values});\n`;
        }
      }
      return insertStatements;
    }
  );
  
  // Clean up multiple empty lines
  converted = converted.replace(/\n\n\n+/g, '\n\n');
  
  // Remove SET statements that might cause issues
  converted = converted.replace(/SET\s+.*;\n/gi, '');
  converted = converted.replace(/SELECT\s+pg_catalog\.set_config.*;\n/gi, '');
  
  // Remove COMMENT statements
  converted = converted.replace(/COMMENT\s+ON.*;\n/gi, '');
  
  // Remove OWNER statements
  converted = converted.replace(/ALTER\s+.*\s+OWNER\s+TO\s+.*;\n/gi, '');
  converted = converted.replace(/ALTER\s+SCHEMA.*;\n/gi, '');
  
  return converted.trim();
}

// Run the conversion
try {
  convertCopyToInsert();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}