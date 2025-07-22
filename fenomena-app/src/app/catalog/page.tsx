'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Phenomenon {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  user: {
    username: string;
  };
  category: {
    name: string;
  };
  period: {
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export default function CatalogPage() {
  const [phenomena, setPhenomena] = useState<Phenomenon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: '',
    periodId: '',
    search: '',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.periodId) params.append('periodId', filters.periodId);
      if (filters.search) params.append('search', filters.search);
      
      const [phenomenaRes, categoriesRes, periodsRes] = await Promise.all([
        fetch(`/api/phenomena?${params.toString()}`),
        fetch('/api/categories'),
        fetch('/api/periods'),
      ]);

      if (phenomenaRes.ok) {
        const phenomenaData = await phenomenaRes.json();
        setPhenomena(phenomenaData);
        setCurrentPage(1); // Reset to first page when filters change
      }
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
      
      if (periodsRes.ok) {
        const periodsData = await periodsRes.json();
        setPeriods(periodsData);
      }
    } catch (error) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(phenomena.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPhenomena = phenomena.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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
              <h1 className="ml-4 text-xl font-semibold">Katalog Fenomena</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Cari Fenomena</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pencarian
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Cari judul atau deskripsi..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Survei
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Semua Kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periode Survei
              </label>
              <select
                value={filters.periodId}
                onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Semua Periode</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Menampilkan {startIndex + 1}-{Math.min(endIndex, phenomena.length)} dari {phenomena.length} fenomena
          </p>
        </div>

        {/* Phenomena Grid */}
        {phenomena.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 text-lg">Tidak ada fenomena yang ditemukan</div>
            <p className="text-gray-400 mt-2">Coba ubah filter pencarian atau kata kunci</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {currentPhenomena.map((phenomenon) => (
                <div key={phenomenon.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {phenomenon.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {phenomenon.description}
                    </p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-500 w-20">Kategori:</span>
                        <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">
                          {phenomenon.category.name}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-500 w-20">Periode:</span>
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                          {phenomenon.period.name}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-500 w-20">Oleh:</span>
                        <span className="text-gray-700">{phenomenon.user.username}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-500 w-20">Tanggal:</span>
                        <span className="text-gray-700">
                          {new Date(phenomenon.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-6 py-3">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Lihat Detail →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {[...Array(totalPages)].map((_, index) => {
                  const page = index + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-2 border rounded-md ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}