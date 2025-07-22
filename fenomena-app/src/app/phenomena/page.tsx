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

export default function PhenomenaPage() {
  const [phenomena, setPhenomena] = useState<Phenomenon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    periodId: '',
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: '',
    periodId: '',
    search: '',
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch phenomena with filters
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/phenomena/${editingId}` : '/api/phenomena';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ title: '', description: '', categoryId: '', periodId: '' });
        fetchData();
      } else {
        setError(data.error || 'Operation failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleEdit = (phenomenon: Phenomenon) => {
    setEditingId(phenomenon.id);
    setFormData({
      title: phenomenon.title,
      description: phenomenon.description,
      categoryId: '', // We'll need to fetch this from the API
      periodId: '', // We'll need to fetch this from the API
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phenomenon?')) return;

    try {
      const response = await fetch(`/api/phenomena/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
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
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Tambah Fenomena
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <h2 className="text-lg font-semibold">Daftar Fenomena ({phenomena.length})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {phenomena.length === 0 ? (
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
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <span>Kategori: {phenomenon.category.name}</span>
                        <span>Periode: {phenomenon.period.name}</span>
                        <span>Oleh: {phenomenon.user.username}</span>
                        <span>
                          {new Date(phenomenon.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={() => handleEdit(phenomenon)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
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

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {editingId ? 'Edit Fenomena' : 'Tambah Fenomena Baru'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Judul Fenomena
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deskripsi Fenomena
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategori Survei
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                      Periode Survei
                    </label>
                    <select
                      value={formData.periodId}
                      onChange={(e) => setFormData({ ...formData, periodId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setFormData({ title: '', description: '', categoryId: '', periodId: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editingId ? 'Update' : 'Simpan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}