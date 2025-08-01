import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    category: { name: string };
    period: { name: string; startDate: Date; endDate: Date };
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

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    const categoryId = searchParams.get('categoryId');
    const periodId = searchParams.get('periodId');
    const regionId = searchParams.get('regionId');
    const phenomenonId = searchParams.get('phenomenonId');

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

    // Get phenomena with related data
    const phenomena = await prisma.phenomenon.findMany({
      where: whereConditions,
      include: {
        category: true,
        period: true,
        region: true,
        user: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: phenomenonId ? 1 : 10, // Limit results if not specific phenomenon
    });

    if (phenomena.length === 0) {
      return NextResponse.json({
        insights: [],
        message: 'No phenomena found matching the criteria',
      });
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
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
    }

    function calculateTemporalRelevance(phenomenonDate: Date, newsDate: Date, surveyPeriod: { startDate: Date; endDate: Date }): number {
      const surveyStart = surveyPeriod.startDate.getTime();
      const surveyEnd = surveyPeriod.endDate.getTime();
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

    // Generate insights for each phenomenon
    const insights: FenomenaInsight[] = [];

    for (const phenomenon of phenomena) {
      const combinedText = `${phenomenon.title} ${phenomenon.description}`;
      const phenomenonKeywords = extractKeywords(combinedText);
      const phenomenonSentiment = getSentimentScore(combinedText);

      // Find correlated news based on keywords
      const potentialNews = await prisma.scrappingBerita.findMany({
        where: {
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
        take: 20,
      });

      // Find related survey notes
      const surveyNotes = await prisma.catatanSurvei.findMany({
        where: {
          categoryId: phenomenon.categoryId,
          periodId: phenomenon.periodId,
          regionId: phenomenon.regionId,
        },
        take: 10,
      });

      // Calculate correlation for each news item
      const correlatedNews = potentialNews.map(news => {
        const newsKeywords = extractKeywords(`${news.judul} ${news.isi}`);
        const keywordOverlap = calculateKeywordOverlap(phenomenonKeywords, newsKeywords);
        const temporalRelevance = calculateTemporalRelevance(
          phenomenon.createdAt,
          news.tanggalBerita,
          phenomenon.period
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

      const commonKeywords = [...phenomenonKeywordSet].filter(k => 
        newsKeywordSet.has(k) || surveyKeywordSet.has(k)
      );
      const uniqueToNews = [...newsKeywordSet].filter(k => 
        !phenomenonKeywordSet.has(k) && !surveyKeywordSet.has(k)
      );
      const uniqueToSurvey = [...surveyKeywordSet].filter(k => 
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
          category: { name: phenomenon.category.name },
          period: { 
            name: phenomenon.period.name, 
            startDate: phenomenon.period.startDate, 
            endDate: phenomenon.period.endDate 
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
          newsKeywords: [...new Set(allNewsKeywords)].slice(0, 10),
          surveyKeywords: [...new Set(allSurveyKeywords)].slice(0, 10),
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
    }

    // Save analysis results to database
    for (const insight of insights) {
      try {
        await prisma.analysisResult.create({
          data: {
            analysisType: 'FENOMENA_INSIGHTS',
            results: insight,
            phenomenonId: insight.phenomenonId,
          },
        });
      } catch (error) {
        console.log('Failed to save insight for phenomenon:', insight.phenomenonId);
      }
    }

    return NextResponse.json({
      insights,
      summary: {
        totalPhenomena: insights.length,
        avgOverallScore: Math.round(
          insights.reduce((sum, i) => sum + i.metrics.overallScore, 0) / insights.length
        ),
        totalCorrelatedNews: insights.reduce((sum, i) => sum + i.correlatedNews.length, 0),
        totalSurveyNotes: insights.reduce((sum, i) => sum + i.surveyNotes.length, 0),
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('required')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }
    console.error('Fenomena insights error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}