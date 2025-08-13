import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryId = formData.get('categoryId') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: 'File CSV harus dipilih' },
        { status: 400 }
      );
    }
    
    if (!categoryId) {
      return NextResponse.json(
        { error: 'Kategori harus dipilih' },
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
    
    // Validate category exists
    const [categoryResult, regionsResult] = await Promise.all([
      supabase
        .from('survey_categories')
        .select('*')
        .eq('id', categoryId)
        .single(),
      supabase
        .from('regions')
        .select('*'),
    ]);
    
    const category = categoryResult.data;
    const regions = regionsResult.data || [];
    
    console.log('Found category:', category?.name);
    
    if (categoryResult.error || !category) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
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
      
      // Generate respondenId (without periodId)
      const respondenId = `${categoryId}-${nomorRespondenInt}`;
      
      validData.push({
        id: crypto.randomUUID(), // Generate UUID for Supabase
        nomorResponden: nomorRespondenInt, // Use integer value
        respondenId,
        catatan: rowData.catatan,
        regionId: region.id, // Use the actual region ID from database
        categoryId,
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
    
    // Execute replace operation
    // Step 1: Delete existing data for this category combination
    const { error: deleteError } = await supabase
      .from('catatan_survei')
      .delete()
      .eq('categoryId', categoryId);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Gagal menghapus data lama' },
        { status: 500 }
      );
    }
    
    console.log(`Deleted existing records for ${category?.name || 'Unknown Category'}`);
    
    // Step 2: Insert new data in batches
    if (validData.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < validData.length; i += batchSize) {
        const batch = validData.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('catatan_survei')
          .insert(batch);
          
        if (insertError) {
          console.error(`Batch insert error (${i}-${i + batch.length}):`, insertError);
          return NextResponse.json(
            { error: `Gagal menyimpan data batch ${i + 1}-${i + batch.length}: ${insertError.message}` },
            { status: 500 }
          );
        }
      }
    }
    
    // Get preview data (first 50 records)
    const { data: preview, error: previewError } = await supabase
      .from('catatan_survei')
      .select(`
        *,
        region:regions(province, city, regionCode),
        category:survey_categories(name),
        user:users(username)
      `)
      .eq('categoryId', categoryId)
      .order('nomorResponden', { ascending: true })
      .limit(50);

    if (previewError) {
      console.error('Preview error:', previewError);
    }
    
    return NextResponse.json({
      success: true,
      imported: validData.length,
      errors: errors.length > 0 ? errors : undefined,
      preview,
      categoryName: category?.name || 'Unknown Category',
      message: errors.length > 0 
        ? `${validData.length} data berhasil diimpor dengan ${errors.length} peringatan`
        : `${validData.length} data berhasil diimpor untuk ${category?.name || 'Unknown Category'}`
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