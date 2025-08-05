'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface NewsOverviewData {
  overview: {
    totalBerita: number;
    todayBerita: number;
    totalPortals: number;
    totalActiveKeywords: number;
    totalKeywords: number;
    keywordEffectiveness: number;
    avgArticlesPerDay: number;
  };
  portalAnalysis: Array<{
    portalName: string;
    count: number;
  }>;
  dailyTrend: Array<{
    date: string;
    count: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    judul: string;
    portalBerita: string;
    tanggalBerita: string;
    matchedKeywords: string[];
  }>;
}

interface NewsTextAnalysisData {
  totalBerita: number;
  topKeywords: Array<{
    word: string;
    count: number;
  }>;
  sentimentAnalysis: Array<{
    name: string;
    value: number;
  }>;
  portalAnalysis: { [portal: string]: Array<{ word: string; count: number }> };
  avgContentLength: number;
  wordCloudData: Array<{
    text: string;
    value: number;
  }>;
  totalUniqueWords: number;
  proximityAnalysis: { 
    [keyword: string]: { 
      keyword: string; 
      occurrences: number; 
      topProximityWords: Array<{ word: string; count: number }> 
    } 
  };
  filterInfo: {
    portalBerita: string;
    keyword: string;
    startDate: string;
    endDate: string;
    isFiltered: boolean;
  };
}

export default function AnalisisBeritaPage() {
  const [overviewData, setOverviewData] = useState<NewsOverviewData | null>(null);
  const [textAnalysisData, setTextAnalysisData] = useState<NewsTextAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'text' | 'trends'>('overview');
  
  // Filter states for text analysis
  const [selectedPortal, setSelectedPortal] = useState<string>('all');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');
  const [textAnalysisLoading, setTextAnalysisLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTextAnalysis = async (portalBerita: string = 'all', keyword: string = '', startDate: string = '', endDate: string = '') => {
    try {
      setTextAnalysisLoading(true);
      const params = new URLSearchParams();
      if (portalBerita !== 'all') params.append('portalBerita', portalBerita);
      if (keyword) params.append('keyword', keyword);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const url = `/api/analisis-berita/text-analysis${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const result = await response.json();
        setTextAnalysisData(result);
      } else {
        const errorData = await response.json();
        console.error('News text analysis API error:', errorData);
        setError('Failed to load news text analysis data');
      }
    } catch (err) {
      console.error('News text analysis fetch error:', err);
      setError('Network error loading news text analysis.');
    } finally {
      setTextAnalysisLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [overviewRes, textAnalysisRes] = await Promise.all([
        fetch('/api/analisis-berita/overview'),
        fetch('/api/analisis-berita/text-analysis'),
      ]);

      if (overviewRes.ok) {
        const result = await overviewRes.json();
        setOverviewData(result);
      } else {
        const errorData = await overviewRes.json();
        console.error('News overview API error:', errorData);
      }

      if (textAnalysisRes.ok) {
        const result = await textAnalysisRes.json();
        setTextAnalysisData(result);
      } else {
        const errorData = await textAnalysisRes.json();
        console.error('News text analysis API error:', errorData);
      }

      if (!overviewRes.ok && !textAnalysisRes.ok) {
        setError('Failed to load news analysis data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePortalChange = (portalBerita: string) => {
    setSelectedPortal(portalBerita);
    fetchTextAnalysis(portalBerita, selectedKeyword, selectedStartDate, selectedEndDate);
  };

  const handleKeywordChange = (keyword: string) => {
    setSelectedKeyword(keyword);
    fetchTextAnalysis(selectedPortal, keyword, selectedStartDate, selectedEndDate);
  };

  const handleStartDateChange = (startDate: string) => {
    setSelectedStartDate(startDate);
    fetchTextAnalysis(selectedPortal, selectedKeyword, startDate, selectedEndDate);
  };

  const handleEndDateChange = (endDate: string) => {
    setSelectedEndDate(endDate);
    fetchTextAnalysis(selectedPortal, selectedKeyword, selectedStartDate, endDate);
  };

  const resetFilters = () => {
    setSelectedPortal('all');
    setSelectedKeyword('');
    setSelectedStartDate('');
    setSelectedEndDate('');
    fetchTextAnalysis('all', '', '', '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Analisis Berita Hasil Scraping</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading news analysis...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Analisis Berita Hasil Scraping</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={fetchData}
              className="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!overviewData && !textAnalysisData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Analisis Berita Hasil Scraping</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">No news data available</div>
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
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Analisis Berita Hasil Scraping</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/scrapping-berita"
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Scraping Control
              </Link>
              <Link 
                href="/katalog-berita"
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Katalog Berita
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Statistik Umum
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'text'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📝 Analisis Teks
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'trends'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📈 Tren & Pola
              </button>
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && overviewData && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">
                  {overviewData.overview?.totalBerita || 0}
                </div>
                <div className="text-gray-600">Total Berita</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">
                  {overviewData.overview?.todayBerita || 0}
                </div>
                <div className="text-gray-600">Berita Hari Ini</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">
                  {overviewData.overview?.totalPortals || 0}
                </div>
                <div className="text-gray-600">Portal Berita</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-red-600">
                  {overviewData.overview?.totalActiveKeywords || 0}/{overviewData.overview?.totalKeywords || 0}
                </div>
                <div className="text-gray-600">Keywords Aktif</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">
                  {overviewData.overview?.keywordEffectiveness || 0}%
                </div>
                <div className="text-gray-600">Efektivitas Keyword</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-cyan-600">
                  {overviewData.overview?.avgArticlesPerDay || 0}
                </div>
                <div className="text-gray-600">Rata-rata/Hari</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-indigo-600">
                  {overviewData.topKeywords?.length || 0}
                </div>
                <div className="text-gray-600">Top Keywords</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
              {/* Portal Distribution */}
              {overviewData.portalAnalysis && overviewData.portalAnalysis.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Distribusi Berita per Portal</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={overviewData.portalAnalysis}
                        dataKey="count"
                        nameKey="portalName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label={({ portalName, percent }) => `${portalName}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {overviewData.portalAnalysis.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily Trend */}
              {overviewData.dailyTrend && overviewData.dailyTrend.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Trend Berita Harian (30 Hari Terakhir)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={overviewData.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#0088FE" 
                        fill="#0088FE" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Keywords */}
              {overviewData.topKeywords && overviewData.topKeywords.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Top Keywords (Match Count)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={overviewData.topKeywords.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="keyword" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#FFBB28" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {overviewData.recentActivity && overviewData.recentActivity.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-lg font-semibold mb-4">Berita Terbaru (Berdasarkan Tanggal Publish)</h3>
                <div className="space-y-4">
                  {overviewData.recentActivity.map((item) => (
                    <div key={item.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <h4 className="text-sm font-medium text-gray-900 mb-1">
                        {item.judul.length > 80 ? `${item.judul.substring(0, 80)}...` : item.judul}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">
                        {item.portalBerita} • {new Date(item.tanggalBerita).toLocaleDateString('id-ID')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.matchedKeywords.slice(0, 5).map((keyword, index) => (
                          <span 
                            key={index}
                            className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                        {item.matchedKeywords.length > 5 && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            +{item.matchedKeywords.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Analysis Tab */}
        {activeTab === 'text' && textAnalysisData && overviewData && (
          <div className="space-y-6">
            {/* Filter Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">Filter Portal:</label>
                    <select
                      value={selectedPortal}
                      onChange={(e) => handlePortalChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Portal</option>
                      {overviewData.portalAnalysis?.map((portal) => (
                        <option key={portal.portalName} value={portal.portalName}>
                          {portal.portalName} ({portal.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">Filter Keyword:</label>
                    <input
                      type="text"
                      value={selectedKeyword}
                      onChange={(e) => handleKeywordChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      placeholder="Masukkan keyword..."
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">Tanggal Mulai:</label>
                    <input
                      type="date"
                      value={selectedStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">Tanggal Selesai:</label>
                    <input
                      type="date"
                      value={selectedEndDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedPortal !== 'all' || selectedKeyword !== '' || selectedStartDate !== '' || selectedEndDate !== '') && (
                    <button
                      onClick={resetFilters}
                      disabled={textAnalysisLoading}
                      className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                    >
                      Reset Filter
                    </button>
                  )}
                  {textAnalysisLoading && (
                    <div className="text-sm text-blue-600">Loading...</div>
                  )}
                  {textAnalysisData.filterInfo?.isFiltered && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Data Terfilter
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Text Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">
                  {textAnalysisData.totalBerita}
                </div>
                <div className="text-gray-600">
                  {textAnalysisData.filterInfo?.isFiltered ? 'Berita Terfilter' : 'Total Berita'}
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">
                  {textAnalysisData.totalUniqueWords}
                </div>
                <div className="text-gray-600">Kata Unik</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">
                  {textAnalysisData.avgContentLength}
                </div>
                <div className="text-gray-600">Rata-rata Panjang Artikel</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">
                  {textAnalysisData.topKeywords.length}
                </div>
                <div className="text-gray-600">Kata Kunci Teridentifikasi</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Keywords */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Kata Kunci Paling Sering</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={textAnalysisData.topKeywords.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="word" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sentiment Analysis */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Analisis Sentimen Berita</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={textAnalysisData.sentimentAnalysis}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {textAnalysisData.sentimentAnalysis.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.name === 'Positif' ? '#00C49F' :
                            entry.name === 'Negatif' ? '#FF8042' : 
                            '#FFBB28'
                          } 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Portal Keywords */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Kata Kunci per Portal Berita</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(textAnalysisData.portalAnalysis).map(([portal, keywords]) => (
                  <div key={portal} className="border border-gray-200 rounded p-4">
                    <h4 className="font-medium mb-3 text-blue-600">{portal}</h4>
                    <div className="space-y-2">
                      {keywords.slice(0, 8).map((keyword, index) => (
                        <div key={keyword.word} className="flex justify-between items-center">
                          <span className="text-sm">{keyword.word}</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {keyword.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proximity Analysis */}
            {textAnalysisData.proximityAnalysis && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">🔍 Analisis Kata Berdekatan</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Analisis kata-kata yang sering muncul di sekitar kata kunci penting dalam berita
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(textAnalysisData.proximityAnalysis)
                    .filter(([_, data]) => data.occurrences > 0)
                    .map(([keyword, data]) => (
                    <div key={keyword} className="border border-gray-200 rounded p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-blue-600 capitalize">{keyword}</h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {data.occurrences} kali
                        </span>
                      </div>
                      {data.topProximityWords.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 mb-2">Kata-kata berdekatan:</div>
                          {data.topProximityWords.slice(0, 6).map((word, index) => (
                            <div key={word.word} className="flex justify-between items-center">
                              <span className="text-sm">{word.word}</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {word.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">Tidak ada kata berdekatan ditemukan</div>
                      )}
                    </div>
                  ))}
                </div>
                {Object.values(textAnalysisData.proximityAnalysis).every(data => data.occurrences === 0) && (
                  <div className="text-center text-gray-500 py-8">
                    Tidak ditemukan kata kunci penting dalam data berita yang terfilter
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          overviewData ? (
          <div className="space-y-6">
            {overviewData.dailyTrend && overviewData.dailyTrend.length > 0 ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Tren Berita Harian (Berdasarkan Tanggal Publish)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={overviewData.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={{ fill: '#8884d8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Tren Berita Harian (Berdasarkan Tanggal Publish)</h3>
                <div className="text-center text-gray-500 py-12">
                  Tidak ada data trend tersedia
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Performa Portal Berita</h3>
                <div className="space-y-4">
                  {overviewData.portalAnalysis?.slice(0, 5).map((portal, index) => (
                    <div key={portal.portalName} className="p-4 bg-blue-50 rounded">
                      <h4 className="font-medium text-blue-800">#{index + 1} {portal.portalName}</h4>
                      <p className="text-sm text-blue-600 mt-1">
                        {portal.count} artikel berhasil di-scraping
                      </p>
                      <div className="mt-2 bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ 
                            width: `${(portal.count / Math.max(...(overviewData.portalAnalysis?.map(p => p.count) || [1]))) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Insights & Rekomendasi</h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">🎯 Optimasi Keywords</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Keyword dengan efektivitas {overviewData.overview?.keywordEffectiveness}% - 
                      {overviewData.overview?.keywordEffectiveness && overviewData.overview.keywordEffectiveness < 70 ? 
                        ' pertimbangkan untuk menambah atau mengoptimalkan keywords' : 
                        ' performa baik, pertahankan keywords aktif'
                      }
                    </p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">📈 Volume Scraping</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Rata-rata {overviewData.overview?.avgArticlesPerDay} artikel per hari - 
                      {overviewData.overview?.avgArticlesPerDay && overviewData.overview.avgArticlesPerDay < 10 ? 
                        ' volume rendah, pertimbangkan tambah portal atau keywords' :
                        ' volume stabil untuk monitoring trend'
                      }
                    </p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-medium">⚡ Diversifikasi Portal</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {overviewData.overview?.totalPortals} portal aktif - 
                      {overviewData.overview?.totalPortals && overviewData.overview.totalPortals < 3 ? 
                        ' pertimbangkan menambah portal untuk coverage yang lebih luas' :
                        ' diversifikasi baik untuk analisis komprehensif'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <div className="text-gray-500">
                {loading ? 'Loading trend data...' : 'No trend data available'}
              </div>
              {!loading && (
                <button 
                  onClick={fetchData}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Retry Loading Data
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}