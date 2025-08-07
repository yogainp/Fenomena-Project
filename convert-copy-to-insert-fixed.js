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

  // Copy the guide file with updates
  const guideFile = path.join(INPUT_DIR, '00-IMPORT-GUIDE.md');
  if (fs.existsSync(guideFile)) {
    const guideContent = fs.readFileSync(guideFile, 'utf8');
    const updatedGuide = guideContent
      .replace(/backup-essential/g, 'backup-supabase-ready')
      .replace('# Database Import Guide - Essential Data Only', '# Database Import Guide - Supabase Ready')
      .replace('**Note:** This contains all essential data except survey notes', '**Note:** Converted to INSERT statements for Supabase compatibility');
    
    fs.writeFileSync(path.join(OUTPUT_DIR, '00-IMPORT-GUIDE.md'), updatedGuide);
  }

  console.log(`\n✅ Conversion completed!`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`📊 Files converted: ${totalConverted}`);
  console.log(`\n🎯 Ready for Supabase import!`);
}

function convertFileContent(content) {
  let converted = content;
  
  // Step 1: Remove problematic statements
  converted = converted.replace(/SET\s+[^;]+;/gi, '');
  converted = converted.replace(/SELECT\s+pg_catalog\.set_config[^;]+;/gi, '');
  converted = converted.replace(/COMMENT\s+ON[^;]+;/gi, '');
  converted = converted.replace(/ALTER\s+[^;]*OWNER\s+TO[^;]+;/gi, '');
  converted = converted.replace(/ALTER\s+SCHEMA[^;]+;/gi, '');
  
  // Step 2: Remove Prisma-specific content
  converted = converted.replace(/.*_prisma_migrations.*/gi, '');
  
  // Step 3: Convert COPY statements to INSERT
  // Look for COPY pattern with data
  converted = converted.replace(
    /COPY\s+([\w\."]*\.)?(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin;\s*([\s\S]*?)\\\.\s*/gi,
    (match, schema, tableName, columns, data) => {
      console.log(`    Converting COPY for table: ${tableName}`);
      
      // Clean up column names (remove quotes)
      const cleanColumns = columns.replace(/"/g, '').trim();
      const columnArray = cleanColumns.split(',').map(c => c.trim());
      
      // Process data lines
      const dataLines = data.trim().split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--') && trimmed !== '\\.';
      });
      
      let insertStatements = '';
      for (const line of dataLines) {
        if (line.trim()) {
          const values = line.split('\t').map(val => {
            // Handle special PostgreSQL values
            if (val === '\\N') return 'NULL';
            if (val === 't') return 'true';
            if (val === 'f') return 'false';
            
            // Handle timestamps and other values
            if (val && val.includes('-') && val.includes(':') && val.includes('.')) {
              return `'${val}'`; // Timestamp
            }
            
            // Handle JSON objects
            if (val && (val.startsWith('{') || val.startsWith('['))) {
              return `'${val.replace(/'/g, "''")}'`;
            }
            
            // Handle arrays
            if (val && val.startsWith('{') && val.endsWith('}')) {
              // PostgreSQL array format
              return `'${val}'`;
            }
            
            // Regular string values
            return `'${val.replace(/'/g, "''")}'`;
          });
          
          insertStatements += `INSERT INTO ${tableName} (${cleanColumns}) VALUES (${values.join(', ')});\n`;
        }
      }
      
      return insertStatements + '\n';
    }
  );
  
  // Step 4: Clean up multiple empty lines
  converted = converted.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Step 5: Remove empty comment blocks
  converted = converted.replace(/--\s*\n--\s*\n/g, '');
  
  return converted.trim();
}

// Run the conversion
try {
  convertCopyToInsert();
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}