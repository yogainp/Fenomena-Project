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

  useEffect(() => {
    fetchBerita();
  }, [currentPage, searchTerm, portalFilter, keywordFilter, dateFrom, dateTo]);

  const fetchBerita = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (portalFilter) params.append('portal', portalFilter);
      if (keywordFilter) params.append('keyword', keywordFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
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
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPortalColor = (portal: string) => {
    if (portal.includes('pontianakpost')) return 'bg-blue-100 text-blue-800';
    if (portal.includes('kalbaronline')) return 'bg-green-100 text-green-800';
    if (portal.includes('antaranews')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPortalName = (portal: string) => {
    if (portal.includes('pontianakpost')) return 'Pontianak Post';
    if (portal.includes('kalbaronline')) return 'Kalbar Online';
    if (portal.includes('antaranews')) return 'Antara News';
    return portal;
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
              <h1 className="text-xl font-semibold">Katalog Berita</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Katalog Berita</h1>
            <p className="mt-2 text-sm text-gray-600">
              Browse dan cari koleksi berita yang telah dikumpulkan dari berbagai portal berita
            </p>
          </div>

          {/* Search and Filters */}
          <div className="bg-white shadow rounded-lg mb-6">
            <form onSubmit={handleSearch} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                    Cari Berita
                  </label>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari berdasarkan judul atau isi berita..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="portal" className="block text-sm font-medium text-gray-700 mb-1">
                    Portal Berita
                  </label>
                  <select
                    id="portal"
                    value={portalFilter}
                    onChange={(e) => setPortalFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Semua Portal</option>
                    <option value="pontianakpost">Pontianak Post</option>
                    <option value="kalbaronline">Kalbar Online</option>
                    <option value="antaranews">Antara News</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">
                    Keyword
                  </label>
                  <input
                    type="text"
                    id="keyword"
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    placeholder="Filter berdasarkan keyword..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Dari
                  </label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Sampai
                  </label>
                  <input
                    type="date"
                    id="dateTo"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end space-x-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Cari
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Results Summary */}
          {pagination && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Menampilkan {beritaList.length} dari {pagination.totalBerita} berita
                {pagination.totalPages > 1 && ` (Halaman ${pagination.currentPage} dari ${pagination.totalPages})`}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="text-lg text-gray-600">Memuat berita...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <p>Error: {error}</p>
            </div>
          )}

          {/* News Grid */}
          {!loading && !error && (
            <>
              {beritaList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Tidak ada berita yang ditemukan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {beritaList.map((berita) => (
                    <div key={berita.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                      <div className="p-6">
                        {/* Portal Badge */}
                        <div className="mb-3">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getPortalColor(berita.portalBerita)}`}>
                            {getPortalName(berita.portalBerita)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                          {berita.judul}
                        </h3>

                        {/* Content Preview */}
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {berita.isi}
                        </p>

                        {/* Keywords */}
                        {berita.matchedKeywords.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1">
                              {berita.matchedKeywords.slice(0, 3).map((keyword, index) => (
                                <span
                                  key={index}
                                  className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full"
                                >
                                  #{keyword}
                                </span>
                              ))}
                              {berita.matchedKeywords.length > 3 && (
                                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                  +{berita.matchedKeywords.length - 3} lainnya
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Date */}
                        <p className="text-xs text-gray-500 mb-4">
                          {formatDate(berita.tanggalBerita)}
                        </p>

                        {/* Action Button */}
                        <div className="flex justify-between items-center">
                          <a
                            href={berita.linkBerita}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Baca Selengkapnya
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Sebelumnya
                  </button>

                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                      const pageNumber = i + 1;
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`px-3 py-2 text-sm rounded-md ${
                            currentPage === pageNumber
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}