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

    // Get analysis results for this berita
    const { data: analysisResults, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('scrappingBeritaId', params.id)
      .order('createdAt', { ascending: false });

    // If there's an error fetching analysis results, just log it but don't fail the request
    if (analysisError) {
      console.warn('Failed to fetch analysis results:', analysisError);
    }

    return NextResponse.json({ 
      berita: {
        ...berita,
        analysisResults: analysisResults || []
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