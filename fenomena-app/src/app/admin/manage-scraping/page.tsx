'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { makeAuthenticatedRequest } from '@/lib/client-auth';

interface Schedule {
  id: string;
  name: string;
  portalUrl: string;
  maxPages: number;
  delayMs: number;
  cronSchedule: string;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  totalSchedules: number;
  activeSchedules: number;
  runningJobs: number;
}

interface ScheduleFormData {
  name: string;
  portalUrl: string;
  maxPages: number;
  delayMs: number;
  cronSchedule: string;
  isActive: boolean;
}

// Available portals (same as in service)
const AVAILABLE_PORTALS = [
  {
    name: 'Pontianak Post',
    url: 'https://pontianakpost.jawapos.com/daerah',
    description: 'Portal berita daerah Pontianak Post'
  },
  {
    name: 'Kalbar Online', 
    url: 'https://kalbaronline.com/berita-daerah/',
    description: 'Portal berita daerah Kalbar Online'
  },
  {
    name: 'Antara News Kalbar',
    url: 'https://kalbar.antaranews.com/kalbar',
    description: 'Portal berita Antara News Kalimantan Barat'
  },
  {
    name: 'Suara Kalbar',
    url: 'https://www.suarakalbar.co.id/category/kalbar/',
    description: 'Portal berita daerah Suara Kalbar'
  }
];

// Common cron expressions
const COMMON_CRON_SCHEDULES = [
  { label: 'Setiap hari jam 8 pagi', value: '0 8 * * *' },
  { label: 'Setiap hari jam 12 siang', value: '0 12 * * *' },
  { label: 'Setiap hari jam 6 sore', value: '0 18 * * *' },
  { label: 'Setiap 6 jam', value: '0 */6 * * *' },
  { label: 'Setiap 12 jam', value: '0 */12 * * *' },
  { label: 'Setiap Senin jam 9 pagi', value: '0 9 * * 1' },
  { label: 'Custom', value: 'custom' }
];

export default function ManageScrapingPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    portalUrl: AVAILABLE_PORTALS[0].url,
    maxPages: 5,
    delayMs: 2000,
    cronSchedule: '0 8 * * *',
    isActive: true
  });
  
  const [selectedCronTemplate, setSelectedCronTemplate] = useState('0 8 * * *');
  const [customCron, setCustomCron] = useState('');

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await makeAuthenticatedRequest('/api/admin/manage-scraping');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch schedules`);
      }
      
      const data = await response.json();
      setSchedules(data.schedules || []);
      setStatistics(data.statistics || {
        totalSchedules: 0,
        activeSchedules: 0,
        runningJobs: 0
      });
      
    } catch (err: unknown) {
      console.error('Fetch schedules error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load schedules: ${errorMessage}`);
      setSchedules([]);
      setStatistics({ totalSchedules: 0, activeSchedules: 0, runningJobs: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError('');
      setSuccessMessage('');
      
      // Use custom cron if template is 'custom'
      const finalCronSchedule = selectedCronTemplate === 'custom' ? customCron : selectedCronTemplate;
      
      const submitData = {
        ...formData,
        cronSchedule: finalCronSchedule
      };
      
      const url = editingSchedule 
        ? `/api/admin/manage-scraping/${editingSchedule.id}`
        : '/api/admin/manage-scraping';
      
      const method = editingSchedule ? 'PUT' : 'POST';
      
      const response = await makeAuthenticatedRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save schedule');
      }
      
      const data = await response.json();
      setSuccessMessage(editingSchedule ? 'Schedule updated successfully!' : 'Schedule created successfully!');
      
      // Reset form and refresh
      resetForm();
      fetchSchedules();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      portalUrl: schedule.portalUrl,
      maxPages: schedule.maxPages,
      delayMs: schedule.delayMs,
      cronSchedule: schedule.cronSchedule,
      isActive: schedule.isActive
    });
    
    // Set cron template
    const template = COMMON_CRON_SCHEDULES.find(t => t.value === schedule.cronSchedule);
    if (template) {
      setSelectedCronTemplate(template.value);
      setCustomCron('');
    } else {
      setSelectedCronTemplate('custom');
      setCustomCron(schedule.cronSchedule);
    }
    
    setShowForm(true);
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }
    
    try {
      setError('');
      setSuccessMessage('');
      
      const response = await makeAuthenticatedRequest(`/api/admin/manage-scraping/${scheduleId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }
      
      setSuccessMessage('Schedule deleted successfully!');
      fetchSchedules();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  const handleToggle = async (scheduleId: string) => {
    try {
      setError('');
      setSuccessMessage('');
      
      const response = await makeAuthenticatedRequest(`/api/admin/manage-scraping/${scheduleId}/toggle`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle schedule');
      }
      
      const data = await response.json();
      setSuccessMessage(data.message);
      fetchSchedules();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setFormData({
      name: '',
      portalUrl: AVAILABLE_PORTALS[0].url,
      maxPages: 5,
      delayMs: 2000,
      cronSchedule: '0 8 * * *',
      isActive: true
    });
    setSelectedCronTemplate('0 8 * * *');
    setCustomCron('');
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A';
      
      // Create date object from the ISO string
      const date = new Date(dateString);
      
      // Ensure we have a valid date
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      // Format with explicit Indonesia timezone - FIXED VERSION
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch (error) {
      console.error('formatDate error:', error, 'for input:', dateString);
      return 'Error';
    }
  };

  const getPortalName = (url: string) => {
    const portal = AVAILABLE_PORTALS.find(p => p.url === url);
    return portal ? portal.name : 'Unknown Portal';
  };

  const getCronDescription = (cronExpression: string) => {
    const template = COMMON_CRON_SCHEDULES.find(t => t.value === cronExpression);
    return template ? template.label : cronExpression;
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
                <h1 className="ml-4 text-xl font-semibold">Manage Scraping Schedules</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
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
              <h1 className="ml-4 text-xl font-semibold">Manage Scraping Schedules</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/scrapping-berita"
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Manual Scraping
              </Link>
              <Link 
                href="/admin/scrapping-keywords"
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Manage Keywords
              </Link>
              <button
                onClick={() => setShowForm(true)}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Add Schedule
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
            <button 
              onClick={() => setSuccessMessage('')}
              className="ml-4 text-green-700 hover:text-green-900"
            >
              ×
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">S</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Schedules</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.totalSchedules}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">A</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Schedules</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.activeSchedules}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">R</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Running Jobs</dt>
                      <dd className="text-lg font-medium text-gray-900">{statistics.runningJobs}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">
                {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Daily Pontianak Post"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portal</label>
                  <select
                    value={formData.portalUrl}
                    onChange={(e) => setFormData({ ...formData, portalUrl: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {AVAILABLE_PORTALS.map((portal, index) => (
                      <option key={index} value={portal.url}>
                        {portal.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <select
                    value={selectedCronTemplate}
                    onChange={(e) => {
                      setSelectedCronTemplate(e.target.value);
                      if (e.target.value !== 'custom') {
                        setFormData({ ...formData, cronSchedule: e.target.value });
                        setCustomCron('');
                      }
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {COMMON_CRON_SCHEDULES.map((schedule, index) => (
                      <option key={index} value={schedule.value}>
                        {schedule.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCronTemplate === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Cron Expression</label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => {
                        setCustomCron(e.target.value);
                        setFormData({ ...formData, cronSchedule: e.target.value });
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 0 8 * * *"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={formData.maxPages}
                      onChange={(e) => setFormData({ ...formData, maxPages: parseInt(e.target.value) || 5 })}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delay (ms)</label>
                    <input
                      type="number"
                      min="1000"
                      max="10000"
                      step="500"
                      value={formData.delayMs}
                      onChange={(e) => setFormData({ ...formData, delayMs: parseInt(e.target.value) || 2000 })}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    {editingSchedule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Schedules Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Scraping Schedules</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Portal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{schedule.name}</div>
                        <div className="text-sm text-gray-500">{schedule.maxPages} pages, {schedule.delayMs}ms delay</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getPortalName(schedule.portalUrl)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getCronDescription(schedule.cronSchedule)}</div>
                        <div className="text-xs text-gray-500">{schedule.cronSchedule}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {schedule.lastRun ? formatDate(schedule.lastRun) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {schedule.nextRun ? formatDate(schedule.nextRun) : 'Not scheduled'} {/* Updated timezone format */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          schedule.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleToggle(schedule.id)}
                          className={`${
                            schedule.isActive 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {schedule.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(schedule)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <div className="text-gray-500">No schedules found</div>
                      <p className="text-sm text-gray-400 mt-2">Create your first scraping schedule</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}