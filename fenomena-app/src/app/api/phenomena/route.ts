import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import * as XLSX from 'xlsx';

const phenomenonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  periodId: z.string().min(1, 'Period is required'),
  regionId: z.string().min(1, 'Region is required'),
});

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');
    const periodId = url.searchParams.get('periodId');
    const regionId = url.searchParams.get('regionId');
    const search = url.searchParams.get('search');
    const count = url.searchParams.get('count') === 'true';
    const download = url.searchParams.get('download') === 'true';
    const format = url.searchParams.get('format') || 'json';

    const whereClause: any = {};

    // Filter by category if provided
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    // Filter by period if provided
    if (periodId) {
      whereClause.periodId = periodId;
    }

    // Filter by region if provided
    if (regionId) {
      whereClause.regionId = regionId;
    }

    // Search in title and description if provided
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If only count is requested
    if (count && !download) {
      const total = await prisma.phenomenon.count({
        where: whereClause,
      });
      return NextResponse.json({ count: total });
    }

    const phenomena = await prisma.phenomenon.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
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
        region: {
          select: {
            province: true,
            city: true,
            regionCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: download ? 10000 : undefined, // Limit download to 10k records
    });

    // Handle download formats
    if (download) {
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `fenomena-data-${timestamp}`;
      let contentType = 'application/json';
      let data: string;

      // Transform data for export
      const exportData = phenomena.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category.name,
        period: p.period.name,
        region: p.region?.city || '',
        province: p.region?.province || '',
        city: p.region?.city || '',
        regionCode: p.region?.regionCode || '',
        author: p.user.username,
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

    return NextResponse.json(phenomena);
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
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { regionId: true, role: true },
    });

    if (!currentUser) {
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
    const category = await prisma.surveyCategory.findUnique({
      where: { id: validatedData.categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Verify period exists
    const period = await prisma.surveyPeriod.findUnique({
      where: { id: validatedData.periodId },
    });
    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Verify region exists
    const region = await prisma.region.findUnique({
      where: { id: validatedData.regionId },
    });
    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    const phenomenon = await prisma.phenomenon.create({
      data: {
        ...validatedData,
        userId: user.userId,
      },
      include: {
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
        region: {
          select: {
            province: true,
            city: true,
            regionCode: true,
          },
        },
      },
    });

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