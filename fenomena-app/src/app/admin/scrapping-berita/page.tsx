'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

interface ScrapingStatistics {
  totalNews: number;
  todayNews: number;
  totalKeywords: number;
  activeKeywords: number;
}

interface RecentActivity {
  id: string;
  judul: string;
  portalBerita: string;
  tanggalScrap: string;
  matchedKeywords: string[];
}

interface ScrapingResult {
  success: boolean;
  totalScraped: number;
  newItems: number;
  duplicates: number;
  errors: string[];
}

export default function ScrappingBeritaPage() {
  const [statistics, setStatistics] = useState<ScrapingStatistics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [scrapingResult, setScrapingResult] = useState<ScrapingResult | null>(null);
  
  // Scraping configuration
  const [scrapingConfig, setScrapingConfig] = useState({
    portalUrl: 'https://pontianakpost.jawapos.com/daerah',
    maxPages: 5,
    delayMs: 2000,
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await makeAuthenticatedRequest('/api/admin/scrapping-berita/execute');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch statistics');
      }
      
      const data = await response.json();
      setStatistics(data.statistics);
      setRecentActivity(data.recentActivity);
      
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch statistics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeScraping = async () => {
    try {
      setScraping(true);
      setError('');
      setSuccessMessage('');
      setScrapingResult(null);
      
      const response = await makeAuthenticatedRequest('/api/admin/scrapping-berita/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapingConfig),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute scraping');
      }
      
      const data = await response.json();
      setScrapingResult(data.result);
      
      if (data.result.success) {
        setSuccessMessage(`Scraping completed successfully! Found ${data.result.newItems} new articles.`);
        fetchStatistics(); // Refresh statistics
      } else {
        setError(`Scraping completed with errors: ${data.result.errors.join(', ')}`);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScraping(false);
    }
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
                <h1 className="ml-4 text-xl font-semibold">News Scraping Control Panel</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
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
              <h1 className="ml-4 text-xl font-semibold">News Scraping Control Panel</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/scrapping-keywords"
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Manage Keywords
              </Link>
              <Link 
                href="/admin/katalog-berita"
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                View News Catalog
              </Link>
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

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">N</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total News</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.totalNews}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">T</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Today's News</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.todayNews}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">K</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Keywords</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.activeKeywords}/{statistics.totalKeywords}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">%</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Match Rate</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {statistics.activeKeywords > 0 ? Math.round((statistics.todayNews / statistics.activeKeywords) * 100) / 100 : 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scraping Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Scraping Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Portal URL</label>
                <input
                  type="url"
                  value={scrapingConfig.portalUrl}
                  onChange={(e) => setScrapingConfig({ ...scrapingConfig, portalUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={scraping}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Pages to Scrape</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={scrapingConfig.maxPages}
                  onChange={(e) => setScrapingConfig({ ...scrapingConfig, maxPages: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={scraping}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delay Between Requests (ms)</label>
                <input
                  type="number"
                  min="1000"
                  max="10000"
                  step="500"
                  value={scrapingConfig.delayMs}
                  onChange={(e) => setScrapingConfig({ ...scrapingConfig, delayMs: parseInt(e.target.value) || 2000 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={scraping}
                />
              </div>
              
              <div className="pt-4">
                <button
                  onClick={executeScraping}
                  disabled={scraping || statistics?.activeKeywords === 0}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scraping ? 'Scraping in Progress...' : 'Start Scraping'}
                </button>
                
                {statistics?.activeKeywords === 0 && (
                  <p className="mt-2 text-sm text-red-600">
                    Please add and activate keywords before scraping.{' '}
                    <Link href="/admin/scrapping-keywords" className="underline">
                      Manage Keywords
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Scraping Activity</h3>
            
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <div key={item.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      {item.judul.length > 60 ? `${item.judul.substring(0, 60)}...` : item.judul}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      {item.portalBerita} • {new Date(item.tanggalScrap).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.matchedKeywords.slice(0, 3).map((keyword, index) => (
                        <span 
                          key={index}
                          className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                      {item.matchedKeywords.length > 3 && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          +{item.matchedKeywords.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500">No recent scraping activity</div>
                  <p className="text-sm text-gray-400 mt-2">Start scraping to see activity here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scraping Results */}
        {scrapingResult && (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Last Scraping Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{scrapingResult.totalScraped}</div>
                <div className="text-sm text-blue-800">Total Scraped</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{scrapingResult.newItems}</div>
                <div className="text-sm text-green-800">New Items</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{scrapingResult.duplicates}</div>
                <div className="text-sm text-yellow-800">Duplicates</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{scrapingResult.errors.length}</div>
                <div className="text-sm text-red-800">Errors</div>
              </div>
            </div>

            {scrapingResult.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Errors:</h4>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                  {scrapingResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}