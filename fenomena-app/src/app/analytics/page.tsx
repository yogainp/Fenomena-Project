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
  Area
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface TextAnalysisData {
  totalPhenomena: number;
  topKeywords: Array<{
    word: string;
    count: number;
  }>;
  sentimentAnalysis: Array<{
    name: string;
    value: number;
  }>;
  categoryAnalysis: { [category: string]: Array<{ word: string; count: number }> };
  avgDescriptionLength: number;
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
    categoryId: string;
    regionId: string;
    startDate: string;
    endDate: string;
    isFiltered: boolean;
  };
  proximityKeywordsInfo?: {
    defaultKeywords: string[];
    customKeywords: string[];
    totalKeywords: string[];
    hasCustomKeywords: boolean;
  };
}

export default function AnalyticsPage() {
  const [overviewData, setOverviewData] = useState<any>(null);
  const [textAnalysisData, setTextAnalysisData] = useState<TextAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'text' | 'trends'>('overview');
  
  // Filter states for text analysis
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [customKeywords, setCustomKeywords] = useState<string>('');
  const [textAnalysisLoading, setTextAnalysisLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTextAnalysis = async (categoryId: string = 'all', startDate: string = '', endDate: string = '', regionId: string = 'all', keywords: string = '') => {
    try {
      setTextAnalysisLoading(true);
      const params = new URLSearchParams();
      if (categoryId !== 'all') params.append('categoryId', categoryId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (regionId !== 'all') params.append('regionId', regionId);
      if (keywords.trim()) params.append('customKeywords', keywords.trim());
      
      const url = `/api/analytics/text-analysis${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const result = await response.json();
        setTextAnalysisData(result);
      } else {
        const errorData = await response.json();
        console.error('Text analysis API error:', errorData);
        setError('Failed to load text analysis data');
      }
    } catch (err) {
      console.error('Text analysis fetch error:', err);
      setError('Network error loading text analysis.');
    } finally {
      setTextAnalysisLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [overviewRes, textAnalysisRes] = await Promise.all([
        fetch('/api/analytics/simple-overview'),
        fetch('/api/analytics/text-analysis'),
      ]);

      if (overviewRes.ok) {
        const result = await overviewRes.json();
        setOverviewData(result);
      } else {
        const errorData = await overviewRes.json();
        console.error('Overview API error:', errorData);
      }

      if (textAnalysisRes.ok) {
        const result = await textAnalysisRes.json();
        setTextAnalysisData(result);
      } else {
        const errorData = await textAnalysisRes.json();
        console.error('Text analysis API error:', errorData);
      }

      if (!overviewRes.ok && !textAnalysisRes.ok) {
        setError('Failed to load analytics data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    fetchTextAnalysis(categoryId, selectedStartDate, selectedEndDate, selectedRegion, customKeywords);
  };

  const handleStartDateChange = (startDate: string) => {
    setSelectedStartDate(startDate);
    fetchTextAnalysis(selectedCategory, startDate, selectedEndDate, selectedRegion, customKeywords);
  };

  const handleEndDateChange = (endDate: string) => {
    setSelectedEndDate(endDate);
    fetchTextAnalysis(selectedCategory, selectedStartDate, endDate, selectedRegion, customKeywords);
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    fetchTextAnalysis(selectedCategory, selectedStartDate, selectedEndDate, regionId, customKeywords);
  };

  const handleCustomKeywordsChange = (keywords: string) => {
    setCustomKeywords(keywords);
    // Debounced call or manual trigger to avoid too many API calls
  };

  const handleApplyCustomKeywords = () => {
    fetchTextAnalysis(selectedCategory, selectedStartDate, selectedEndDate, selectedRegion, customKeywords);
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedStartDate('');
    setSelectedEndDate('');
    setSelectedRegion('all');
    setCustomKeywords('');
    fetchTextAnalysis('all', '', '', 'all', '');
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
                <h1 className="ml-4 text-xl font-semibold">Analisis & Visualisasi Fenomena</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading analytics...</div>
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
                <h1 className="ml-4 text-xl font-semibold">Analisis & Visualisasi Fenomena</h1>
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
                <h1 className="ml-4 text-xl font-semibold">Analisis & Visualisasi Fenomena</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">No data available</div>
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
              <h1 className="ml-4 text-xl font-semibold">Analisis & Visualisasi Fenomena</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {overviewData.overview?.totalPhenomena || 0}
            </div>
            <div className="text-gray-600">Total Fenomena</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {overviewData.overview?.totalCategories || 0}
            </div>
            <div className="text-gray-600">Kategori Survei</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {overviewData.overview?.totalPeriods || 0}
            </div>
            <div className="text-gray-600">Periode Survei</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {overviewData.overview?.totalRegions || 0}
            </div>
            <div className="text-gray-600">Total Wilayah</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">
              {overviewData.overview?.totalUsers || 0}
            </div>
            <div className="text-gray-600">Total Pengguna</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          {/* Category Distribution */}
          {overviewData.categoryAnalysis && Array.isArray(overviewData.categoryAnalysis) && overviewData.categoryAnalysis.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Distribusi Fenomena per Kategori</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overviewData.categoryAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Period Distribution */}
          {overviewData.periodAnalysis && Array.isArray(overviewData.periodAnalysis) && overviewData.periodAnalysis.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Distribusi Fenomena per Periode</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overviewData.periodAnalysis}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {overviewData.periodAnalysis && Array.isArray(overviewData.periodAnalysis) ? overviewData.periodAnalysis.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    )) : []}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Region Distribution */}
          {overviewData.regionAnalysis && Array.isArray(overviewData.regionAnalysis) && overviewData.regionAnalysis.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Distribusi Fenomena per Wilayah</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overviewData.regionAnalysis.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="city" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* User Contributions */}
        {overviewData.userContributions && Array.isArray(overviewData.userContributions) && overviewData.userContributions.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Top Kontributor Fenomena</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overviewData.userContributions} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="username" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Trend */}
        {overviewData.monthlyTrend && Array.isArray(overviewData.monthlyTrend) && overviewData.monthlyTrend.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Trend Fenomena per Bulan</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overviewData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Debug Info */}
        <div className="bg-gray-100 p-4 rounded-lg text-xs">
          <details>
            <summary>Debug Info (click to expand)</summary>
            <pre className="mt-2">{JSON.stringify(overviewData, null, 2)}</pre>
          </details>
        </div>
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
                    <label className="text-sm font-medium text-gray-700 mb-2">Filter Kategori:</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Kategori</option>
                      {overviewData.categoryAnalysis?.map((category: any) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.name} ({category.count})
                        </option>
                      ))}
                    </select>
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
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">Filter Wilayah:</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      disabled={textAnalysisLoading}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Wilayah</option>
                      {overviewData.regionAnalysis?.map((region: any) => (
                        <option key={region.regionId} value={region.regionId}>
                          {region.city}, {region.province} ({region.count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedCategory !== 'all' || selectedStartDate !== '' || selectedEndDate !== '' || selectedRegion !== 'all' || customKeywords !== '') && (
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
                  {textAnalysisData.totalPhenomena}
                </div>
                <div className="text-gray-600">
                  {textAnalysisData.filterInfo?.isFiltered ? 'Fenomena Terfilter' : 'Total Fenomena'}
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
                  {textAnalysisData.avgDescriptionLength}
                </div>
                <div className="text-gray-600">Rata-rata Panjang Deskripsi</div>
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
                <h3 className="text-lg font-semibold mb-4">Analisis Sentimen Fenomena</h3>
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

            {/* Category Keywords */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Kata Kunci per Kategori Survei</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(textAnalysisData.categoryAnalysis).map(([category, keywords]) => (
                  <div key={category} className="border border-gray-200 rounded p-4">
                    <h4 className="font-medium mb-3 text-blue-600">{category}</h4>
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
                
                {/* Custom Keywords Input */}
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        🔍 Kata Kunci Kustom untuk Analisis Berdekatan:
                      </label>
                      <input
                        type="text"
                        value={customKeywords}
                        onChange={(e) => handleCustomKeywordsChange(e.target.value)}
                        disabled={textAnalysisLoading}
                        placeholder="Masukkan kata kunci dipisah koma, contoh: infrastruktur, pembangunan, teknologi"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Kata kunci akan digabung dengan kata default: peningkatan, penurunan, naik, turun, tumbuh
                      </p>
                    </div>
                    <button
                      onClick={handleApplyCustomKeywords}
                      disabled={textAnalysisLoading}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-6">
                  <p className="mb-2">
                    Analisis kata-kata yang sering muncul di sekitar kata kunci yang dipilih:
                  </p>
                  {textAnalysisData.proximityKeywordsInfo && (
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="font-medium">Kata Default:</span>
                        {textAnalysisData.proximityKeywordsInfo.defaultKeywords.map((keyword: string, index: number) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      {textAnalysisData.proximityKeywordsInfo.hasCustomKeywords && (
                        <div className="flex flex-wrap gap-1">
                          <span className="font-medium">Kata Kustom:</span>
                          {textAnalysisData.proximityKeywordsInfo.customKeywords.map((keyword: string, index: number) => (
                            <span key={index} className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                          {data.topProximityWords.slice(0, 8).map((word, index) => (
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
                    Tidak ditemukan kata kunci perubahan dalam data fenomena
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
            {overviewData.monthlyTrend && Array.isArray(overviewData.monthlyTrend) && overviewData.monthlyTrend.length > 0 ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Tren Fenomena Bulanan</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={overviewData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Tren Fenomena Bulanan</h3>
                <div className="text-center text-gray-500 py-12">
                  Tidak ada data trend tersedia
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Prediksi Tren</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded">
                    <h4 className="font-medium text-blue-800">Kategori Berkembang</h4>
                    <p className="text-sm text-blue-600 mt-1">
                      {overviewData.categoryAnalysis ? [...overviewData.categoryAnalysis].sort((a: any, b: any) => b.count - a.count)[0]?.name || 'N/A' : 'N/A'} 
                      menunjukkan fenomena paling banyak
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded">
                    <h4 className="font-medium text-green-800">Periode Aktif</h4>
                    <p className="text-sm text-green-600 mt-1">
                      {overviewData.periodAnalysis ? [...overviewData.periodAnalysis].sort((a: any, b: any) => b.count - a.count)[0]?.name || 'N/A' : 'N/A'} 
                      periode dengan aktivitas tertinggi
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded">
                    <h4 className="font-medium text-purple-800">User Engagement</h4>
                    <p className="text-sm text-purple-600 mt-1">
                      {overviewData.userContributions?.length || 0} pengguna aktif berkontribusi
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Insights & Rekomendasi</h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">🎯 Fokus Analisis</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Perbanyak analisis pada kategori survei yang menunjukkan fenomena kompleks
                    </p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">📈 Potensi Eksplorasi</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Kembangkan analisis lintas kategori untuk menemukan pola tersembunyi
                    </p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-medium">⚡ Optimalisasi</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Tingkatkan partisipasi user dalam input fenomena untuk data yang lebih kaya
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