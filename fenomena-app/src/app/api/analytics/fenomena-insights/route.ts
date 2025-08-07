import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

interface InsightMetrics {
  validationStrength: number;
  publicInterest: number;
  sentimentAlignment: number;
  evidenceDiversity: number;
  overallScore: number;
}

interface CorrelationData {
  keywordOverlap: number;
  temporalRelevance: number;
  geographicRelevance: number;
  sentimentMatch: number;
}

interface FenomenaInsight {
  phenomenonId: string;
  phenomenon: {
    id: string;
    title: string;
    description: string;
    category: { name: string; startDate?: Date; endDate?: Date };
    region: { city: string; province: string };
  };
  metrics: InsightMetrics;
  correlatedNews: Array<{
    id: string;
    judul: string;
    portalBerita: string;
    linkBerita: string;
    tanggalBerita: Date;
    matchedKeywords: string[];
    correlationData: CorrelationData;
    relevanceScore: number;
  }>;
  surveyNotes: Array<{
    id: string;
    catatan: string;
    sentiment: string;
    relevanceScore: number;
  }>;
  keywordAnalysis: {
    phenomenonKeywords: string[];
    newsKeywords: string[];
    surveyKeywords: string[];
    commonKeywords: string[];
    uniqueToNews: string[];
    uniqueToSurvey: string[];
  };
  sentimentAnalysis: {
    phenomenonSentiment: string;
    newsSentiment: { positive: number; negative: number; neutral: number };
    surveySentiment: { positive: number; negative: number; neutral: number };
    alignmentScore: number;
  };
  recommendations: string[];
}

// Constants for request handling
const ANALYSIS_TIMEOUT = 45000; // 45 seconds
const MAX_PHENOMENA_LIMIT = 10;
const MAX_NEWS_PER_PHENOMENON = 10;
const MAX_SURVEY_NOTES = 5;

// Input validation helper
function isValidObjectId(id: string): boolean {
  return /^[a-zA-Z0-9]{25}$/.test(id);
}

// Timeout promise helper
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error('ANALYSIS_TIMEOUT')), ms)
  );
}

// Text analysis helper functions
function extractKeywords(text: string): string[] {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const stopWords = ['dan', 'yang', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'oleh', 'adalah', 'ini', 'itu', 'atau', 'juga', 'akan', 'dapat', 'tidak', 'lebih', 'seperti', 'antara', 'sektor', 'hal', 'tersebut', 'serta', 'secara', 'karena', 'namun', 'masih', 'sudah', 'telah', 'sangat', 'cukup', 'hanya', 'belum', 'banyak'];
  
  return cleanText.split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .filter(word => !word.match(/^\d+$/));
}

function getSentimentScore(text: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['peningkatan', 'pertumbuhan', 'kenaikan', 'perbaikan', 'kemajuan', 'sukses', 'baik', 'meningkat', 'tumbuh', 'berkembang', 'optimal', 'efisien', 'berhasil', 'positif', 'bagus', 'mantap'];
  const negativeWords = ['penurunan', 'pengurangan', 'defisit', 'masalah', 'tantangan', 'kesulitan', 'gagal', 'turun', 'menurun', 'berkurang', 'buruk', 'krisis', 'negatif', 'jelek', 'rusak', 'hancur'];
  
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

function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);
  
  return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
}

function calculateTemporalRelevance(phenomenonDate: Date, newsDate: Date, surveyCategory: { startDate?: Date; endDate?: Date }): number {
  // If no date range is defined in category, use phenomenon creation date
  if (!surveyCategory.startDate || !surveyCategory.endDate) {
    const phenomenonTime = phenomenonDate.getTime();
    const newsTime = newsDate.getTime();
    const timeDiff = Math.abs(phenomenonTime - newsTime);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    // Score based on how close the news is to phenomenon creation
    if (timeDiff <= thirtyDays) {
      return Math.max(0, 100 - (timeDiff / thirtyDays) * 100);
    }
    return 0;
  }
  
  const surveyStart = surveyCategory.startDate.getTime();
  const surveyEnd = surveyCategory.endDate.getTime();
  const newsTime = newsDate.getTime();
  
  // Check if news is within survey period or close to it (within 30 days)
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  if (newsTime >= surveyStart && newsTime <= surveyEnd) {
    return 100; // Perfect temporal match
  } else if (newsTime >= (surveyStart - thirtyDays) && newsTime <= (surveyEnd + thirtyDays)) {
    const distance = Math.min(
      Math.abs(newsTime - surveyStart),
      Math.abs(newsTime - surveyEnd)
    );
    return Math.max(0, 80 - (distance / thirtyDays) * 80);
  }
  
  return 0;
}

export async function GET(request: NextRequest) {
  let insights: FenomenaInsight[] = [];
  let phenomena: any[] = [];
  let totalCount = 0;
  let failedInsights = 0;
  
  try {
    console.log('Request received for fenomena insights');
    
    // For testing - comment out auth
    // const user = requireAuth(request);
    const user = { role: 'ADMIN', userId: 'test', regionId: null };
    
    const { searchParams } = new URL(request.url);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));
    
    // Extract and validate parameters
    const categoryId = searchParams.get('categoryId');
    const periodId = searchParams.get('periodId');
    const regionId = searchParams.get('regionId');
    const phenomenonId = searchParams.get('phenomenonId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(MAX_PHENOMENA_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '5')));
    
    // Input validation
    if (categoryId && categoryId !== 'all' && !isValidObjectId(categoryId)) {
      return NextResponse.json({ 
        error: 'Invalid category ID format',
        details: 'Category ID must be a valid identifier'
      }, { status: 400 });
    }
    
    if (regionId && regionId !== 'all' && !isValidObjectId(regionId)) {
      return NextResponse.json({ 
        error: 'Invalid region ID format',
        details: 'Region ID must be a valid identifier'
      }, { status: 400 });
    }
    
    if (phenomenonId && !isValidObjectId(phenomenonId)) {
      return NextResponse.json({ 
        error: 'Invalid phenomenon ID format',
        details: 'Phenomenon ID must be a valid identifier'
      }, { status: 400 });
    }

    // Build filter conditions
    const whereConditions: any = {};
    if (categoryId && categoryId !== 'all') {
      whereConditions.categoryId = categoryId;
    }
    if (periodId && periodId !== 'all') {
      whereConditions.periodId = periodId;
    }
    if (regionId && regionId !== 'all') {
      whereConditions.regionId = regionId;
    }
    if (phenomenonId) {
      whereConditions.id = phenomenonId;
    }

    // Apply role-based data filtering
    if (user.role !== 'ADMIN') {
      if (user.regionId) {
        whereConditions.regionId = user.regionId;
      } else {
        whereConditions.userId = user.userId;
      }
    }

    console.log('Starting insights generation...', { categoryId, regionId, page, limit });
    
    // Get total count for pagination
    totalCount = await Promise.race([
      prisma.phenomenon.count({ where: whereConditions }),
      createTimeoutPromise(10000) // 10 second timeout for count query
    ]);
    
    if (totalCount === 0) {
      return NextResponse.json({
        insights: [],
        summary: {
          totalPhenomena: 0,
          avgOverallScore: 0,
          totalCorrelatedNews: 0,
          totalSurveyNotes: 0,
        },
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        },
        message: 'No phenomena found matching the criteria'
      });
    }
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Get phenomena with related data (with pagination)
    phenomena = await Promise.race([
      prisma.phenomenon.findMany({
        where: whereConditions,
        include: {
          category: true,
          region: true,
          user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: phenomenonId ? 1 : limit,
        skip: phenomenonId ? 0 : offset,
      }),
      createTimeoutPromise(15000) // 15 second timeout for main query
    ]);

    if (phenomena.length === 0) {
      return NextResponse.json({
        insights: [],
        message: 'No phenomena found matching the criteria',
      });
    }

    // Generate insights for each phenomenon with circuit breaker
    const maxFailures = Math.min(3, Math.ceil(phenomena.length / 2)); // Allow up to 3 failures or half of phenomena
    
    // Wrap entire processing in timeout
    const processInsights = async () => {
      for (const phenomenon of phenomena) {
        try {
          const combinedText = `${phenomenon.title} ${phenomenon.description}`;
          const phenomenonKeywords = extractKeywords(combinedText);
          const phenomenonSentiment = getSentimentScore(combinedText);

          // Find correlated news based on keywords (with timeout and limits)
          const potentialNews = await Promise.race([
            prisma.scrappingBerita.findMany({
              where: {
                tanggalBerita: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days only for performance
                },
                OR: [
                  {
                    matchedKeywords: {
                      hasSome: phenomenonKeywords,
                    },
                  },
                  {
                    judul: {
                      contains: phenomenon.title.split(' ')[0], // First word of title
                      mode: 'insensitive',
                    },
                  },
                ],
              },
              orderBy: { tanggalBerita: 'desc' },
              take: MAX_NEWS_PER_PHENOMENON, // Reduced from 20 to 10
            }),
            createTimeoutPromise(10000) // 10 second timeout for news query
          ]);

          // Find related survey notes (with timeout and limits)
          const surveyNotes = await Promise.race([
            prisma.catatanSurvei.findMany({
              where: {
                categoryId: phenomenon.categoryId,
                regionId: phenomenon.regionId,
              },
              orderBy: { createdAt: 'desc' },
              take: MAX_SURVEY_NOTES, // Reduced from 10 to 5
            }),
            createTimeoutPromise(8000) // 8 second timeout for survey query
          ]);

          // Calculate correlation for each news item
          const correlatedNews = potentialNews.map(news => {
            const newsKeywords = extractKeywords(`${news.judul} ${news.isi}`);
            const keywordOverlap = calculateKeywordOverlap(phenomenonKeywords, newsKeywords);
            const temporalRelevance = calculateTemporalRelevance(
              phenomenon.createdAt,
              news.tanggalBerita,
              phenomenon.category
            );
            
            const newsSentiment = getSentimentScore(`${news.judul} ${news.isi}`);
            const sentimentMatch = newsSentiment === phenomenonSentiment ? 100 : 
                                  (newsSentiment === 'neutral' || phenomenonSentiment === 'neutral') ? 50 : 0;

            const correlationData: CorrelationData = {
              keywordOverlap,
              temporalRelevance,
              geographicRelevance: 75, // Simplified - could be enhanced with location analysis
              sentimentMatch,
            };

            const relevanceScore = (
              keywordOverlap * 0.4 +
              temporalRelevance * 0.3 +
              correlationData.geographicRelevance * 0.2 +
              sentimentMatch * 0.1
            );

            return {
              id: news.id,
              judul: news.judul,
              portalBerita: news.portalBerita,
              linkBerita: news.linkBerita,
              tanggalBerita: news.tanggalBerita,
              matchedKeywords: news.matchedKeywords,
              correlationData,
              relevanceScore: Math.round(relevanceScore),
            };
          }).filter(news => news.relevanceScore > 20) // Filter out low relevance news
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5); // Top 5 most relevant news

          // Analyze survey notes
          const analyzedSurveyNotes = surveyNotes.map(note => {
            const noteKeywords = extractKeywords(note.catatan);
            const sentiment = getSentimentScore(note.catatan);
            const relevanceScore = calculateKeywordOverlap(phenomenonKeywords, noteKeywords);

            return {
              id: note.id,
              catatan: note.catatan.length > 200 ? note.catatan.substring(0, 200) + '...' : note.catatan,
              sentiment,
              relevanceScore: Math.round(relevanceScore),
            };
          }).filter(note => note.relevanceScore > 10)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5);

          // Extract keywords from news and survey notes
          const allNewsKeywords = correlatedNews.flatMap(news => extractKeywords(`${news.judul}`));
          const allSurveyKeywords = analyzedSurveyNotes.flatMap(note => extractKeywords(note.catatan));

          // Find common and unique keywords
          const newsKeywordSet = new Set(allNewsKeywords);
          const surveyKeywordSet = new Set(allSurveyKeywords);
          const phenomenonKeywordSet = new Set(phenomenonKeywords);

          const commonKeywords = Array.from(phenomenonKeywordSet).filter(k => 
            newsKeywordSet.has(k) || surveyKeywordSet.has(k)
          );
          const uniqueToNews = Array.from(newsKeywordSet).filter(k => 
            !phenomenonKeywordSet.has(k) && !surveyKeywordSet.has(k)
          );
          const uniqueToSurvey = Array.from(surveyKeywordSet).filter(k => 
            !phenomenonKeywordSet.has(k) && !newsKeywordSet.has(k)
          );

          // Calculate sentiment analysis
          const newsSentiments = correlatedNews.map(news => 
            getSentimentScore(`${news.judul} ${news.isi}`)
          );
          const surveySentiments = analyzedSurveyNotes.map(note => note.sentiment);

          const newsSentimentCounts = {
            positive: newsSentiments.filter(s => s === 'positive').length,
            negative: newsSentiments.filter(s => s === 'negative').length,
            neutral: newsSentiments.filter(s => s === 'neutral').length,
          };

          const surveySentimentCounts = {
            positive: surveySentiments.filter(s => s === 'positive').length,
            negative: surveySentiments.filter(s => s === 'negative').length,
            neutral: surveySentiments.filter(s => s === 'neutral').length,
          };

          // Calculate alignment score
          const totalNews = newsSentiments.length || 1;
          const totalSurvey = surveySentiments.length || 1;
          
          const newsPositiveRatio = newsSentimentCounts.positive / totalNews;
          const surveyPositiveRatio = surveySentimentCounts.positive / totalSurvey;
          const newsNegativeRatio = newsSentimentCounts.negative / totalNews;
          const surveyNegativeRatio = surveySentimentCounts.negative / totalSurvey;

          const alignmentScore = Math.round(
            100 - (Math.abs(newsPositiveRatio - surveyPositiveRatio) * 50 + 
                   Math.abs(newsNegativeRatio - surveyNegativeRatio) * 50)
          );

          // Calculate metrics
          const validationStrength = Math.min(100, correlatedNews.length * 20);
          const publicInterest = Math.min(100, correlatedNews.reduce((sum, news) => sum + news.relevanceScore, 0) / 5);
          const sentimentAlignment = alignmentScore;
          const evidenceDiversity = Math.min(100, 
            (new Set(correlatedNews.map(news => news.portalBerita)).size) * 35
          );

          const overallScore = Math.round(
            (validationStrength * 0.3 + publicInterest * 0.25 + sentimentAlignment * 0.25 + evidenceDiversity * 0.2)
          );

          // Generate recommendations
          const recommendations: string[] = [];
          
          if (validationStrength < 40) {
            recommendations.push("Fenomena ini memiliki validasi yang lemah dari media massa. Pertimbangkan untuk mencari sumber tambahan.");
          }
          
          if (sentimentAlignment < 50) {
            recommendations.push("Terdapat perbedaan sentiment yang signifikan antara fenomena dan persepsi publik di media.");
          }
          
          if (correlatedNews.length === 0) {
            recommendations.push("Tidak ditemukan berita terkait. Fenomena ini mungkin belum mendapat perhatian media atau perlu keyword yang lebih spesifik.");
          }
          
          if (overallScore > 75) {
            recommendations.push("Fenomena ini memiliki dukungan yang kuat dari berbagai sumber data dan layak untuk investigasi lebih lanjut.");
          }

          const insight: FenomenaInsight = {
            phenomenonId: phenomenon.id,
            phenomenon: {
              id: phenomenon.id,
              title: phenomenon.title,
              description: phenomenon.description,
              category: { 
                name: phenomenon.category.name,
                startDate: phenomenon.category.startDate, 
                endDate: phenomenon.category.endDate 
              },
              region: { city: phenomenon.region.city, province: phenomenon.region.province },
            },
            metrics: {
              validationStrength: Math.round(validationStrength),
              publicInterest: Math.round(publicInterest),
              sentimentAlignment: Math.round(sentimentAlignment),
              evidenceDiversity: Math.round(evidenceDiversity),
              overallScore,
            },
            correlatedNews,
            surveyNotes: analyzedSurveyNotes,
            keywordAnalysis: {
              phenomenonKeywords: phenomenonKeywords.slice(0, 10),
              newsKeywords: Array.from(new Set(allNewsKeywords)).slice(0, 10),
              surveyKeywords: Array.from(new Set(allSurveyKeywords)).slice(0, 10),
              commonKeywords: commonKeywords.slice(0, 10),
              uniqueToNews: uniqueToNews.slice(0, 5),
              uniqueToSurvey: uniqueToSurvey.slice(0, 5),
            },
            sentimentAnalysis: {
              phenomenonSentiment,
              newsSentiment: newsSentimentCounts,
              surveySentiment: surveySentimentCounts,
              alignmentScore,
            },
            recommendations,
          };

          insights.push(insight);
          
        } catch (error) {
          failedInsights++;
          console.error(`Failed to process phenomenon ${phenomenon.id}:`, error);
          
          // Circuit breaker: if we have too many failures, stop processing
          if (failedInsights >= maxFailures) {
            throw new Error(`CIRCUIT_BREAKER_TRIGGERED: ${failedInsights} failures exceeded maximum of ${maxFailures}`);
          }
        }
      }
    };
    
    // Execute processing with timeout
    await Promise.race([
      processInsights(),
      createTimeoutPromise(ANALYSIS_TIMEOUT)
    ]);

    // Save analysis results to database (with batch error handling)
    let savedInsights = 0;
    for (const insight of insights) {
      try {
        await prisma.analysisResult.create({
          data: {
            analysisType: 'FENOMENA_INSIGHTS',
            results: insight,
            phenomenonId: insight.phenomenonId,
          },
        });
        savedInsights++;
      } catch (error) {
        console.error(`Failed to save insight for phenomenon ${insight.phenomenonId}:`, error);
        // Continue processing other insights even if one fails to save
      }
    }

    return NextResponse.json({
      insights,
      summary: {
        totalPhenomena: insights.length,
        avgOverallScore: insights.length > 0 ? Math.round(
          insights.reduce((sum, i) => sum + i.metrics.overallScore, 0) / insights.length
        ) : 0,
        totalCorrelatedNews: insights.reduce((sum, i) => sum + i.correlatedNews.length, 0),
        totalSurveyNotes: insights.reduce((sum, i) => sum + i.surveyNotes.length, 0),
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      processing: {
        failedInsights,
        processedInsights: insights.length,
        requestedInsights: phenomena.length
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific error types
    if (errorMessage.includes('required')) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'You must be logged in to access this resource'
      }, { status: 403 });
    }
    
    if (errorMessage === 'ANALYSIS_TIMEOUT') {
      return NextResponse.json({ 
        error: 'Analysis timeout',
        details: 'The analysis is taking too long. Please try with fewer phenomena or more specific filters.',
        suggestions: ['Reduce the number of phenomena', 'Apply more specific filters', 'Try again later']
      }, { status: 408 });
    }
    
    if (errorMessage.startsWith('CIRCUIT_BREAKER_TRIGGERED')) {
      return NextResponse.json({ 
        error: 'Processing failed',
        details: 'Multiple phenomena failed to process. Some data may be corrupted or inaccessible.',
        processedInsights: insights?.length || 0,
        suggestions: ['Try processing fewer phenomena at once', 'Check data integrity', 'Contact support']
      }, { status: 206 }); // Partial Content
    }
    
    // Database connection errors
    if (errorMessage.includes('connect') || errorMessage.includes('timeout')) {
      return NextResponse.json({ 
        error: 'Database connection error',
        details: 'Unable to connect to the database. Please try again later.',
        suggestions: ['Try again in a few moments', 'Contact support if the problem persists']
      }, { status: 503 }); // Service Unavailable
    }
    
    // Generic error handling
    console.error('Fenomena insights error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while processing insights.',
      errorId: Date.now().toString(), // For debugging
      suggestions: ['Try again later', 'Contact support with error ID']
    }, { status: 500 });
  }
}