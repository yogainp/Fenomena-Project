import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user and require ADMIN role
    const user = requireRole(request, 'ADMIN');
    console.log(`Admin ${user.email} is clearing all scraped news`);

    // Count total news before deletion for confirmation
    const { count: totalCount } = await supabase
      .from('scrapping_berita')
      .select('*', { count: 'exact', head: true });
    
    if ((totalCount || 0) === 0) {
      return NextResponse.json({ 
        message: 'No news articles to delete',
        deletedCount: 0 
      });
    }

    // Delete all scraped news articles
    const { error: deleteError } = await supabase
      .from('scrapping_berita')
      .delete()
      .neq('id', ''); // This will match all records
      
    if (deleteError) {
      console.error('Error deleting all berita:', deleteError);
      throw deleteError;
    }
    
    console.log(`Successfully deleted ${totalCount} news articles`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all scraped news articles`,
      deletedCount: totalCount,
      totalCount: totalCount
    });

  } catch (error) {
    console.error('Clear all news error:', error);
    
    // Handle authentication errors
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ADMIN role required') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}