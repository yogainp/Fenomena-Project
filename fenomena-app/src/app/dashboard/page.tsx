'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile');
      
      if (response.ok) {
        const userData = await response.json();
        setUser({
          id: userData.id,
          email: userData.email,
          username: userData.username,
          role: userData.role
        });
      } else {
        // If profile fetch fails, redirect to login
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
              <h1 className="text-xl font-semibold">Aplikasi Kompilasi Fenomena</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user?.username} ({user?.role})
              </span>
              {user?.role === 'ADMIN' && (
                <Link href="/admin/users">
                  <button className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700">
                    User Management
                  </button>
                </Link>
              )}
              <Link href="/profile">
                <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                  Profile
                </button>
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Navigation Cards */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Kelola Fenomena
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Input dan kelola data fenomena survei
                </p>
                <div className="mt-4">
                  <Link href="/phenomena">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      Buka
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Katalog Fenomena
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Browse dan cari fenomena yang tersedia
                </p>
                <div className="mt-4">
                  <Link href="/catalog">
                    <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                      Buka
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Analisis
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Lihat analisis dan visualisasi data
                </p>
                <div className="mt-4">
                  <Link href="/analytics">
                    <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                      Buka
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Catatan Survei
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Upload data survei CSV dan analisis teks
                </p>
                <div className="mt-4">
                  <Link href="/catatan-survei">
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                      Buka
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {user?.role === 'ADMIN' && (
              <div className="bg-white overflow-hidden shadow rounded-lg lg:col-span-4">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Panel Admin
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Kelola kategori survei, periode survei, pengguna, wilayah, dan pengaturan sistem
                  </p>
                  <div className="mt-4 space-x-4">
                    <Link href="/admin/categories">
                      <button className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                        Kelola Kategori
                      </button>
                    </Link>
                    <Link href="/admin/periods">
                      <button className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                        Kelola Periode
                      </button>
                    </Link>
                    <Link href="/admin/users">
                      <button className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                        Kelola Pengguna
                      </button>
                    </Link>
                    <Link href="/admin/regions">
                      <button className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">
                        Kelola Wilayah
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}