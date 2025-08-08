import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { requireAuth } from '@/lib/middleware';
import * as XLSX from 'xlsx';

const phenomenonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  regionId: z.string().min(1, 'Region is required'),
});

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');
    const periodId = url.searchParams.get('periodId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const regionId = url.searchParams.get('regionId');
    const search = url.searchParams.get('search');
    const count = url.searchParams.get('count') === 'true';
    const download = url.searchParams.get('download') === 'true';
    const format = url.searchParams.get('format') || 'json';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const context = url.searchParams.get('context'); // 'management' for /phenomena page

    // Build Supabase query
    let query = supabase
      .from('phenomena')
      .select(`
        *,
        user:users(username),
        category:survey_categories(name, periodeSurvei, startDate, endDate),
        region:regions(province, city, regionCode)
      `, { count: 'exact' });

    // For non-admin users in management context, restrict to their assigned region
    if (user.role !== 'ADMIN' && context === 'management') {
      if (!user.regionId) {
        return NextResponse.json({ error: 'User not assigned to any region' }, { status: 403 });
      }
      query = query.eq('regionId', user.regionId);
    }

    // Apply filters
    if (categoryId) {
      query = query.eq('categoryId', categoryId);
    }

    if (regionId) {
      query = query.eq('regionId', regionId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // If only count is requested
    if (count && !download) {
      const { count: total, error } = await query;
      if (error) {
        console.error('Count error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
      return NextResponse.json({ count: total || 0 });
    }

    // Apply pagination and ordering
    query = query
      .order('createdAt', { ascending: false })
      .range(offset, offset + (download ? 9999 : limit - 1));

    const { data: phenomena, count: total, error } = await query;

    if (error) {
      console.error('Phenomena fetch error:', error);
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message 
      }, { status: 500 });
    }

    // Handle download formats
    if (download) {
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `fenomena-data-${timestamp}`;
      let contentType = 'application/json';
      let data: string;

      // Transform data for export
      const exportData = (phenomena || []).map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category?.name || 'N/A',
        period: p.category?.periodeSurvei || 'N/A',
        region: p.region?.city || '',
        province: p.region?.province || '',
        city: p.region?.city || '',
        regionCode: p.region?.regionCode || '',
        author: p.user?.username || 'Unknown',
        createdAt: p.createdAt,
      }));

      switch (format) {
        case 'csv':
          filename += '.csv';
          contentType = 'text/csv';
          // Create CSV content
          const headers = ['ID', 'Judul', 'Deskripsi', 'Kategori', 'Periode', 'Wilayah', 'Provinsi', 'Kota', 'Kode Wilayah', 'Pembuat', 'Tanggal Dibuat'];
          const csvRows = [
            headers.join(','),
            ...exportData.map(row => [
              row.id,
              `"${row.title.replace(/"/g, '""')}"`,
              `"${row.description.replace(/"/g, '""')}"`,
              `"${row.category}"`,
              `"${row.period}"`,
              `"${row.region}"`,
              `"${row.province}"`,
              `"${row.city}"`,
              `"${row.regionCode}"`,
              `"${row.author}"`,
              row.createdAt
            ].join(','))
          ];
          data = csvRows.join('\n');
          break;

        case 'excel':
          filename += '.xlsx';
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          
          // Create Excel workbook
          const worksheet = XLSX.utils.json_to_sheet(exportData.map(row => ({
            'ID': row.id,
            'Judul': row.title,
            'Deskripsi': row.description,
            'Kategori': row.category,
            'Periode': row.period,
            'Wilayah': row.region,
            'Provinsi': row.province,
            'Kota': row.city,
            'Kode Wilayah': row.regionCode,
            'Pembuat': row.author,
            'Tanggal Dibuat': new Date(row.createdAt).toLocaleDateString('id-ID')
          })));
          
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Fenomena');
          
          // Generate Excel file buffer
          const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          
          return new NextResponse(excelBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          });

        default: // json
          filename += '.json';
          contentType = 'application/json';
          data = JSON.stringify(exportData, null, 2);
          break;
      }

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Return paginated response
    const totalPages = Math.ceil((total || 0) / limit);
    return NextResponse.json({
      phenomena: phenomena || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get phenomena error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const validatedData = phenomenonSchema.parse(body);

    // Get current user's region
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('regionId, role')
      .eq('id', user.userId)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Enforce region restriction for non-admin users
    if (currentUser.role !== 'ADMIN') {
      if (!currentUser.regionId) {
        return NextResponse.json({ 
          error: 'You must be assigned to a region to create phenomena. Please contact admin.' 
        }, { status: 403 });
      }

      if (validatedData.regionId !== currentUser.regionId) {
        return NextResponse.json({ 
          error: 'You can only create phenomena in your assigned region.' 
        }, { status: 403 });
      }
    }

    // Verify category exists
    const { data: category, error: categoryError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('id', validatedData.categoryId)
      .single();
      
    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Verify region exists
    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('id')
      .eq('id', validatedData.regionId)
      .single();
      
    if (regionError || !region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // Create the phenomenon
    const insertData = {
      id: crypto.randomUUID(),
      ...validatedData,
      userId: user.userId,
    };
    
    console.log('Attempting to insert phenomenon data:', JSON.stringify(insertData, null, 2));
    console.log('User info:', JSON.stringify({ userId: user.userId, email: user.email, role: user.role }, null, 2));
    
    const { data: phenomenon, error: createError } = await supabase
      .from('phenomena')
      .insert(insertData)
      .select('*')
      .single();

    if (createError) {
      console.error('Create phenomenon error:', createError);
      console.error('Create phenomenon error details:', JSON.stringify(createError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to create phenomenon', 
        details: createError.message,
        code: createError.code 
      }, { status: 500 });
    }

    return NextResponse.json(phenomenon, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}