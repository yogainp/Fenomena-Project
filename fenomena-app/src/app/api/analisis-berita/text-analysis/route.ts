import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('News text analysis request by user:', user.userId);

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const portalBerita = searchParams.get('portalBerita');
    const keyword = searchParams.get('keyword');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customKeywordsParam = searchParams.get('customKeywords');

    // Build Supabase query with filters
    let query = supabase
      .from('scrapping_berita')
      .select('id, judul, isi, portalBerita, tanggalBerita, matchedKeywords');

    // Apply filters
    if (portalBerita && portalBerita !== 'all') {
      query = query.eq('portalBerita', portalBerita);
    }
    
    if (keyword) {
      query = query.contains('matchedKeywords', [keyword]);
    }
    
    if (startDate) {
      query = query.gte('tanggalBerita', startDate);
    }
    
    if (endDate) {
      query = query.lte('tanggalBerita', endDate);
    }

    // Get news articles for analysis with optional filtering
    const { data: beritaList, error: beritaError } = await query;

    if (beritaError) {
      console.error('Error fetching berita for text analysis:', beritaError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!beritaList || beritaList.length === 0) {
      return NextResponse.json({
        totalBerita: 0,
        topKeywords: [],
        sentimentAnalysis: [
          { name: 'Positif', value: 0 },
          { name: 'Negatif', value: 0 },
          { name: 'Netral', value: 0 },
        ],
        portalAnalysis: {},
        avgContentLength: 0,
        wordCloudData: [],
        totalUniqueWords: 0,
        proximityAnalysis: {},
        filterInfo: {
          portalBerita: portalBerita || 'all',
          keyword: keyword || '',
          startDate: startDate || '',
          endDate: endDate || '',
          isFiltered: Boolean(portalBerita && portalBerita !== 'all') || Boolean(keyword) || Boolean(startDate) || Boolean(endDate)
        },
        proximityKeywordsInfo: {
          defaultKeywords: ['peningkatan', 'penurunan', 'kenaikan', 'krisis', 'pembangunan', 'ekonomi', 'politik', 'sosial'],
          customKeywords: [],
          totalKeywords: ['peningkatan', 'penurunan', 'kenaikan', 'krisis', 'pembangunan', 'ekonomi', 'politik', 'sosial'],
          hasCustomKeywords: false
        },
      });
    }

    // Text analysis functions optimized for Indonesian news content
    function extractKeywords(text: string): string[] {
      // Convert to lowercase and remove punctuation
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      
      // Enhanced Indonesian stop words for news content
      const stopWords = [
        'dan', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'oleh', 
        'adalah', 'ini', 'itu', 'atau', 'juga', 'akan', 'dapat', 'tidak', 'lebih', 
        'seperti', 'antara', 'sektor', 'hal', 'tersebut', 'serta', 'secara', 'karena', 
        'namun', 'masih', 'sudah', 'telah', 'sangat', 'cukup', 'hanya', 'belum', 'banyak',
        // News-specific stop words
        'berita', 'kata', 'mengatakan', 'dikatakan', 'dijelaskan', 'menyatakan', 
        'menurutnya', 'katanya', 'ucapnya', 'ungkapnya', 'sambungnya', 'tambahnya',
        'saat', 'ketika', 'selama', 'hingga', 'sampai', 'sejak', 'sebelum', 'sesudah',
        'hari', 'tanggal', 'bulan', 'tahun', 'jam', 'menit', 'detik'
      ];
      
      const words = cleanText.split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.includes(word))
        .filter(word => !word.match(/^\d+$/)) // Remove pure numbers
        .filter(word => !word.match(/^(https?|www)/)); // Remove URLs
      
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
      const positiveWords = [
        'peningkatan', 'pertumbuhan', 'kenaikan', 'perbaikan', 'kemajuan', 'sukses', 
        'berhasil', 'baik', 'meningkat', 'tumbuh', 'berkembang', 'optimal', 'efisien',
        'positif', 'bagus', 'hebat', 'luar biasa', 'gemilang', 'cemerlang', 'unggul',
        'prestasi', 'keberhasilan', 'pencapaian', 'rekor', 'tertinggi', 'terbaik'
      ];
      
      const negativeWords = [
        'penurunan', 'pengurangan', 'defisit', 'masalah', 'tantangan', 'kesulitan', 
        'gagal', 'turun', 'menurun', 'berkurang', 'buruk', 'krisis', 'bencana',
        'negatif', 'jelek', 'terburuk', 'terendah', 'kerugian', 'rugi', 'bangkrut',
        'konflik', 'kerusuhan', 'korupsi', 'kriminal', 'kejahatan', 'kecelakaan'
      ];
      
      const lowerText = text.toLowerCase();
      
      let positiveScore = 0;
      let negativeScore = 0;
      
      positiveWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) positiveScore += matches.length;
      });
      
      negativeWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) negativeScore += matches.length;
      });
      
      if (positiveScore > negativeScore) return 'positive';
      if (negativeScore > positiveScore) return 'negative';
      return 'neutral';
    }

    function analyzeProximityWords(text: string, targetKeywords: string[], windowSize: number = 5): { [keyword: string]: { proximityWords: { [word: string]: number }, totalOccurrences: number } } {
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      const words = cleanText.split(/\s+/).filter(word => word.length > 2);
      
      const stopWords = [
        'dan', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'oleh',
        'adalah', 'ini', 'itu', 'atau', 'juga', 'akan', 'dapat', 'tidak', 'lebih',
        'berita', 'kata', 'mengatakan', 'saat', 'ketika', 'hari'
      ];
      
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

    // Analyze all news texts
    let allWords: string[] = [];
    const sentimentAnalysis: { [key: string]: number } = { positive: 0, negative: 0, neutral: 0 };
    const portalKeywords: { [portal: string]: string[] } = {};
    // Parse custom keywords or use defaults
    const defaultKeywords = ['peningkatan', 'penurunan', 'kenaikan', 'krisis', 'pembangunan', 'ekonomi', 'politik', 'sosial'];
    let customKeywords: string[] = [];
    
    if (customKeywordsParam) {
      customKeywords = customKeywordsParam
        .split(',')
        .map(keyword => keyword.trim().toLowerCase())
        .filter(keyword => keyword.length > 0);
    }
    
    const allTargetKeywords = [...defaultKeywords, ...customKeywords];
    const uniqueTargetKeywords = [...new Set(allTargetKeywords)];

    const proximityAnalysisResults: { [keyword: string]: { proximityWords: { [word: string]: number }, totalOccurrences: number } } = {};

    // Initialize proximity analysis
    uniqueTargetKeywords.forEach(keyword => {
      proximityAnalysisResults[keyword] = { proximityWords: {}, totalOccurrences: 0 };
    });

    beritaList.forEach(berita => {
      const combinedText = `${berita.judul} ${berita.isi}`;
      const words = extractKeywords(combinedText);
      
      allWords = allWords.concat(words);
      
      // Sentiment analysis
      const sentiment = getSentimentScore(combinedText);
      sentimentAnalysis[sentiment]++;
      
      // Portal-specific keywords
      const portalName = (berita as any).portalBerita as string;
      if (!portalKeywords[portalName]) {
        portalKeywords[portalName] = [];
      }
      portalKeywords[portalName] = portalKeywords[portalName].concat(words);
      
      // Proximity analysis
      const proximityResults = analyzeProximityWords(combinedText, uniqueTargetKeywords);
      Object.keys(proximityResults).forEach(keyword => {
        if (proximityAnalysisResults[keyword]) {
          proximityAnalysisResults[keyword].totalOccurrences += proximityResults[keyword].totalOccurrences;
          Object.keys(proximityResults[keyword].proximityWords).forEach(word => {
            proximityAnalysisResults[keyword].proximityWords[word] = 
              (proximityAnalysisResults[keyword].proximityWords[word] || 0) + proximityResults[keyword].proximityWords[word];
          });
        }
      });
    });

    // Get overall word frequency
    const wordFrequency = getWordFrequency(allWords);
    const topKeywords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Get portal-specific top keywords
    const portalAnalysis: { [portal: string]: { word: string; count: number }[] } = {};
    Object.entries(portalKeywords).forEach(([portal, words]) => {
      const frequency = getWordFrequency(words);
      portalAnalysis[portal] = Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    });

    // Calculate average content length
    const avgContentLength = beritaList.reduce((sum, b) => sum + ((b as any).isi as string).length, 0) / beritaList.length;

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
      totalBerita: beritaList.length,
      topKeywords,
      sentimentAnalysis: [
        { name: 'Positif', value: sentimentAnalysis.positive },
        { name: 'Negatif', value: sentimentAnalysis.negative },
        { name: 'Netral', value: sentimentAnalysis.neutral },
      ],
      portalAnalysis,
      avgContentLength: Math.round(avgContentLength),
      wordCloudData,
      totalUniqueWords: Object.keys(wordFrequency).length,
      proximityAnalysis,
      filterInfo: {
        portalBerita: portalBerita || 'all',
        keyword: keyword || '',
        startDate: startDate || '',
        endDate: endDate || '',
        isFiltered: Boolean(portalBerita && portalBerita !== 'all') || Boolean(keyword) || Boolean(startDate) || Boolean(endDate)
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
    console.error('News text analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}