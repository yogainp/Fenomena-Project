// Supabase helper functions for common database operations
import { supabase } from './supabase';

export async function saveScrapedArticle(articleData: {
  idBerita: string;
  portalBerita: string;
  linkBerita: string;
  judul: string;
  isi: string;
  tanggalBerita: Date;
  matchedKeywords: string[];
}) {
  const { data, error } = await supabase
    .from('scrapping_berita')
    .insert({
      id: crypto.randomUUID(),
      idBerita: articleData.idBerita,
      portalBerita: articleData.portalBerita,
      linkBerita: articleData.linkBerita,
      judul: articleData.judul,
      isi: articleData.isi,
      tanggalBerita: articleData.tanggalBerita.toISOString(),
      matchedKeywords: articleData.matchedKeywords,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save article: ${error.message}`);
  }

  return data;
}

export async function incrementKeywordMatchCount(keywordId: string) {
  // First get current count
  const { data: current } = await supabase
    .from('scrapping_keywords')
    .select('matchCount')
    .eq('id', keywordId)
    .single();
  
  if (current) {
    // Update with incremented count
    const { error } = await supabase
      .from('scrapping_keywords')
      .update({ matchCount: ((current.matchCount as number) || 0) + 1 })
      .eq('id', keywordId);
    
    if (error) {
      console.warn('Failed to update keyword match count:', error);
    }
  }
}

// Helper function to update match counts for multiple keywords by name
export async function incrementKeywordMatchCountsByName(keywords: string[]) {
  // Get all active keywords to find their IDs
  const activeKeywords = await getActiveKeywords();
  
  for (const keyword of keywords) {
    const keywordObj = activeKeywords.find(k => 
      (k.keyword as string).toLowerCase() === keyword.toLowerCase()
    );
    if (keywordObj?.id) {
      await incrementKeywordMatchCount(keywordObj.id as string);
    }
  }
}

export async function getActiveKeywords() {
  const { data, error } = await supabase
    .from('scrapping_keywords')
    .select('id, keyword')
    .eq('isActive', true);

  if (error) {
    throw new Error(`Failed to get keywords: ${error.message}`);
  }

  return data || [];
}

export async function checkExistingArticle(linkBerita: string, judul: string) {
  const { data, error } = await supabase
    .from('scrapping_berita')
    .select('id')
    .or(`linkBerita.eq."${linkBerita}",judul.eq."${judul}"`)
    .limit(1);

  if (error) {
    console.warn('Error checking existing article:', error);
    return false;
  }

  return data && data.length > 0;
}