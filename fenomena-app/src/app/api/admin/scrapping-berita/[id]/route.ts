import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

// GET /api/admin/scrapping-berita/[id] - Get single news item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const berita = await prisma.scrappingBerita.findUnique({
      where: { id: params.id },
      include: {
        analysisResults: {
          select: {
            id: true,
            analysisType: true,
            results: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!berita) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    return NextResponse.json({ berita });

  } catch (error: any) {
    console.error('Get berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/scrapping-berita/[id] - Delete single news item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if news exists
    const existingBerita = await prisma.scrappingBerita.findUnique({
      where: { id: params.id },
    });

    if (!existingBerita) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    // Delete news (this will also cascade delete analysis results)
    await prisma.scrappingBerita.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'News deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}