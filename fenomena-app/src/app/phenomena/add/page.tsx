'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

interface User {
  id: string;
  role: string;
  regionId?: string;
}

export default function AddPhenomenaPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    periodId: '',
    regionId: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, periodsRes, regionsRes, userRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/periods'),
        fetch('/api/regions'),
        fetch('/api/profile'),
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
        setRegions(regionsData);
      }
      
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser({
          id: userData.id,
          role: userData.role,
          regionId: userData.regionId,
        });
        
        // Set default region for non-admin users
        if (userData.role !== 'ADMIN' && userData.regionId) {
          setFormData(prev => ({ ...prev, regionId: userData.regionId }));
        }
      }
    } catch (error) {
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/phenomena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/phenomena');
      } else {
        setError(data.error || 'Failed to create phenomenon');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
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
              <Link href="/phenomena" className="text-blue-600 hover:text-blue-800">
                ← Kembali ke Daftar Fenomena
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Tambah Fenomena Baru</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Judul Fenomena <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan judul fenomena"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi Fenomena <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan deskripsi fenomena secara detail"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Survei <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Periode Survei <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.periodId}
                  onChange={(e) => setFormData({ ...formData, periodId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Periode</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wilayah <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.regionId}
                onChange={(e) => setFormData({ ...formData, regionId: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  currentUser?.role !== 'ADMIN' ? 'bg-gray-100' : ''
                }`}
                required
                disabled={currentUser?.role !== 'ADMIN'}
              >
                <option value="">Pilih Wilayah</option>
                {(currentUser?.role === 'ADMIN' ? regions : regions.filter(r => r.id === currentUser?.regionId)).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.city} - {region.province} ({region.regionCode})
                  </option>
                ))}
              </select>
              {currentUser?.role !== 'ADMIN' && (
                <p className="mt-2 text-sm text-gray-500">
                  Anda hanya dapat menginput fenomena di wilayah yang telah ditetapkan
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Link
                href="/phenomena"
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Fenomena'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}