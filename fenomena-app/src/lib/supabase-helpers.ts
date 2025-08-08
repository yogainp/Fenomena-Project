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

export async function incrementKeywordMatchCount(keywords: string[]) {
  // For each keyword, increment the match count
  const updates = keywords.map(async keyword => {
    // First get current count
    const { data: current } = await supabase
      .from('scrapping_keywords')
      .select('matchCount')
      .eq('keyword', keyword)
      .single();
    
    if (current) {
      // Update with incremented count
      return supabase
        .from('scrapping_keywords')
        .update({ matchCount: ((current.matchCount as number) || 0) + 1 })
        .eq('keyword', keyword);
    }
  });

  // Execute all updates
  const results = await Promise.all(updates);
  
  // Check for errors
  const errors = results.filter(result => result?.error);
  if (errors.length > 0) {
    console.warn('Some keyword updates failed:', errors);
  }
}

export async function getActiveKeywords() {
  const { data, error } = await supabase
    .from('scrapping_keywords')
    .select('keyword')
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