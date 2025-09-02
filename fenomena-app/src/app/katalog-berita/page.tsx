'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalBerita: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ApiResponse {
  berita: ScrappingBerita[];
  pagination: PaginationInfo;
}

export default function KatalogBeritaPublicPage() {
  const [beritaList, setBeritaList] = useState<ScrappingBerita[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchBerita();
  }, [currentPage, searchTerm, portalFilter, keywordFilter, dateFrom, dateTo, sortOrder]);

  const fetchBerita = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (portalFilter) params.append('portal', portalFilter);
      if (keywordFilter) params.append('keyword', keywordFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      params.append('sortBy', 'tanggalBerita');
      params.append('sortOrder', sortOrder);
      
      const response = await fetch(`/api/katalog-berita?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news');
      }
      
      const data: ApiResponse = await response.json();
      setBeritaList(data.berita);
      setPagination(data.pagination);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Fetch berita error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchBerita();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPortalFilter('');
    setKeywordFilter('');
    setDateFrom('');
    setDateTo('');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPortalColor = (portal: string) => {
    if (portal.includes('pontianakpost')) return 'bg-blue-100 text-blue-800';
    if (portal.includes('kalbaronline')) return 'bg-green-100 text-green-800';
    if (portal.includes('antaranews')) return 'bg-red-100 text-red-800';
    if (portal.includes('suarakalbar')) return 'bg-purple-100 text-purple-800';
    if (portal.includes('pontianak.tribunnews')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPortalDisplayName = (portalDomain: string): string => {
    if (portalDomain.includes('pontianakpost.jawapos.com')) return 'Pontianak Post';
    if (portalDomain.includes('kalbaronline.com')) return 'Kalbar Online';
    if (portalDomain.includes('kalbar.antaranews.com')) return 'Antara News Kalbar';
    if (portalDomain.includes('suarakalbar.co.id')) return 'Suara Kalbar';
    if (portalDomain.includes('pontianak.tribunnews.com')) return 'Tribun Pontianak';
    return portalDomain;
  };

  if (loading && beritaList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Katalog Berita</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading news...</div>
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
              <h1 className="ml-4 text-xl font-semibold">Katalog Berita</h1>
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

        {/* Search and Filter Section */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search in title or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Portal</label>
                <select
                  value={portalFilter}
                  onChange={(e) => setPortalFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Portals</option>
                  <option value="https://pontianakpost.jawapos.com/daerah">Pontianak Post</option>
                  <option value="https://kalbaronline.com/berita-daerah/">Kalbar Online</option>
                  <option value="https://kalbar.antaranews.com/kalbar">Antara News Kalbar</option>
                  <option value="https://www.suarakalbar.co.id/category/kalbar/">Suara Kalbar</option>
                  <option value="https://pontianak.tribunnews.com/index-news/kalbar">Tribun Pontianak</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keyword</label>
                <input
                  type="text"
                  placeholder="Filter by keyword..."
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by Date</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              
              <div className="flex items-end space-x-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Search
                </button>
                {(searchTerm || portalFilter || keywordFilter || dateFrom || dateTo || sortOrder !== 'desc') && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Results Summary */}
        {pagination && (
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {beritaList.length} of {pagination.totalBerita} news articles
            </p>
          </div>
        )}


        {/* News List */}
        <div className="space-y-6">
          {beritaList.length === 0 && !loading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-500 text-lg">No news articles found</div>
              <p className="text-gray-400 mt-2">Try adjusting your search filters</p>
            </div>
          ) : (
            beritaList.map((berita) => (
              <div key={berita.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          <a 
                            href={berita.linkBerita} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-600"
                          >
                            {berita.judul}
                          </a>
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                          {berita.isi}
                        </p>
                        
                        <div className="flex items-center flex-wrap gap-2 text-sm mb-3">
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {getPortalDisplayName(berita.portalBerita)}
                          </span>
                          <span className="text-gray-500">
                            Published: {formatDate(berita.tanggalBerita)}
                          </span>
                          <span className="text-gray-500">
                            Scraped: {formatDate(berita.tanggalScrap)}
                          </span>
                        </div>
                        
                        {berita.matchedKeywords && berita.matchedKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            <span className="text-xs text-gray-500 mr-2">Keywords:</span>
                            {berita.matchedKeywords.map((keyword, index) => (
                              <span 
                                key={index}
                                className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-4">
                        <a 
                          href={berita.linkBerita} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          View Original →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span> ({pagination.totalBerita} total articles)
                </p>
              </div>
              <div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}