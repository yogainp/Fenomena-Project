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
  region: {
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


export default function PhenomenaPage() {
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
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPhenomena();
  }, [filters]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, periodsRes, regionsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/periods'),
        fetch('/api/regions'),
      ]);
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
      
      if (periodsRes.ok) {
        const periodsData = await periodsRes.json();
        setPeriods(periodsData);
      }
      
      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        setRegions(regionsData.regions || []);
      }
      
      await fetchPhenomena();
    } catch (error) {
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhenomena = async () => {
    try {
      // Fetch phenomena with filters
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.periodId) params.append('periodId', filters.periodId);
      if (filters.regionId) params.append('regionId', filters.regionId);
      if (filters.search) params.append('search', filters.search);
      
      const phenomenaRes = await fetch(`/api/phenomena?${params.toString()}`);

      if (phenomenaRes.ok) {
        const phenomenaData = await phenomenaRes.json();
        setPhenomena(phenomenaData);
      }
    } catch (error) {
      setError('Failed to load phenomena');
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phenomenon?')) return;

    try {
      const response = await fetch(`/api/phenomena/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPhenomena();
      } else {
        const data = await response.json();
        setError(data.error || 'Delete failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
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
              <h1 className="ml-4 text-xl font-semibold">Kelola Fenomena</h1>
            </div>
            <div className="flex items-center">
              <Link href="/phenomena/add">
                <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                  + Tambah Fenomena
                </button>
              </Link>
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

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter Fenomena</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                )) || []}
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
                {periods?.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                )) || []}
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
                {regions?.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.city} - {region.province}
                  </option>
                )) || []}
              </select>
            </div>
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
          </div>
        </div>

        {/* Phenomena List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Daftar Fenomena ({phenomena?.length || 0})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {!phenomena || phenomena.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Belum ada fenomena yang tersedia
              </div>
            ) : (
              phenomena.map((phenomenon) => (
                <div key={phenomenon.id} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {phenomenon.title}
                      </h3>
                      <p className="mt-2 text-gray-600">{phenomenon.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>Kategori: {phenomenon.category.name}</span>
                        <span>Periode: {phenomenon.period.name}</span>
                        <span>Wilayah: {phenomenon.region.city}, {phenomenon.region.province}</span>
                        <span>Oleh: {phenomenon.user.username}</span>
                        <span>
                          {new Date(phenomenon.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <Link
                        href={`/phenomena/edit/${phenomenon.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(phenomenon.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}