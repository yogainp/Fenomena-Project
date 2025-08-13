import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { requireRole } from '@/lib/middleware';

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

    console.log('Text analysis request by user:', user.userId);

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const regionId = searchParams.get('regionId');
    const customKeywordsParam = searchParams.get('customKeywords');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build Supabase query
    let query = supabase
      .from('phenomena')
      .select(`
        id,
        title,
        description,
        createdAt,
        category:survey_categories(id, name, periodeSurvei, startDate, endDate),
        region:regions(id, city, province, regionCode)
      `);

    // Apply filters
    if (categoryId && categoryId !== 'all') {
      query = query.eq('categoryId', categoryId);
    }
    if (regionId && regionId !== 'all') {
      query = query.eq('regionId', regionId);
    }
    if (startDate) {
      query = query.gte('createdAt', startDate);
    }
    if (endDate) {
      query = query.lte('createdAt', endDate);
    }

    const { data: phenomena, error } = await query;

    if (error) {
      console.error('Text analysis fetch error:', error);
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }

    // Simple text analysis functions
    function extractKeywords(text: string): string[] {
      // Convert to lowercase and remove punctuation
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      
      // Split into words and filter out common stop words
      const stopWords = ['dan', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'oleh', 'adalah', 'ini', 'itu', 'atau', 'juga', 'akan', 'dapat', 'tidak', 'lebih', 'seperti', 'antara', 'sektor', 'hal', 'tersebut', 'serta', 'secara', 'karena', 'namun', 'masih', 'sudah', 'telah', 'sangat', 'cukup', 'hanya', 'belum', 'banyak'];
      
      const words = cleanText.split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.includes(word))
        .filter(word => !word.match(/^\d+$/)); // Remove pure numbers
      
      return words;
    }

    function getWordFrequency(words: string[]): { [key: string]: number } {
      const frequency: { [key: string]: number } = {};
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
      });
      return frequency;
    }

    function getSentimentScore(text: string): 'positive' | 'negative' | 'neutral' {
      const positiveWords = ['peningkatan', 'pertumbuhan', 'kenaikan', 'perbaikan', 'kemajuan', 'sukses', 'baik', 'meningkat', 'tumbuh', 'berkembang', 'optimal', 'efisien'];
      const negativeWords = ['penurunan', 'pengurangan', 'defisit', 'masalah', 'tantangan', 'kesulitan', 'gagal', 'turun', 'menurun', 'berkurang', 'buruk', 'krisis'];
      
      const lowerText = text.toLowerCase();
      
      let positiveScore = 0;
      let negativeScore = 0;
      
      positiveWords.forEach(word => {
        if (lowerText.includes(word)) positiveScore++;
      });
      
      negativeWords.forEach(word => {
        if (lowerText.includes(word)) negativeScore++;
      });
      
      if (positiveScore > negativeScore) return 'positive';
      if (negativeScore > positiveScore) return 'negative';
      return 'neutral';
    }

    function analyzeProximityWords(text: string, targetKeywords: string[], windowSize: number = 3): { [keyword: string]: { proximityWords: { [word: string]: number }, totalOccurrences: number } } {
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      const words = cleanText.split(/\s+/).filter(word => word.length > 2);
      const stopWords = ['dan', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'oleh', 'adalah', 'ini', 'itu', 'atau', 'juga', 'akan', 'dapat', 'tidak', 'lebih', 'seperti', 'antara', 'sektor', 'hal', 'tersebut', 'serta', 'secara', 'karena', 'namun', 'masih', 'sudah', 'telah', 'sangat', 'cukup', 'hanya', 'belum', 'banyak'];
      
      const result: { [keyword: string]: { proximityWords: { [word: string]: number }, totalOccurrences: number } } = {};
      
      targetKeywords.forEach(keyword => {
        result[keyword] = { proximityWords: {}, totalOccurrences: 0 };
        
        for (let i = 0; i < words.length; i++) {
          if (words[i].includes(keyword) || keyword.includes(words[i])) {
            result[keyword].totalOccurrences++;
            
            // Analyze words within the window
            const start = Math.max(0, i - windowSize);
            const end = Math.min(words.length, i + windowSize + 1);
            
            for (let j = start; j < end; j++) {
              if (j !== i && words[j].length > 3 && !stopWords.includes(words[j]) && !words[j].match(/^\d+$/)) {
                const proximityWord = words[j];
                result[keyword].proximityWords[proximityWord] = (result[keyword].proximityWords[proximityWord] || 0) + 1;
              }
            }
          }
        }
      });
      
      return result;
    }

    // Parse custom keywords or use defaults
    const defaultKeywords = ['peningkatan', 'penurunan', 'naik', 'turun', 'tumbuh'];
    let customKeywords: string[] = [];
    
    if (customKeywordsParam) {
      customKeywords = customKeywordsParam
        .split(',')
        .map(keyword => keyword.trim().toLowerCase())
        .filter(keyword => keyword.length > 0);
    }
    
    const allTargetKeywords = [...defaultKeywords, ...customKeywords];
    const uniqueTargetKeywords = [...new Set(allTargetKeywords)];

    // Analyze all phenomena texts
    let allWords: string[] = [];
    const sentimentAnalysis: { [key: string]: number } = { positive: 0, negative: 0, neutral: 0 };
    const categoryKeywords: { [category: string]: string[] } = {};
    const proximityAnalysisResults: { [keyword: string]: { proximityWords: { [word: string]: number }, totalOccurrences: number } } = {};
    
    // Initialize proximity analysis results for all target keywords
    uniqueTargetKeywords.forEach(keyword => {
      proximityAnalysisResults[keyword] = { proximityWords: {}, totalOccurrences: 0 };
    });

    (phenomena || []).forEach(phenomenon => {
      const combinedText = `${phenomenon.title} ${phenomenon.description}`;
      const words = extractKeywords(combinedText);
      
      allWords = allWords.concat(words);
      
      // Sentiment analysis
      const sentiment = getSentimentScore(combinedText);
      sentimentAnalysis[sentiment]++;
      
      // Category-specific keywords
      const categoryName = (phenomenon as any).category?.name || 'Unknown';
      if (!categoryKeywords[categoryName]) {
        categoryKeywords[categoryName] = [];
      }
      categoryKeywords[categoryName] = categoryKeywords[categoryName].concat(words);
      
      // Proximity analysis
      const proximityResults = analyzeProximityWords(combinedText, uniqueTargetKeywords);
      Object.keys(proximityResults).forEach(keyword => {
        proximityAnalysisResults[keyword].totalOccurrences += proximityResults[keyword].totalOccurrences;
        Object.keys(proximityResults[keyword].proximityWords).forEach(word => {
          proximityAnalysisResults[keyword].proximityWords[word] = 
            (proximityAnalysisResults[keyword].proximityWords[word] || 0) + proximityResults[keyword].proximityWords[word];
        });
      });
    });

    // Get overall word frequency
    const wordFrequency = getWordFrequency(allWords);
    const topKeywords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Get category-specific top keywords
    const categoryAnalysis: { [category: string]: { word: string; count: number }[] } = {};
    Object.entries(categoryKeywords).forEach(([category, words]) => {
      const frequency = getWordFrequency(words);
      categoryAnalysis[category] = Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    });

    // Calculate average description length
    const avgDescriptionLength = phenomena && phenomena.length > 0 
      ? phenomena.reduce((sum, p) => sum + ((p as any).description?.length || 0), 0) / phenomena.length 
      : 0;

    // Word cloud data (top 50 words for visualization)
    const wordCloudData = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([text, value]) => ({ text, value }));

    // Process proximity analysis results
    const proximityAnalysis: { [keyword: string]: { keyword: string, occurrences: number, topProximityWords: { word: string, count: number }[] } } = {};
    Object.keys(proximityAnalysisResults).forEach(keyword => {
      const data = proximityAnalysisResults[keyword];
      const topProximityWords = Object.entries(data.proximityWords)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
      
      proximityAnalysis[keyword] = {
        keyword,
        occurrences: data.totalOccurrences,
        topProximityWords
      };
    });

    return NextResponse.json({
      totalPhenomena: phenomena ? phenomena.length : 0,
      topKeywords,
      sentimentAnalysis: [
        { name: 'Positif', value: sentimentAnalysis.positive },
        { name: 'Negatif', value: sentimentAnalysis.negative },
        { name: 'Netral', value: sentimentAnalysis.neutral },
      ],
      categoryAnalysis,
      avgDescriptionLength: Math.round(avgDescriptionLength),
      wordCloudData,
      totalUniqueWords: Object.keys(wordFrequency).length,
      proximityAnalysis,
      filterInfo: {
        categoryId: categoryId || 'all',
        regionId: regionId || 'all',
        startDate: startDate || '',
        endDate: endDate || '',
        isFiltered: Boolean(categoryId && categoryId !== 'all') || Boolean(regionId && regionId !== 'all') || Boolean(startDate) || Boolean(endDate)
      },
      proximityKeywordsInfo: {
        defaultKeywords,
        customKeywords,
        totalKeywords: uniqueTargetKeywords,
        hasCustomKeywords: customKeywords.length > 0
      },
    });

  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Text analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/analytics/text-analysis - Save analysis results for scrapping berita
export async function POST(request: NextRequest) {
  try {
    const user = requireRole(request, 'ADMIN');
    console.log('Save analysis request by user:', user.userId);

    const body = await request.json();
    const { scrappingBeritaId, analysisType, results } = body;

    // Validate required fields
    if (!scrappingBeritaId || !analysisType || !results) {
      return NextResponse.json({ 
        error: 'Missing required fields: scrappingBeritaId, analysisType, results' 
      }, { status: 400 });
    }

    // Validate analysisType
    if (analysisType !== 'NEWS_SCRAPING_ANALYSIS') {
      return NextResponse.json({ 
        error: 'Invalid analysisType. Expected: NEWS_SCRAPING_ANALYSIS' 
      }, { status: 400 });
    }

    // Check if scrapping berita exists
    const { data: scrappingBerita, error: findError } = await supabase
      .from('scrapping_berita')
      .select('id')
      .eq('id', scrappingBeritaId)
      .single();

    if (findError || !scrappingBerita) {
      return NextResponse.json({ 
        error: 'Scrapping berita not found' 
      }, { status: 404 });
    }

    // Check if analysis already exists for this berita
    const { data: existingAnalysis, error: existingError } = await supabase
      .from('analysis_results')
      .select('id')
      .eq('scrappingBeritaId', scrappingBeritaId)
      .eq('analysisType', analysisType)
      .single();

    let analysisResult;

    if (existingAnalysis && !existingError) {
      // Update existing analysis
      const { data: updatedData, error: updateError } = await supabase
        .from('analysis_results')
        .update({
          results: results,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', (existingAnalysis as any).id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating analysis:', updateError);
        throw new Error('Failed to update analysis');
      }

      analysisResult = updatedData;
    } else {
      // Create new analysis
      const { data: newData, error: createError } = await supabase
        .from('analysis_results')
        .insert({
          id: crypto.randomUUID(),
          analysisType: analysisType,
          results: results,
          scrappingBeritaId: scrappingBeritaId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating analysis:', createError);
        throw new Error('Failed to create analysis');
      }

      analysisResult = newData;
    }

    return NextResponse.json({
      message: 'Analysis saved successfully',
      analysisId: analysisResult.id,
      updated: !!(existingAnalysis && !existingError),
    });

  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Save analysis error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}