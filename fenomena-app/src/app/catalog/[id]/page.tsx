'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Phenomenon {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  user: {
    username: string;
  };
  category: {
    id: string;
    name: string;
    description: string;
    periodeSurvei?: string;
    startDate?: string;
    endDate?: string;
  };
  region: {
    id: string;
    province: string;
    city: string;
    regionCode: string;
  };
}

export default function PhenomenaDetailPage() {
  const params = useParams();
  const phenomenonId = params.id as string;
  
  const [phenomenon, setPhenomenon] = useState<Phenomenon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (phenomenonId) {
      fetchPhenomenon();
    }
  }, [phenomenonId]);

  const fetchPhenomenon = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phenomena/${phenomenonId}`);
      
      if (response.ok) {
        const data = await response.json();
        setPhenomenon(data);
      } else {
        setError('Fenomena tidak ditemukan');
      }
    } catch (error) {
      setError('Gagal memuat data fenomena');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !phenomenon) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/catalog" className="text-blue-600 hover:text-blue-800">
                  ← Kembali ke Katalog
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Detail Fenomena</h1>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="max-w-4xl mx-auto py-12 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-red-600 text-lg mb-4">{error}</div>
            <Link href="/catalog" className="text-blue-600 hover:text-blue-800">
              ← Kembali ke Katalog
            </Link>
          </div>
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
              <Link href="/catalog" className="text-blue-600 hover:text-blue-800">
                ← Kembali ke Katalog
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Detail Fenomena</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {phenomenon.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-blue-100">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {new Date(phenomenon.createdAt).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              {phenomenon.user && (
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  {phenomenon.user.username}
                </span>
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6">
            {/* Description */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Deskripsi Fenomena</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {phenomenon.description}
                </p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Category Card */}
              {phenomenon.category && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                    Kategori Survei
                  </h3>
                  <p className="text-blue-800 font-medium">{phenomenon.category.name}</p>
                  {phenomenon.category.description && (
                    <p className="text-blue-600 text-sm mt-1">{phenomenon.category.description}</p>
                  )}
                </div>
              )}

              {/* Period Card */}
              {phenomenon.category && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Periode Survei
                  </h3>
                  <p className="text-green-800 font-medium">{phenomenon.category.periodeSurvei || 'N/A'}</p>
                  {phenomenon.category.startDate && phenomenon.category.endDate && (
                    <p className="text-green-600 text-sm mt-1">
                      {(() => {
                        const startDate = new Date(phenomenon.category.startDate);
                        const endDate = new Date(phenomenon.category.endDate);
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                          return 'Tanggal tidak tersedia';
                        }
                        return `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
                      })()}
                    </p>
                  )}
                </div>
              )}

              {/* Region Card */}
              {phenomenon.region && (
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h3 className="font-semibold text-orange-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Wilayah
                  </h3>
                  <p className="text-orange-800 font-medium">{phenomenon.region.city}</p>
                  <p className="text-orange-600 text-sm">
                    {phenomenon.region.province} ({phenomenon.region.regionCode})
                  </p>
                </div>
              )}

              {/* Author Card */}
              {phenomenon.user && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Dibuat Oleh
                  </h3>
                  <p className="text-purple-800 font-medium">{phenomenon.user.username}</p>
                  <p className="text-purple-600 text-sm">
                    {new Date(phenomenon.createdAt).toLocaleDateString('id-ID')}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <Link
                href="/catalog"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Kembali ke Katalog
              </Link>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  Print
                </button>
                
                <button
                  onClick={() => {
                    navigator.share({
                      title: phenomenon.title,
                      text: phenomenon.description,
                      url: window.location.href,
                    }).catch(() => {
                      // Fallback for browsers that don't support Web Share API
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link berhasil disalin ke clipboard!');
                    });
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}