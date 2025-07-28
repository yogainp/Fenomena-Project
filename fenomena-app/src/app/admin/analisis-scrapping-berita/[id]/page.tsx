'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { makeAuthenticatedRequest } from '@/lib/client-auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ScrappingBerita {
  id: string;
  idBerita: string;
  portalBerita: string;
  linkBerita: string;
  judul: string;
  isi: string;
  tanggalBerita: string;
  tanggalScrap: string;
  matchedKeywords: string[];
  createdAt: string;
  analysisResults: AnalysisResult[];
}

interface AnalysisResult {
  id: string;
  analysisType: string;
  results: any;
  createdAt: string;
}

interface NewsAnalysisData {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordsPerSentence: number;
  topWords: { word: string; count: number }[];
  keywordDensity: { keyword: string; count: number; density: number }[];
  sentimentScore: {
    positive: number;
    negative: number;
    neutral: number;
  };
  readabilityScore: number;
  contentStructure: {
    introduction: boolean;
    body: boolean;
    conclusion: boolean;
  };
}

export default function AnalisisScrappingBeritaPage() {
  const params = useParams();
  const beritaId = params.id as string;
  
  const [berita, setBerita] = useState<ScrappingBerita | null>(null);
  const [analysisData, setAnalysisData] = useState<NewsAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    if (beritaId) {
      fetchBeritaData();
    }
  }, [beritaId]);

  const fetchBeritaData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await makeAuthenticatedRequest(`/api/admin/scrapping-berita/${beritaId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news data');
      }
      
      const data = await response.json();
      setBerita(data.berita);
      
      // If there's existing analysis, use it
      const existingAnalysis = data.berita.analysisResults.find(
        (result: AnalysisResult) => result.analysisType === 'NEWS_SCRAPING_ANALYSIS'
      );
      
      if (existingAnalysis) {
        setAnalysisData(existingAnalysis.results);
      } else {
        // Automatically trigger analysis for new articles
        performAnalysis(data.berita);
      }
      
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch berita error:', err);
    } finally {
      setLoading(false);
    }
  };

  const performAnalysis = async (beritaData?: ScrappingBerita) => {
    const targetBerita = beritaData || berita;
    if (!targetBerita) return;
    
    try {
      setAnalyzing(true);
      setError('');
      
      // Perform basic text analysis
      const analysis = analyzeNewsContent(targetBerita);
      
      // Save analysis to database
      const response = await makeAuthenticatedRequest('/api/analytics/text-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrappingBeritaId: targetBerita.id,
          analysisType: 'NEWS_SCRAPING_ANALYSIS',
          results: analysis,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save analysis');
      }
      
      setAnalysisData(analysis);
      setSuccessMessage('Analysis completed successfully!');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeNewsContent = (beritaData: ScrappingBerita): NewsAnalysisData => {
    const content = beritaData.isi;
    const title = beritaData.judul;
    const fullText = `${title} ${content}`;
    
    // Basic text statistics
    const words = fullText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Word frequency analysis
    const wordCounts: { [key: string]: number } = {};
    const stopWords = new Set(['dan', 'atau', 'yang', 'di', 'ke', 'dari', 'pada', 'dengan', 'untuk', 'dalam', 'adalah', 'akan', 'telah', 'ini', 'itu', 'tidak', 'juga', 'dapat', 'serta', 'sebagai', 'oleh', 'an', 'the', 'a', 'of', 'to', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will']);
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
      }
    });
    
    const topWords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    
    // Keyword density analysis
    const keywordDensity = beritaData.matchedKeywords.map(keyword => {
      const count = (fullText.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      const density = (count / words.length) * 100;
      return { keyword, count, density: Math.round(density * 100) / 100 };
    });
    
    // Simple sentiment analysis (basic positive/negative word counting)
    const positiveWords = ['baik', 'bagus', 'positif', 'meningkat', 'naik', 'tumbuh', 'berkembang', 'sukses', 'berhasil', 'optimal', 'efektif', 'efisien', 'good', 'great', 'excellent', 'positive', 'increase', 'improve', 'success', 'growth'];
    const negativeWords = ['buruk', 'jelek', 'negatif', 'menurun', 'turun', 'gagal', 'masalah', 'kesulitan', 'krisis', 'bad', 'poor', 'negative', 'decrease', 'problem', 'issue', 'crisis', 'fail'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    const sentimentScore = {
      positive: totalSentimentWords > 0 ? Math.round((positiveCount / totalSentimentWords) * 100) : 0,
      negative: totalSentimentWords > 0 ? Math.round((negativeCount / totalSentimentWords) * 100) : 0,
      neutral: totalSentimentWords > 0 ? Math.round(((totalSentimentWords - positiveCount - negativeCount) / totalSentimentWords) * 100) : 100
    };
    
    // Simple readability score (Flesch-like formula adapted for Indonesian)
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgSyllablesPerWord = 2; // Approximation for Indonesian
    const readabilityScore = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
    ));
    
    // Content structure analysis
    const contentLower = content.toLowerCase();
    const contentStructure = {
      introduction: contentLower.includes('menurut') || contentLower.includes('berdasarkan') || contentLower.includes('dikutip'),
      body: content.length > 200, // Assume body exists if content is substantial
      conclusion: contentLower.includes('dengan demikian') || contentLower.includes('kesimpulan') || contentLower.includes('akhirnya')
    };
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      topWords,
      keywordDensity,
      sentimentScore,
      readabilityScore: Math.round(readabilityScore),
      contentStructure,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/admin/katalog-berita" className="text-blue-600 hover:text-blue-800">
                  ← Back to News Catalog
                </Link>
                <h1 className="ml-4 text-xl font-semibold">News Analysis</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading analysis...</div>
        </div>
      </div>
    );
  }

  if (!berita) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/admin/katalog-berita" className="text-blue-600 hover:text-blue-800">
                  ← Back to News Catalog
                </Link>
                <h1 className="ml-4 text-xl font-semibold">News Analysis</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">News not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin/katalog-berita" className="text-blue-600 hover:text-blue-800">
                ← Back to News Catalog
              </Link>
              <h1 className="ml-4 text-xl font-semibold">News Analysis</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href={berita.linkBerita} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                View Original
              </a>
              {!analyzing && (
                <button
                  onClick={() => performAnalysis()}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Re-analyze
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-4 text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
            <button 
              onClick={() => setSuccessMessage('')}
              className="ml-4 text-green-700 hover:text-green-900"
            >
              ×
            </button>
          </div>
        )}

        {/* News Information */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{berita.judul}</h2>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {berita.portalBerita}
            </span>
            <span>Published: {formatDate(berita.tanggalBerita)}</span>
            <span>Scraped: {formatDate(berita.tanggalScrap)}</span>
          </div>
          
          {berita.matchedKeywords.length > 0 && (
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700 mr-2">Matched Keywords:</span>
              <div className="inline-flex flex-wrap gap-1">
                {berita.matchedKeywords.map((keyword, index) => (
                  <span 
                    key={index}
                    className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="prose max-w-none">
            <p className="text-gray-700 leading-relaxed">{berita.isi}</p>
          </div>
        </div>

        {analyzing && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800 mr-2"></div>
              Analyzing content...
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysisData && (
          <div className="space-y-8">
            {/* Basic Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Word Count</h3>
                <p className="text-3xl font-bold text-blue-600">{analysisData.wordCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sentences</h3>
                <p className="text-3xl font-bold text-green-600">{analysisData.sentenceCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Words/Sentence</h3>
                <p className="text-3xl font-bold text-purple-600">{analysisData.avgWordsPerSentence}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Readability Score</h3>
                <p className="text-3xl font-bold text-orange-600">{analysisData.readabilityScore}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {analysisData.readabilityScore >= 70 ? 'Easy' : 
                   analysisData.readabilityScore >= 50 ? 'Medium' : 'Difficult'}
                </p>
              </div>
            </div>

            {/* Top Words Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Frequent Words</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysisData.topWords}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="word" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Keyword Density and Sentiment Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Keyword Density */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Keyword Density</h3>
                {analysisData.keywordDensity.length > 0 ? (
                  <div className="space-y-3">
                    {analysisData.keywordDensity.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{item.keyword}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{item.count}x</span>
                          <span className="text-sm font-bold text-blue-600">{item.density}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No keywords found in content</p>
                )}
              </div>

              {/* Sentiment Analysis */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Analysis</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Positive', value: analysisData.sentimentScore.positive },
                        { name: 'Neutral', value: analysisData.sentimentScore.neutral },
                        { name: 'Negative', value: analysisData.sentimentScore.negative }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Positive', value: analysisData.sentimentScore.positive },
                        { name: 'Neutral', value: analysisData.sentimentScore.neutral },
                        { name: 'Negative', value: analysisData.sentimentScore.negative }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Content Structure */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Structure Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-3 ${analysisData.contentStructure.introduction ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Introduction/Sources</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-3 ${analysisData.contentStructure.body ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Substantial Body</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-3 ${analysisData.contentStructure.conclusion ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">Conclusion</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}