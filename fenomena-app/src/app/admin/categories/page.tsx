'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  description: string;
  periodeSurvei: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count: {
    phenomena: number;
  };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/categories');
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else if (response.status === 403) {
        setError('Access denied. Admin role required.');
      } else {
        setError('Failed to load categories');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        fetchCategories();
      } else {
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
              <h1 className="ml-4 text-xl font-semibold">Kelola Kategori Survei</h1>
            </div>
            <Link
              href="/admin/categories/add"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block"
            >
              + Tambah Kategori
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Categories List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Daftar Kategori Survei ({categories.length})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {categories.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Belum ada kategori yang tersedia
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.id} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="mt-2 text-gray-600">{category.description}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {category.periodeSurvei && (
                          <div className="text-sm text-blue-600">
                            <span className="font-medium">Periode:</span> {category.periodeSurvei}
                          </div>
                        )}
                        {category.startDate && category.endDate && (
                          <div className="text-sm text-green-600">
                            <span className="font-medium">Rentang:</span> {' '}
                            {new Date(category.startDate).toLocaleDateString('id-ID')} - {' '}
                            {new Date(category.endDate).toLocaleDateString('id-ID')}
                          </div>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{category._count.phenomena} fenomena</span>
                          <span>
                            Dibuat: {new Date(category.createdAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <Link
                        href={`/admin/categories/edit/${category.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(category.id, category.name)}
                        disabled={category._count.phenomena > 0}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title={category._count.phenomena > 0 ? 'Cannot delete category with phenomena' : ''}
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