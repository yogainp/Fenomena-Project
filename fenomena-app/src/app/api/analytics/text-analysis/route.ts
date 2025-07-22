import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('Text analysis request by user:', user.userId);

    // Get all phenomena texts for analysis
    const phenomena = await prisma.phenomenon.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

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

    // Analyze all phenomena texts
    let allWords: string[] = [];
    const sentimentAnalysis: { [key: string]: number } = { positive: 0, negative: 0, neutral: 0 };
    const categoryKeywords: { [category: string]: string[] } = {};

    phenomena.forEach(phenomenon => {
      const combinedText = `${phenomenon.title} ${phenomenon.description}`;
      const words = extractKeywords(combinedText);
      
      allWords = allWords.concat(words);
      
      // Sentiment analysis
      const sentiment = getSentimentScore(combinedText);
      sentimentAnalysis[sentiment]++;
      
      // Category-specific keywords
      const categoryName = phenomenon.category.name;
      if (!categoryKeywords[categoryName]) {
        categoryKeywords[categoryName] = [];
      }
      categoryKeywords[categoryName] = categoryKeywords[categoryName].concat(words);
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
    const avgDescriptionLength = phenomena.reduce((sum, p) => sum + p.description.length, 0) / phenomena.length;

    // Word cloud data (top 50 words for visualization)
    const wordCloudData = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([text, value]) => ({ text, value }));

    return NextResponse.json({
      totalPhenomena: phenomena.length,
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
    });

  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Text analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}