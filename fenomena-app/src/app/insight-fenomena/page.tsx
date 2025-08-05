'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface InsightMetrics {
  validationStrength: number;
  publicInterest: number;
  sentimentAlignment: number;
  evidenceDiversity: number;
  overallScore: number;
}

interface CorrelatedNews {
  id: string;
  judul: string;
  portalBerita: string;
  linkBerita: string;
  tanggalBerita: string;
  relevanceScore: number;
}

interface SurveyNote {
  id: string;
  catatan: string;
  sentiment: string;
  relevanceScore: number;
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
  correlatedNews: CorrelatedNews[];
  surveyNotes: SurveyNote[];
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

interface InsightSummary {
  totalPhenomena: number;
  avgOverallScore: number;
  totalCorrelatedNews: number;
  totalSurveyNotes: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ProcessingInfo {
  failedInsights: number;
  processedInsights: number;
  requestedInsights: number;
}

export default function InsightFenomenaPage() {
  const [insights, setInsights] = useState<FenomenaInsight[]>([]);
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [processing, setProcessing] = useState<ProcessingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInsight, setSelectedInsight] = useState<FenomenaInsight | null>(null);
  
  // Filter states
  const [categoryId, setCategoryId] = useState('all');
  const [regionId, setRegionId] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  
  // Filter options
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [regions, setRegions] = useState<Array<{ id: string; city: string; province: string }>>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (categoryId !== 'all') params.append('categoryId', categoryId);
      if (regionId !== 'all') params.append('regionId', regionId);
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      
      const response = await fetch(`/api/analytics/fenomena-insights?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to fetch insights');
      }
      
      const data = await response.json();
      setInsights(data.insights || []);
      setSummary(data.summary || null);
      setPagination(data.pagination || null);
      setProcessing(data.processing || null);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Fetch insights error:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryId, regionId, currentPage, pageSize]);

  const fetchFilterOptions = async () => {
    try {
      setFiltersLoading(true);
      const [categoriesRes, regionsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/regions'),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        console.log('Categories data:', categoriesData);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } else {
        console.error('Failed to fetch categories:', categoriesRes.status, categoriesRes.statusText);
        setCategories([]);
      }

      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        console.log('Regions data:', regionsData);
        // API regions return array directly, not nested in 'regions' property
        setRegions(Array.isArray(regionsData) ? regionsData : []);
      } else {
        console.error('Failed to fetch regions:', regionsRes.status, regionsRes.statusText);
        setRegions([]);
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
      setCategories([]);
      setRegions([]);
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [categoryId, regionId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold text-blue-600 hover:text-blue-800">
                ← Kembali ke Dashboard
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Insight Fenomena</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">AI-Powered Insight Fenomena</h1>
            <p className="mt-2 text-sm text-gray-600">
              Analisis mendalam fenomena berdasarkan korelasi data survei, catatan responden, dan berita media massa
            </p>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Fenomena</h3>
                <p className="text-2xl font-bold text-gray-900">{summary.totalPhenomena}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Rata-rata Skor</h3>
                <p className={`text-2xl font-bold ${getScoreColor(summary.avgOverallScore).split(' ')[0]}`}>
                  {summary.avgOverallScore}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Berita Berkorelasi</h3>
                <p className="text-2xl font-bold text-blue-600">{summary.totalCorrelatedNews}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Catatan Survei</h3>
                <p className="text-2xl font-bold text-purple-600">{summary.totalSurveyNotes}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Analisis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori Survei
                  </label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={filtersLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="all">{filtersLoading ? 'Loading...' : 'Semua Kategori'}</option>
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    ) : (
                      !filtersLoading && <option disabled>No categories available</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                    Wilayah
                  </label>
                  <select
                    id="region"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    disabled={filtersLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="all">{filtersLoading ? 'Loading...' : 'Semua Wilayah'}</option>
                    {regions.length > 0 ? (
                      regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.city}, {region.province}
                        </option>
                      ))
                    ) : (
                      !filtersLoading && <option disabled>No regions available</option>
                    )}
                  </select>
                </div>
              </div>
              
              {/* Page Size Control - Separated with more margin */}
              <div className="mt-6 max-w-xs">
                <label htmlFor="pageSize" className="block text-sm font-medium text-gray-700 mb-1">
                  Items per Page
                </label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1); // Reset to first page
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 per halaman</option>
                  <option value={5}>5 per halaman</option>
                  <option value={10}>10 per halaman</option>
                </select>
              </div>
            </div>
            
            {/* Processing Info */}
            {processing && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex justify-between text-sm text-blue-800">
                  <span>Processed: {processing.processedInsights}/{processing.requestedInsights}</span>
                  {processing.failedInsights > 0 && (
                    <span className="text-red-600">Failed: {processing.failedInsights}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-6 py-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} phenomena
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">
                      {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(pagination.totalPages)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="text-lg text-gray-600">Menganalisis insights...</div>
              <div className="text-sm text-gray-500 mt-2">Sedang memproses korelasi multi-source data</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <p>Error: {error}</p>
            </div>
          )}

          {/* Insights Results */}
          {!loading && !error && insights.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Tidak ada fenomena yang ditemukan untuk kriteria yang dipilih.</p>
            </div>
          )}

          {!loading && !error && insights.length > 0 && (
            <div className="space-y-6">
              {insights.map((insight) => (
                <div key={insight.phenomenonId} className="bg-white rounded-lg shadow">
                  {/* Main Insight Card */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{insight.phenomenon.title}</h3>
                        <p className="text-gray-600 mb-3">{insight.phenomenon.description}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {insight.phenomenon.category.name}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            {insight.phenomenon.region.city}, {insight.phenomenon.region.province}
                          </span>
                        </div>
                      </div>
                      
                      <div className="ml-6">
                        <div className={`px-4 py-2 rounded-lg text-center ${getScoreColor(insight.metrics.overallScore)}`}>
                          <div className="text-2xl font-bold">{insight.metrics.overallScore}</div>
                          <div className="text-xs">Overall Score</div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className={`text-lg font-bold ${getScoreColor(insight.metrics.validationStrength).split(' ')[0]}`}>
                          {insight.metrics.validationStrength}
                        </div>
                        <div className="text-xs text-gray-600">Validasi Media</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className={`text-lg font-bold ${getScoreColor(insight.metrics.publicInterest).split(' ')[0]}`}>
                          {insight.metrics.publicInterest}
                        </div>
                        <div className="text-xs text-gray-600">Minat Publik</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className={`text-lg font-bold ${getScoreColor(insight.metrics.sentimentAlignment).split(' ')[0]}`}>
                          {insight.metrics.sentimentAlignment}
                        </div>
                        <div className="text-xs text-gray-600">Keselarasan Sentiment</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className={`text-lg font-bold ${getScoreColor(insight.metrics.evidenceDiversity).split(' ')[0]}`}>
                          {insight.metrics.evidenceDiversity}
                        </div>
                        <div className="text-xs text-gray-600">Diversitas Bukti</div>
                      </div>
                    </div>

                    {/* Collapsible Details */}
                    <div className="border-t pt-4">
                      <button
                        onClick={() => setSelectedInsight(selectedInsight?.phenomenonId === insight.phenomenonId ? null : insight)}
                        className="w-full text-left font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
                      >
                        {selectedInsight?.phenomenonId === insight.phenomenonId ? '▼ Sembunyikan Detail' : '▶ Lihat Detail Analisis'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedInsight?.phenomenonId === insight.phenomenonId && (
                    <div className="border-t bg-gray-50">
                      <div className="p-6 space-y-6">
                        {/* Correlated News */}
                        {insight.correlatedNews.length > 0 && (
                          <div>
                            <h4 className="font-bold text-gray-900 mb-3">Berita Berkorelasi ({insight.correlatedNews.length})</h4>
                            <div className="space-y-3">
                              {insight.correlatedNews.map((news) => (
                                <div key={news.id} className="bg-white p-4 rounded border">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-900 mb-1">
                                        <a href={news.linkBerita} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                          {news.judul}
                                        </a>
                                      </h5>
                                      <p className="text-sm text-gray-600">
                                        {news.portalBerita} • {formatDate(news.tanggalBerita)}
                                      </p>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(news.relevanceScore)}`}>
                                      {news.relevanceScore}%
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Survey Notes */}
                        {insight.surveyNotes.length > 0 && (
                          <div>
                            <h4 className="font-bold text-gray-900 mb-3">Catatan Survei Terkait ({insight.surveyNotes.length})</h4>
                            <div className="space-y-3">
                              {insight.surveyNotes.map((note) => (
                                <div key={note.id} className="bg-white p-4 rounded border">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(note.sentiment)}`}>
                                      {note.sentiment}
                                    </span>
                                    <div className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(note.relevanceScore)}`}>
                                      {note.relevanceScore}%
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-700">{note.catatan}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Keywords Analysis */}
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3">Analisis Keyword</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded border">
                              <h5 className="font-medium text-gray-900 mb-2">Keyword Umum</h5>
                              <div className="flex flex-wrap gap-1">
                                {insight.keywordAnalysis.commonKeywords.map((keyword, index) => (
                                  <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded border">
                              <h5 className="font-medium text-gray-900 mb-2">Unik di Berita</h5>
                              <div className="flex flex-wrap gap-1">
                                {insight.keywordAnalysis.uniqueToNews.map((keyword, index) => (
                                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recommendations */}
                        {insight.recommendations.length > 0 && (
                          <div>
                            <h4 className="font-bold text-gray-900 mb-3">Rekomendasi</h4>
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                              <ul className="space-y-2">
                                {insight.recommendations.map((rec, index) => (
                                  <li key={index} className="text-sm text-yellow-800 flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}