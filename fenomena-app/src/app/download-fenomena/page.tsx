'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

interface Category {
  id: string;
  name: string;
  description: string;
}


interface Region {
  id: string;
  name: string;
  code: string;
}

export default function DownloadFenomenaPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    categoryId: '',
    startDate: '',
    endDate: '',
    regionId: '',
    format: 'csv', // csv, json, excel
  });

  // Preview state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    // Always fetch preview count after metadata is loaded
    if (!loading) {
      fetchPreviewCount();
    }
  }, [filters.categoryId, filters.startDate, filters.endDate, filters.regionId, loading]);

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, regionsRes] = await Promise.all([
        makeAuthenticatedRequest('/api/categories'),
        makeAuthenticatedRequest('/api/regions'),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
      

      if (regionsRes.ok) {
        const regionsData = await regionsRes.json();
        setRegions(regionsData);
      }
    } catch (error) {
      setError('Failed to load metadata');
      console.error('Fetch metadata error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewCount = async () => {
    try {
      setPreviewLoading(true);
      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.regionId) params.append('regionId', filters.regionId);
      params.append('count', 'true');

      const response = await makeAuthenticatedRequest(`/api/phenomena?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewCount(data.count || data.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch preview count:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async () => {
    // Download is always allowed - empty string means "Semua" which is valid
    // No need for additional validation since API can handle empty filters

    try {
      setDownloading(true);
      setError('');
      setSuccess('');

      const params = new URLSearchParams();
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.regionId) params.append('regionId', filters.regionId);
      params.append('format', filters.format);
      params.append('download', 'true');

      const response = await makeAuthenticatedRequest(`/api/phenomena?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'fenomena-data';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      } else {
        // Generate filename based on filters
        const timestamp = new Date().toISOString().split('T')[0];
        const categoryName = filters.categoryId ? categories.find(c => c.id === filters.categoryId)?.name || 'kategori' : '';
        const dateRangeName = filters.startDate && filters.endDate ? `${filters.startDate}-to-${filters.endDate}` : filters.startDate ? `from-${filters.startDate}` : filters.endDate ? `to-${filters.endDate}` : '';
        const regionName = filters.regionId ? regions.find(r => r.id === filters.regionId)?.name || 'wilayah' : '';
        
        const parts = [categoryName, dateRangeName, regionName].filter(Boolean);
        filename = `fenomena-${parts.join('-')}-${timestamp}.${filters.format}`;
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`File berhasil didownload: ${filename}`);
    } catch (error) {
      setError('Gagal mendownload file. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const getSelectedFiltersText = () => {
    const selected = [];
    
    // Category filter
    if (filters.categoryId) {
      const category = categories.find(c => c.id === filters.categoryId);
      if (category) selected.push(`Kategori: ${category.name}`);
    } else {
      selected.push('Kategori: Semua Kategori');
    }
    
    // Date range filter
    if (filters.startDate && filters.endDate) {
      selected.push(`Periode: ${filters.startDate} s/d ${filters.endDate}`);
    } else if (filters.startDate) {
      selected.push(`Periode: Dari ${filters.startDate}`);
    } else if (filters.endDate) {
      selected.push(`Periode: Sampai ${filters.endDate}`);
    } else {
      selected.push('Periode: Semua Tanggal');
    }
    
    // Region filter
    if (filters.regionId) {
      const region = regions.find(r => r.id === filters.regionId);
      if (region) selected.push(`Wilayah: ${region.name}`);
    } else {
      selected.push('Wilayah: Semua Wilayah');
    }
    
    return selected.join(', ');
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
              <Link href="/catalog" className="text-blue-600 hover:text-blue-800">
                ← Back to Catalog
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Download Data Fenomena</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Download Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter Data untuk Download</h2>
          <p className="text-sm text-gray-600 mb-6">
            Pilih filter untuk menentukan data fenomena yang ingin didownload. Minimal satu filter harus dipilih.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Survei
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wilayah
              </label>
              <select
                value={filters.regionId}
                onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Wilayah</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format File
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={filters.format === 'csv'}
                  onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                  className="mr-2"
                />
                CSV (.csv)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={filters.format === 'json'}
                  onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                  className="mr-2"
                />
                JSON (.json)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="excel"
                  checked={filters.format === 'excel'}
                  onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                  className="mr-2"
                />
                Excel (.xlsx)
              </label>
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview Data</h3>
            <div className="text-sm text-gray-600">
              <p><strong>Filter yang dipilih:</strong> {getSelectedFiltersText()}</p>
              <p><strong>Jumlah data:</strong> 
                {previewLoading ? (
                  <span className="ml-2">Loading...</span>
                ) : previewCount !== null && previewCount !== undefined ? (
                  <span className="ml-2 font-semibold text-blue-600">{Number(previewCount).toLocaleString()} fenomena</span>
                ) : (
                  <span className="ml-2 text-gray-400">Pilih filter untuk melihat jumlah data</span>
                )}
              </p>
              <p><strong>Format:</strong> {filters.format.toUpperCase()}</p>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-end">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  📊 Download Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Informasi Download</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>Format CSV:</strong> File spreadsheet yang dapat dibuka dengan Excel, Google Sheets, atau aplikasi serupa.
            </div>
            <div>
              <strong>Format JSON:</strong> Format data terstruktur yang cocok untuk pengembangan aplikasi atau analisis programatik.
            </div>
            <div>
              <strong>Format Excel:</strong> File Excel (.xlsx) dengan formatting yang rapi dan mudah dibaca.
            </div>
            <div>
              <strong>Kolom Data:</strong> ID, Judul, Deskripsi, Kategori, Periode, Wilayah, Pembuat, Tanggal Dibuat.
            </div>
            <div>
              <strong>Batasan:</strong> Download dibatasi maksimal 10,000 record per request untuk menjaga performa sistem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}