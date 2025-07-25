import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryId = formData.get('categoryId') as string;
    const periodId = formData.get('periodId') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: 'File CSV harus dipilih' },
        { status: 400 }
      );
    }
    
    if (!categoryId || !periodId) {
      return NextResponse.json(
        { error: 'Kategori dan periode harus dipilih' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'File harus berformat CSV' },
        { status: 400 }
      );
    }
    
    // Validate file size (50MB max for large surveys)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 50MB' },
        { status: 400 }
      );
    }
    
    // Read and parse CSV content
    const content = await file.text();
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'File CSV harus memiliki header dan minimal 1 baris data' },
        { status: 400 }
      );
    }
    
    // Parse header
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedHeaders = ['idwilayah', 'nomorResponden', 'catatan'];
    
    // Validate headers
    const missingHeaders = expectedHeaders.filter(h => !header.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Header CSV tidak lengkap. Missing: ${missingHeaders.join(', ')}. Format yang benar: idwilayah,nomorResponden,catatan` },
        { status: 400 }
      );
    }
    
    // Get header indexes
    const headerIndexes = {
      idwilayah: header.indexOf('idwilayah'),
      nomorResponden: header.indexOf('nomorResponden'),
      catatan: header.indexOf('catatan'),
    };
    
    // Validate category and period exist
    const [category, period, regions] = await Promise.all([
      prisma.surveyCategory.findUnique({ where: { id: categoryId } }),
      prisma.surveyPeriod.findUnique({ where: { id: periodId } }),
      prisma.region.findMany(),
    ]);
    
    console.log('Found category:', category?.name, 'Found period:', period?.name);
    
    if (!category) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 400 }
      );
    }
    
    if (!period) {
      return NextResponse.json(
        { error: 'Periode tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Parse data rows
    const dataRows = lines.slice(1);
    const validData: any[] = [];
    const errors: string[] = [];
    const nomorRespondenSet = new Set<string>(); // Track duplicate nomorResponden in CSV
    
    const regionMap = new Map(regions.map(r => [r.regionCode, r]));
    
    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 2; // +2 because we start from line 2 (after header)
      const row = dataRows[i];
      
      // Simple CSV parsing (handle quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < row.length; j++) {
        const char = row[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add the last value
      
      if (values.length < expectedHeaders.length) {
        errors.push(`Baris ${rowIndex}: Jumlah kolom tidak sesuai`);
        continue;
      }
      
      const rowData = {
        idwilayah: values[headerIndexes.idwilayah]?.replace(/"/g, '') || '',
        nomorResponden: values[headerIndexes.nomorResponden]?.replace(/"/g, '') || '',
        catatan: values[headerIndexes.catatan]?.replace(/"/g, '') || '',
      };
      
      // Validate required fields
      if (!rowData.idwilayah || !rowData.nomorResponden || !rowData.catatan) {
        errors.push(`Baris ${rowIndex}: Semua field harus diisi (idwilayah, nomorResponden, catatan)`);
        continue;
      }
      
      // Convert and validate nomorResponden as integer
      const nomorRespondenInt = parseInt(rowData.nomorResponden, 10);
      if (isNaN(nomorRespondenInt) || nomorRespondenInt <= 0) {
        errors.push(`Baris ${rowIndex}: Nomor responden '${rowData.nomorResponden}' harus berupa angka positif`);
        continue;
      }
      
      // Validate region exists
      const region = regionMap.get(rowData.idwilayah);
      if (!region) {
        errors.push(`Baris ${rowIndex}: Region dengan kode '${rowData.idwilayah}' tidak ditemukan`);
        continue;
      }
      
      // Check duplicate nomorResponden in CSV
      if (nomorRespondenSet.has(nomorRespondenInt.toString())) {
        errors.push(`Baris ${rowIndex}: Nomor responden '${nomorRespondenInt}' duplikat dalam file CSV`);
        continue;
      }
      nomorRespondenSet.add(nomorRespondenInt.toString());
      
      // Check if current user can add data for this region
      if (user.role !== 'ADMIN' && user.regionId && user.regionId !== region.id) {
        errors.push(`Baris ${rowIndex}: Anda tidak dapat menambah data untuk region ini`);
        continue;
      }
      
      // Generate respondenId
      const respondenId = `${categoryId}-${periodId}-${nomorRespondenInt}`;
      
      validData.push({
        nomorResponden: nomorRespondenInt, // Use integer value
        respondenId,
        catatan: rowData.catatan,
        regionId: region.id, // Use the actual region ID from database
        categoryId,
        periodId,
        userId: user.userId,
      });
    }
    
    // If there are validation errors and no valid data, return errors
    if (errors.length > 0 && validData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          errors,
          message: 'Tidak ada data valid yang dapat diimpor'
        },
        { status: 400 }
      );
    }
    
    // Execute replace operation in transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete existing data for this category + period combination
      const deletedCount = await tx.catatanSurvei.deleteMany({
        where: {
          categoryId,
          periodId,
        },
      });
      
      console.log(`Deleted ${deletedCount.count} existing records for ${category?.name || 'Unknown Category'} - ${period?.name || 'Unknown Period'}`);
      
      // Step 2: Insert new data in batches
      if (validData.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < validData.length; i += batchSize) {
          const batch = validData.slice(i, i + batchSize);
          await tx.catatanSurvei.createMany({
            data: batch,
            skipDuplicates: false,
          });
        }
      }
    });
    
    // Get preview data (first 50 records)
    const preview = await prisma.catatanSurvei.findMany({
      where: {
        categoryId,
        periodId,
      },
      take: 50,
      orderBy: {
        nomorResponden: 'asc',
      },
      include: {
        region: {
          select: {
            province: true,
            city: true,
            regionCode: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        period: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      imported: validData.length,
      errors: errors.length > 0 ? errors : undefined,
      preview,
      categoryName: category?.name || 'Unknown Category',
      periodName: period?.name || 'Unknown Period',
      message: errors.length > 0 
        ? `${validData.length} data berhasil diimpor dengan ${errors.length} peringatan`
        : `${validData.length} data berhasil diimpor untuk ${category?.name || 'Unknown Category'} - ${period?.name || 'Unknown Period'}`
    });
    
  } catch (error: any) {
    console.error('=== Upload CSV Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Full error object:', error);
    
    if (error.message.includes('Authentication required')) {
      return NextResponse.json({ 
        success: false,
        error: 'Authentication required. Please login again.' 
      }, { status: 401 });
    }
    
    if (error.message.includes('required')) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}