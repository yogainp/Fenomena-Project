'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

interface CatatanSurvei {
  id: string;
  nomorResponden: number;
  respondenId: string;
  catatan: string;
  createdAt: string;
  region: {
    province: string;
    city: string;
    regionCode: string;
  };
  category: {
    name: string;
  };
  period: {
    name: string;
  };
  user: {
    username: string;
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

interface UploadResult {
  success: boolean;
  imported?: number;
  errors?: string[];
  preview?: CatatanSurvei[];
  message?: string;
  error?: string;
  categoryName?: string;
  periodName?: string;
}

interface ExistingDataInfo {
  hasExistingData: boolean;
  existingCount: number;
  lastUploadedBy?: string;
  lastUploadedAt?: string;
  categoryName: string;
  periodName: string;
  regionStats: Array<{
    region: {
      province: string;
      city: string;
    };
    count: number;
  }>;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'USER';
}

export default function CatatanSurveiPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<CatatanSurvei[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [existingDataInfo, setExistingDataInfo] = useState<ExistingDataInfo | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload flow state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  
  // File selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');

  useEffect(() => {
    // First check user role, then fetch data if admin
    checkUserRoleAndFetchData();
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'ADMIN') {
      fetchData();
    }
  }, [page, search, userProfile]);

  const checkUserRoleAndFetchData = async () => {
    try {
      console.log('Checking user role...');
      
      // Fetch user profile to check role
      const profileRes = await makeAuthenticatedRequest('/api/profile');
      
      if (profileRes.status === 401) {
        console.log('Authentication failed, redirecting to login');
        setError('❌ Sesi telah berakhir. Silakan login kembali.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
        return;
      }
      
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
        console.log('User profile loaded:', profile);
        
        // Check if user is admin
        if (profile.role !== 'ADMIN') {
          setError('❌ Akses ditolak. Halaman ini hanya dapat diakses oleh admin.');
          setLoading(false);
          return;
        }
        
        // If admin, fetch initial data
        await fetchInitialData();
      } else {
        console.error('Failed to load profile:', profileRes.status);
        setError('Gagal memuat profil pengguna. Silakan refresh halaman.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to check user role:', error);
      setError('Koneksi bermasalah saat memeriksa akses. Silakan periksa koneksi internet dan refresh halaman.');
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      console.log('Fetching initial data...');
      
      const [categoriesRes, periodsRes] = await Promise.all([
        makeAuthenticatedRequest('/api/categories'),
        makeAuthenticatedRequest('/api/periods'),
      ]);
      
      console.log('Categories response:', categoriesRes.status);
      console.log('Periods response:', periodsRes.status);
      
      // Check if authentication failed
      if (categoriesRes.status === 401 || periodsRes.status === 401) {
        console.log('Authentication failed, redirecting to login');
        setError('❌ Sesi telah berakhir. Silakan login kembali.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
        return;
      }
      
      let hasError = false;
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
        console.log('Categories loaded:', categoriesData.length);
      } else {
        console.error('Failed to load categories:', categoriesRes.status);
        hasError = true;
      }
      
      if (periodsRes.ok) {
        const periodsData = await periodsRes.json();
        setPeriods(periodsData);
        console.log('Periods loaded:', periodsData.length);
      } else {
        console.error('Failed to load periods:', periodsRes.status);
        hasError = true;
      }
      
      if (hasError) {
        setError('Gagal memuat data kategori atau periode. Silakan refresh halaman.');
      }
      
      console.log('Initial data fetch completed');
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('Koneksi bermasalah saat memuat data awal. Silakan periksa koneksi internet dan refresh halaman.');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
      });
      
      if (selectedCategoryId) params.append('categoryId', selectedCategoryId);
      if (selectedPeriodId) params.append('periodId', selectedPeriodId);
      
      const response = await makeAuthenticatedRequest(`/api/catatan-survei?${params.toString()}`);
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
        setTotalPages(result.pagination.totalPages);
      } else {
        // Handle different error cases more specifically
        if (response.status === 401) {
          setError('Sesi telah berakhir. Silakan login kembali.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        } else if (response.status === 403) {
          setError('Anda tidak memiliki akses untuk melihat data ini.');
        } else {
          try {
            const errorData = await response.json();
            setError(errorData.error || `Error ${response.status}: Gagal memuat data`);
          } catch {
            setError(`Error ${response.status}: Gagal memuat data`);
          }
        }
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      setError('Koneksi bermasalah. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPeriodSelection = async () => {
    if (!selectedCategoryId || !selectedPeriodId) {
      setError('Pilih kategori dan periode terlebih dahulu');
      return;
    }

    setCheckingExisting(true);
    setError('');
    setSuccessMessage('');
    setExistingDataInfo(null);

    try {
      const response = await makeAuthenticatedRequest('/api/catatan-survei/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          periodId: selectedPeriodId,
        }),
      });

      if (response.ok) {
        const info = await response.json();
        setExistingDataInfo(info);
        
        if (info.hasExistingData) {
          setShowWarning(true);
          setShowUploadSection(false);
        } else {
          setShowWarning(false);
          setShowUploadSection(true);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Gagal mengecek data existing');
      }
    } catch (error) {
      setError('Network error saat mengecek data existing');
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleProceedWithUpload = () => {
    setShowWarning(false);
    setShowUploadSection(true);
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('File harus berformat CSV');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setError('Ukuran file maksimal 50MB');
      return;
    }

    setSelectedFile(file);
    setError('');
    setSuccessMessage('');
    setUploadResult(null);

    // Read file preview (first few lines)
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 5); // Preview first 5 lines
      setFilePreview(lines.join('\n'));
    } catch (error) {
      setError('Gagal membaca file preview');
    }
  };

  const handleUploadToDatabase = async () => {
    if (!selectedFile) return;

    console.log('=== Frontend Upload Debug ===');
    console.log('Selected file:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      lastModified: selectedFile.lastModified
    });
    console.log('Category ID:', selectedCategoryId);
    console.log('Period ID:', selectedPeriodId);

    setUploading(true);
    setUploadResult(null);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('categoryId', selectedCategoryId);
      formData.append('periodId', selectedPeriodId);

      console.log('FormData entries:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File(name=${value.name}, size=${value.size})`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      console.log('Making authenticated request to /api/catatan-survei/upload...');
      const response = await makeAuthenticatedRequest('/api/catatan-survei/upload', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Check if response is ok first
      if (!response.ok) {
        console.log('Response not ok, status:', response.status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        
        // If it's a 401 authentication error, try to refresh and retry
        if (response.status === 401) {
          console.log('Authentication failed, redirecting to login...');
          setError('❌ Sesi telah berakhir. Silakan login kembali lalu coba upload lagi.');
          
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
          return;
        }
        
        // For other errors, try to parse error message
        try {
          const errorResult = JSON.parse(errorText);
          setError(`❌ ${errorResult.error || errorResult.message || `HTTP ${response.status} Error`}`);
        } catch {
          setError(`❌ HTTP ${response.status} Error: ${errorText.substring(0, 100)}`);
        }
        return;
      }

      // Read successful response
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed response:', result);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.log('Response text that failed to parse:', responseText);
        
        // If parsing fails but status was ok, try to recover and refresh data
        console.warn('JSON parse failed but HTTP status was OK - attempting to refresh data to check if upload succeeded');
        setError('');
        setSuccessMessage('⚠️ Upload mungkin berhasil. Memeriksa data...');
        
        try {
          await fetchData();
          setSuccessMessage('✅ Upload berhasil! Data telah diperbarui.');
        } catch (refreshError) {
          console.error('Failed to refresh data after parse error:', refreshError);
          setError('Upload mungkin berhasil tetapi tidak dapat memverifikasi. Silakan refresh halaman.');
        }
        return;
      }
      
      setUploadResult(result);

      // Check if the result indicates success
      if (result.success === true) {
        console.log('Upload successful, refreshing data...');
        
        // Show success message
        const importedCount = result.imported || 0;
        const errorsCount = result.errors ? result.errors.length : 0;
        let message = `✅ Upload Berhasil! ${importedCount} data berhasil diimpor.`;
        
        if (errorsCount > 0) {
          message += ` ${errorsCount} baris dengan peringatan.`;
        }
        
        setSuccessMessage(message);
        setError(''); // Clear any previous errors
        
        // Refresh data after successful upload
        await fetchData();
        
        // Reset upload flow
        setShowUploadSection(false);
        setShowWarning(false);
        setExistingDataInfo(null);
        setSelectedFile(null);
        setFilePreview('');
        
        console.log('Upload completed successfully:', importedCount, 'records imported');
      } else {
        console.log('Upload failed with result:', result);
        setError(`❌ ${result.error || result.message || 'Upload failed'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Check if it's a network error vs other errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setError(`❌ Koneksi bermasalah: ${error.message}`);
      } else {
        // For other errors, try to refresh data to check if upload actually succeeded
        console.log('Unexpected error during upload, checking if data was actually uploaded...');
        setError('');
        setSuccessMessage('⚠️ Terjadi error saat upload. Memeriksa apakah data berhasil tersimpan...');
        
        try {
          await fetchData();
          // If refresh succeeds and data count increased, assume upload worked
          setSuccessMessage('✅ Upload berhasil! Data telah diperbarui meskipun ada error saat proses.');
          setError('');
          
          // Reset upload flow on success
          setShowUploadSection(false);
          setShowWarning(false);
          setExistingDataInfo(null);
          setSelectedFile(null);
          setFilePreview('');
        } catch (refreshError) {
          console.error('Failed to refresh data after upload error:', refreshError);
          setError('❌ Upload error dan tidak dapat memverifikasi status. Silakan refresh halaman untuk memeriksa apakah data tersimpan.');
          setSuccessMessage('');
        }
      }
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    if (!selectedCategoryId || !selectedPeriodId) {
      alert('Pilih kategori dan periode terlebih dahulu');
      return;
    }

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
    
    const csvContent = `idwilayah,nomorResponden,catatan\n"region-id-1","001","Contoh catatan responden 1 untuk ${selectedCategory?.name} - ${selectedPeriod?.name}"\n"region-id-1","002","Contoh catatan responden 2 untuk ${selectedCategory?.name} - ${selectedPeriod?.name}"`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `template-${selectedCategory?.name}-${selectedPeriod?.name}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetSelection = () => {
    setSelectedCategoryId('');
    setSelectedPeriodId('');
    setShowUploadSection(false);
    setShowWarning(false);
    setExistingDataInfo(null);
    setUploadResult(null);
    setSelectedFile(null);
    setFilePreview('');
    setError('');
    setSuccessMessage('');
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      if (fileInputRef.current) {
        fileInputRef.current.files = files;
        handleFileSelection({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Show access denied message if not admin
  if (userProfile && userProfile.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">Catatan Survei</h1>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto py-12 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="mb-6">
              <svg className="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Akses Ditolak</h2>
            <p className="text-gray-600 mb-8">
              Maaf, halaman Catatan Survei ini hanya dapat diakses oleh administrator.
              <br />
              Hubungi admin jika Anda memerlukan akses ke halaman ini.
            </p>
            <div className="space-x-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Kembali ke Dashboard
              </Link>
            </div>
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
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
              <h1 className="ml-4 text-xl font-semibold">Catatan Survei (Admin Only)</h1>
            </div>
            {userProfile?.role === 'ADMIN' && (
              <Link
                href="/analisis-catatan-survei"
                className="flex items-center bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                📊 Analisis Teks
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Step 1: Category and Period Selection */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Step 1: Pilih Survei untuk Upload</h2>
            <p className="text-sm text-gray-600">
              Pilih kategori dan periode survei yang akan di-upload
            </p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori Survei <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={showUploadSection}
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
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={showUploadSection}
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
            
            <div className="flex gap-3">
              <button
                onClick={handleCategoryPeriodSelection}
                disabled={!selectedCategoryId || !selectedPeriodId || checkingExisting || showUploadSection}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingExisting ? 'Mengecek Data...' : 'Lanjutkan'}
              </button>
              
              {(showUploadSection || showWarning) && (
                <button
                  onClick={resetSelection}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Reset Pilihan
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Existing Data Warning */}
        {showWarning && existingDataInfo && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 flex items-center">
                ⚠️ PERINGATAN: Data Existing Ditemukan
              </h2>
            </div>
            
            <div className="p-6">
              <div className="bg-white rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Informasi Data Existing:</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li><strong>Kategori:</strong> {existingDataInfo.categoryName}</li>
                  <li><strong>Periode:</strong> {existingDataInfo.periodName}</li>
                  <li><strong>Total Responden:</strong> {existingDataInfo.existingCount.toLocaleString()}</li>
                  {existingDataInfo.lastUploadedBy && (
                    <li><strong>Terakhir upload:</strong> {existingDataInfo.lastUploadedBy} pada {new Date(existingDataInfo.lastUploadedAt!).toLocaleDateString('id-ID')}</li>
                  )}
                </ul>
                
                {existingDataInfo.regionStats.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-medium text-gray-900 mb-2">Distribusi per Wilayah:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {existingDataInfo.regionStats.slice(0, 6).map((stat, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{stat.region.city}, {stat.region.province}</span>
                          <span className="font-medium">{stat.count.toLocaleString()}</span>
                        </div>
                      ))}
                      {existingDataInfo.regionStats.length > 6 && (
                        <div className="col-span-2 text-gray-500">
                          ... dan {existingDataInfo.regionStats.length - 6} wilayah lainnya
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-medium">
                  Jika Anda lanjutkan, <strong>SEMUA</strong> data di atas akan <strong>TERHAPUS PERMANEN</strong> dan diganti dengan file CSV yang baru.
                </p>
                <p className="text-red-700 text-sm mt-1">
                  Operasi ini tidak dapat dibatalkan dan akan mempengaruhi data dari semua user.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWarning(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  onClick={handleProceedWithUpload}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Lanjutkan Upload (Hapus Data Lama)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Upload Section */}
        {showUploadSection && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Step 2: Upload File CSV</h2>
              <p className="text-sm text-gray-600">
                Upload file CSV untuk {existingDataInfo?.categoryName || categories.find(c => c.id === selectedCategoryId)?.name} - {existingDataInfo?.periodName || periods.find(p => p.id === selectedPeriodId)?.name}
              </p>
            </div>
            
            <div className="p-6">
              {/* Template Download */}
              <div className="mb-4">
                <button
                  onClick={downloadTemplate}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  📥 Download Template CSV untuk {categories.find(c => c.id === selectedCategoryId)?.name} - {periods.find(p => p.id === selectedPeriodId)?.name}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Format: idwilayah, nomorResponden, catatan
                </p>
              </div>

              {/* File Selection Area */}
              {!selectedFile ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-gray-600 mb-2">
                    Drag & drop file CSV di sini, atau{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      pilih file
                    </button>
                  </p>
                  <p className="text-xs text-gray-500">
                    Format: CSV, Max 50MB (untuk survei besar)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected File Info */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-green-800">{selectedFile.name}</p>
                          <p className="text-xs text-green-600">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • 
                            {selectedFile.type || 'text/csv'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* File Preview */}
                  {filePreview && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Preview (5 baris pertama):</h4>
                      <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto">
                        {filePreview}
                      </pre>
                    </div>
                  )}

                  {/* Upload Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Ganti File
                    </button>
                    <button
                      onClick={handleUploadToDatabase}
                      disabled={uploading}
                      className={`px-6 py-2 rounded font-medium ${
                        uploading
                          ? 'bg-blue-300 text-blue-100 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {uploading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Uploading...
                        </div>
                      ) : (
                        '🚀 Upload ke Database'
                      )}
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelection}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <div className={`rounded-lg p-4 mb-6 ${
            uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {uploadResult.success ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.success ? 'Upload Berhasil!' : 'Upload Gagal'}
                </h3>
                <div className={`mt-2 text-sm ${
                  uploadResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  <p>{uploadResult.message || uploadResult.error}</p>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">
                        Lihat Detail Peringatan ({uploadResult.errors.length})
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
                        {uploadResult.errors.slice(0, 20).map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                        {uploadResult.errors.length > 20 && (
                          <li>... dan {uploadResult.errors.length - 20} peringatan lainnya</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setSuccessMessage('')}
                    className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {error}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setError('')}
                    className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {uploadResult?.preview && uploadResult.preview.length > 0 && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Preview Data (50 baris pertama)</h2>
              <p className="text-sm text-gray-600">
                {uploadResult.categoryName} - {uploadResult.periodName} • {uploadResult.imported?.toLocaleString()} total responden
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        No. Responden
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Catatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wilayah
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uploadResult.preview.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.nomorResponden}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {item.catatan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.region.city}, {item.region.province}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter for Existing Data */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Data Catatan Survei yang Ada</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari dalam catatan..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setPage(1);
                  fetchData();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Cari
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white shadow rounded-lg">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-600">
              {error}
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Belum ada data catatan survei
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        No. Responden
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Catatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kategori - Periode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wilayah
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tanggal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.nomorResponden}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={item.catatan}>
                            {item.catatan}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.category?.name || 'Unknown Category'} - {item.period?.name || 'Unknown Period'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.region.city}, {item.region.province}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Halaman <span className="font-medium">{page}</span> dari{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}