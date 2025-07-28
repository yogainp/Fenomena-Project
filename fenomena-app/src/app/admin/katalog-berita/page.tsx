'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

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
  analysisCount: number;
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

export default function KatalogBeritaPage() {
  const [beritaList, setBeritaList] = useState<ScrappingBerita[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selection states
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);

  useEffect(() => {
    fetchBerita();
  }, [currentPage, searchTerm, portalFilter, keywordFilter, dateFrom, dateTo]);

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
      
      const response = await makeAuthenticatedRequest(`/api/admin/scrapping-berita?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch news');
      }
      
      const data: ApiResponse = await response.json();
      setBeritaList(data.berita);
      setPagination(data.pagination);
      
    } catch (err: any) {
      setError(err.message);
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
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedItems.length} news item(s)? This action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      setFormLoading(true);
      
      const response = await makeAuthenticatedRequest('/api/admin/scrapping-berita', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beritaIds: selectedItems }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete news items');
      }
      
      setSelectedItems([]);
      setSuccessMessage(`${selectedItems.length} news items deleted successfully`);
      fetchBerita();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === beritaList.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(beritaList.map(item => item.id));
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL scraped news articles? This action cannot be undone and will permanently remove all news data from the database.'
    );
    if (!confirmed) return;
    
    const doubleConfirmed = window.confirm(
      'This is your final warning. Clicking OK will delete ALL scraped news articles. Are you absolutely sure?'
    );
    if (!doubleConfirmed) return;
    
    try {
      setClearAllLoading(true);
      setError('');
      
      const response = await makeAuthenticatedRequest('/api/admin/scrapping-berita/clear-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear all news');
      }
      
      const result = await response.json();
      setSuccessMessage(`Successfully deleted ${result.deletedCount} news articles`);
      setSelectedItems([]);
      fetchBerita();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClearAllLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                <h1 className="ml-4 text-xl font-semibold">News Catalog</h1>
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
              <h1 className="ml-4 text-xl font-semibold">News Catalog</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleClearAll}
                disabled={clearAllLoading}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {clearAllLoading ? 'Clearing...' : 'Clear All News'}
              </button>
              <Link 
                href="/admin/scrapping-berita"
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Scraping Control
              </Link>
              <Link 
                href="/admin/scrapping-keywords"
                className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
              >
                Manage Keywords
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
                <input
                  type="text"
                  placeholder="Filter by portal..."
                  value={portalFilter}
                  onChange={(e) => setPortalFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
              
              <div className="flex items-end space-x-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Search
                </button>
                {(searchTerm || portalFilter || keywordFilter || dateFrom || dateTo) && (
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

          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-800">
                  {selectedItems.length} item(s) selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={formLoading}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}
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
              <p className="text-gray-400 mt-2">Try adjusting your search filters or start scraping news</p>
              <Link 
                href="/admin/scrapping-berita"
                className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Start Scraping
              </Link>
            </div>
          ) : (
            beritaList.map((berita) => (
              <div key={berita.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(berita.id)}
                    onChange={() => toggleItemSelection(berita.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
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
                            {berita.portalBerita}
                          </span>
                          <span className="text-gray-500">
                            Published: {formatDate(berita.tanggalBerita)}
                          </span>
                          <span className="text-gray-500">
                            Scraped: {formatDate(berita.tanggalScrap)}
                          </span>
                          {berita.analysisCount > 0 && (
                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                              {berita.analysisCount} analysis
                            </span>
                          )}
                        </div>
                        
                        {berita.matchedKeywords.length > 0 && (
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
                        <Link 
                          href={`/admin/analisis-scrapping-berita/${berita.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Analyze →
                        </Link>
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

        {/* Floating Select All Button */}
        {beritaList.length > 0 && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={toggleSelectAll}
              className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700"
            >
              {selectedItems.length === beritaList.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}