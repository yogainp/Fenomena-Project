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

    const { data: berita, error } = await supabase
      .from('scrapping_berita')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !berita) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    // TODO: Add analysis results query if needed
    // For now, just return the berita without analysis results
    return NextResponse.json({ 
      berita: {
        ...berita,
        analysisResults: [] // TODO: Query from analysis_results table if exists
      }
    });

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
    const { data: existingBerita, error: findError } = await supabase
      .from('scrapping_berita')
      .select('*')
      .eq('id', params.id)
      .single();

    if (findError || !existingBerita) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }

    // Delete news
    const { error: deleteError } = await supabase
      .from('scrapping_berita')
      .delete()
      .eq('id', params.id);
      
    if (deleteError) {
      console.error('Error deleting berita:', deleteError);
      throw deleteError;
    }

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