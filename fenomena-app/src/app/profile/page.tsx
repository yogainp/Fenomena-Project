'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'USER';
  regionId: string | null;
  region?: {
    id: string;
    province: string;
    city: string;
    regionCode: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  phenomenaCount: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/profile');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile');
      }
      
      const data: UserProfile = await response.json();
      setProfile(data);
      setFormData({
        email: data.email,
        username: data.username,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password confirmation
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    
    try {
      setFormLoading(true);
      setError('');
      setSuccess('');
      
      const updateData: any = {
        email: formData.email,
        username: formData.username,
      };
      
      // Only include password fields if user wants to change password
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          setError('Current password is required to set a new password');
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      
      const result = await response.json();
      setProfile(result.user);
      setSuccess(result.message);
      setIsEditing(false);
      
      // Clear password fields
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const cancelEdit = () => {
    if (profile) {
      setFormData({
        email: profile.email,
        username: profile.username,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">My Profile</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Back to Dashboard
                </Link>
                <h1 className="ml-4 text-xl font-semibold">My Profile</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Profile not found
            <button 
              onClick={fetchProfile}
              className="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
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
              <h1 className="ml-4 text-xl font-semibold">My Profile</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-4 text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {success}
            <button 
              onClick={() => setSuccess('')}
              className="ml-4 text-green-700 hover:text-green-900"
            >
              ×
            </button>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-6">
            {!isEditing ? (
              // View Mode
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">Username</label>
                      <p className="text-base font-medium text-gray-900">{profile.username}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-base font-medium text-gray-900">{profile.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Role</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        profile.role === 'ADMIN' 
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {profile.role}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Wilayah Asal</label>
                      <p className="text-base font-medium text-gray-900">
                        {profile.region ? `${profile.region.city} - ${profile.region.province}` : 'Tidak ada wilayah'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Account Statistics</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">Phenomena Created</label>
                      <p className="text-2xl font-bold text-blue-600">{profile.phenomenaCount}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Member Since</label>
                      <p className="text-base font-medium text-gray-900">
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Last Updated</label>
                      <p className="text-base font-medium text-gray-900">
                        {new Date(profile.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Edit Mode
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Role</label>
                        <p className="text-sm text-gray-700 mt-1">
                          {profile.role} (Role cannot be changed)
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Wilayah Asal</label>
                        <p className="text-sm text-gray-700 mt-1">
                          {profile.region ? `${profile.region.city} - ${profile.region.province}` : 'Tidak ada wilayah'} (Region cannot be changed)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Change Password (Optional)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {formLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Account Activity Card */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Account Activity</h2>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{profile.phenomenaCount}</div>
                <div className="text-sm text-gray-500">Phenomena Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {Math.floor((new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-sm text-gray-500">Days as Member</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {profile.role === 'ADMIN' ? '∞' : profile.phenomenaCount > 0 ? '★' : '○'}
                </div>
                <div className="text-sm text-gray-500">
                  {profile.role === 'ADMIN' ? 'Admin Access' : profile.phenomenaCount > 0 ? 'Active User' : 'New User'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}