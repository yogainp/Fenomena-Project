'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalysisData {
  totalCatatanSurvei: number;
  topKeywords: { word: string; count: number }[];
  sentimentAnalysis: { name: string; value: number }[];
  categoryAnalysis: { [category: string]: { word: string; count: number }[] };
  regionAnalysis: { [region: string]: { word: string; count: number }[] };
  avgNoteLength: number;
  wordCloudData: { text: string; value: number }[];
  totalUniqueWords: number;
  proximityAnalysis: { [keyword: string]: { keyword: string; occurrences: number; topProximityWords: { word: string; count: number }[] } };
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

interface Category {
  id: string;
  name: string;
}

interface Region {
  id: string;
  province: string;
  city: string;
  regionCode: string;
}


export default function AnalisisCatatanSurveiPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: 'all',
    regionId: 'all',
    startDate: '',
    endDate: '',
  });
  const [customKeywords, setCustomKeywords] = useState<string>('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (initialDataLoaded) {
      fetchAnalysisData();
    }
  }, [filters, initialDataLoaded]);

  const fetchInitialData = async () => {
    try {
      const [categoriesRes, regionsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/regions'),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        setRegions(regionsData);
      }


      // Mark initial data as loaded and fetch analysis data
      setInitialDataLoaded(true);
    } catch (error) {
      setError('Failed to load initial data');
      setLoading(false);
    }
  };

  const fetchAnalysisData = async (keywords: string = customKeywords) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      if (filters.regionId !== 'all') params.append('regionId', filters.regionId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (keywords.trim()) params.append('customKeywords', keywords.trim());
      
      const response = await fetch(`/api/analytics/catatan-survei?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load analysis data');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomKeywords = () => {
    fetchAnalysisData(customKeywords);
  };

  const resetFilters = () => {
    setFilters({
      categoryId: 'all',
      regionId: 'all',
      startDate: '',
      endDate: '',
    });
    setCustomKeywords('');
    fetchAnalysisData('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg">Menganalisis data catatan survei...</div>
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
                  ← Kembali
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Analisis Teks Catatan Survei</h1>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="max-w-4xl mx-auto py-12 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-red-600 text-lg mb-4">{error}</div>
            <button
              onClick={fetchAnalysisData}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Coba Lagi
            </button>
          </div>
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
                ← Kembali
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Analisis Teks Catatan Survei</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filter Analisis</h2>
            {analysisData?.filterInfo.isFiltered && (
              <button
                onClick={resetFilters}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Reset Filter
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Survei
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wilayah
              </label>
              <select
                value={filters.regionId}
                onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Wilayah</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.city} - {region.province}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {analysisData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Catatan</h3>
                <p className="text-2xl font-bold text-blue-600">{analysisData.totalCatatanSurvei.toLocaleString()}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Kata Unik</h3>
                <p className="text-2xl font-bold text-green-600">{analysisData.totalUniqueWords.toLocaleString()}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Rata-rata Panjang</h3>
                <p className="text-2xl font-bold text-purple-600">{analysisData.avgNoteLength} karakter</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Status Filter</h3>
                <p className="text-2xl font-bold text-orange-600">
                  {analysisData.filterInfo.isFiltered ? 'Aktif' : 'Semua Data'}
                </p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top Keywords */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Kata Kunci Teratas</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysisData.topKeywords.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="word" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sentiment Analysis */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Analisis Sentimen</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analysisData.sentimentAnalysis}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analysisData.sentimentAnalysis.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Analysis */}
            {Object.keys(analysisData.categoryAnalysis).length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-lg font-semibold mb-4">Analisis per Kategori</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(analysisData.categoryAnalysis).map(([category, keywords]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
                      <div className="space-y-2">
                        {keywords.slice(0, 5).map((keyword, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-700">{keyword.word}</span>
                            <span className="text-gray-500">{keyword.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Region Analysis */}
            {Object.keys(analysisData.regionAnalysis).length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-lg font-semibold mb-4">Analisis per Wilayah</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(analysisData.regionAnalysis).map(([region, keywords]) => (
                    <div key={region} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">{region}</h4>
                      <div className="space-y-2">
                        {keywords.slice(0, 5).map((keyword, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-700">{keyword.word}</span>
                            <span className="text-gray-500">{keyword.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proximity Analysis */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold mb-4">🔍 Analisis Kedekatan Kata</h3>
              
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
                      onChange={(e) => setCustomKeywords(e.target.value)}
                      disabled={loading}
                      placeholder="Masukkan kata kunci dipisah koma, contoh: ekonomi, sosial, infrastruktur"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Kata kunci akan digabung dengan kata default: peningkatan, penurunan, naik, turun, tumbuh, masalah, solusi, perbaikan
                    </p>
                  </div>
                  <button
                    onClick={handleApplyCustomKeywords}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
              
              {analysisData.proximityKeywordsInfo && (
                <div className="text-sm text-gray-600 mb-6">
                  <p className="mb-2">
                    Analisis kata-kata yang sering muncul di sekitar kata kunci yang dipilih:
                  </p>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="font-medium">Kata Default:</span>
                      {analysisData.proximityKeywordsInfo.defaultKeywords.map((keyword: string, index: number) => (
                        <span key={index} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    {analysisData.proximityKeywordsInfo.hasCustomKeywords && (
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">Kata Kustom:</span>
                        {analysisData.proximityKeywordsInfo.customKeywords.map((keyword: string, index: number) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(analysisData.proximityAnalysis)
                  .filter(([_, data]) => data.occurrences > 0)
                  .map(([keyword, data]) => (
                    <div key={keyword} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">
                        "{keyword}" ({data.occurrences} kemunculan)
                      </h4>
                      <div className="space-y-1 text-sm">
                        {data.topProximityWords.slice(0, 5).map((word, index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-gray-700">{word.word}</span>
                            <span className="text-gray-500">{word.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Word Cloud Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Word Cloud Data (Top 20)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {analysisData.wordCloudData.slice(0, 20).map((word, index) => (
                  <div
                    key={index}
                    className="text-center p-3 border rounded-lg hover:bg-gray-50"
                    style={{
                      fontSize: `${Math.min(Math.max(word.value / 2 + 8, 10), 24)}px`,
                    }}
                  >
                    <div className="font-medium text-gray-800">{word.text}</div>
                    <div className="text-xs text-gray-500">{word.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : !loading && (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <div className="text-gray-500 text-lg mb-4">
              {analysisData && analysisData.totalCatatanSurvei === 0 
                ? 'Tidak ada data catatan survei yang ditemukan untuk filter yang dipilih.'
                : 'Memuat data analisis...'}
            </div>
            {analysisData && analysisData.totalCatatanSurvei === 0 && (
              <button
                onClick={resetFilters}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}