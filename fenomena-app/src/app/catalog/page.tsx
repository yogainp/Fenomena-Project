'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

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
  region?: {
    province: string;
    city: string;
    regionCode: string;
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

interface Region {
  id: string;
  province: string;
  city: string;
  regionCode: string;
}

export default function CatalogPage() {
  const [phenomena, setPhenomena] = useState<Phenomenon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: '',
    periodId: '',
    regionId: '',
    search: '',
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.periodId) params.append('periodId', filters.periodId);
      if (filters.regionId) params.append('regionId', filters.regionId);
      if (filters.search) params.append('search', filters.search);
      
      const [phenomenaRes, categoriesRes, periodsRes, regionsRes] = await Promise.all([
        makeAuthenticatedRequest(`/api/phenomena?${params.toString()}`),
        makeAuthenticatedRequest('/api/categories'),
        makeAuthenticatedRequest('/api/periods'),
        makeAuthenticatedRequest('/api/regions'),
      ]);

      if (phenomenaRes.ok) {
        const phenomenaData = await phenomenaRes.json();
        setPhenomena(Array.isArray(phenomenaData) ? phenomenaData : []);
      } else {
        console.error('Failed to fetch phenomena:', phenomenaRes.status);
        setPhenomena([]);
      }
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      }
      
      if (periodsRes.ok) {
        const periodsData = await periodsRes.json();
        setPeriods(Array.isArray(periodsData) ? periodsData : []);
      }

      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        setRegions(Array.isArray(regionsData) ? regionsData : []);
      }
    } catch (error) {
      setError('Failed to load data');
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Timeline View Logic
  const sortedPhenomena = [...phenomena].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const groupedByMonth = sortedPhenomena.reduce((groups, phenomenon) => {
    const date = new Date(phenomenon.createdAt);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    
    if (!groups[monthYear]) {
      groups[monthYear] = {
        name: monthName,
        items: []
      };
    }
    groups[monthYear].items.push(phenomenon);
    return groups;
  }, {} as Record<string, { name: string, items: Phenomenon[] }>);

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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Cari Fenomena</h2>
            <Link 
              href="/download-fenomena" 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Download Data 📊
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {categories && categories.map((category) => (
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
                {periods && periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wilayah
              </label>
              <select
                value={filters.regionId}
                onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Semua Wilayah</option>
                {regions && regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Menampilkan {phenomena.length} fenomena dalam tampilan timeline
          </p>
        </div>

        {/* Timeline View */}
        {phenomena.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500 text-lg">Tidak ada fenomena yang ditemukan</div>
            <p className="text-gray-400 mt-2">Coba ubah filter pencarian atau kata kunci</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            
            {Object.entries(groupedByMonth).map(([monthYear, group]) => (
              <div key={monthYear} className="relative mb-8">
                {/* Month header */}
                <div className="flex items-center mb-4">
                  <div className="absolute left-6 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow"></div>
                  <div className="ml-16">
                    <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                  </div>
                </div>
                
                {/* Phenomena for this month */}
                <div className="ml-16 space-y-4">
                  {group.items.map((phenomenon) => (
                    <div key={phenomenon.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            {phenomenon.title}
                          </h4>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {phenomenon.description}
                          </p>
                          
                          <div className="flex items-center flex-wrap gap-2 text-sm">
                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {phenomenon.category.name}
                            </span>
                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                              {phenomenon.period.name}
                            </span>
                            {phenomenon.region && (
                              <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                {phenomenon.region.city}
                              </span>
                            )}
                            <span className="text-gray-600">
                              oleh {phenomenon.user.username}
                            </span>
                            <span className="text-gray-500">
                              {new Date(phenomenon.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                        </div>
                        
                        <Link 
                          href={`/catalog/${phenomenon.id}`}
                          className="ml-4 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Detail →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}