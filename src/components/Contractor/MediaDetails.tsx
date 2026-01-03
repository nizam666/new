import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Camera,
  Video,
  Calendar,
  MapPin,
  Image,
  Film,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface MediaRecord {
  id: string;
  record_type: string;
  media_type: string;
  media_url: string;
  title: string;
  description: string;
  location: string;
  date_taken: string;
  created_at: string;
}

interface MediaStats {
  totalPhotos: number;
  totalVideos: number;
  totalMedia: number;
  thisMonth: number;
}

export function MediaDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [stats, setStats] = useState<MediaStats>({
    totalPhotos: 0,
    totalVideos: 0,
    totalMedia: 0,
    thisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MediaRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date_taken', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      const totalPhotos = data?.filter(r => r.media_type === 'photo').length || 0;
      const totalVideos = data?.filter(r => r.media_type === 'video').length || 0;
      const totalMedia = data?.length || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const thisMonth = data?.filter(r => {
        const recordDate = new Date(r.date_taken);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      }).length || 0;

      setStats({
        totalPhotos,
        totalVideos,
        totalMedia,
        thisMonth
      });
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filteredRecords = records.filter(record => {
    if (filter === 'all') return true;
    return record.media_type === filter;
  });

  const getCategoryBadge = (category: string) => {
    const colors: { [key: string]: string } = {
      drilling: 'bg-blue-100 text-blue-700',
      blasting: 'bg-orange-100 text-orange-700',
      loading: 'bg-green-100 text-green-700',
      transport: 'bg-purple-100 text-purple-700',
      general: 'bg-slate-100 text-slate-700'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${colors[category] || colors.general}`}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading media...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
              <Image className="w-5 h-5 text-pink-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalPhotos}</p>
          <p className="text-sm text-slate-600">Total Photos</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Film className="w-5 h-5 text-purple-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalVideos}</p>
          <p className="text-sm text-slate-600">Total Videos</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalMedia}</p>
          <p className="text-sm text-slate-600">Total Media</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.thisMonth}</p>
          <p className="text-sm text-slate-600">This Month</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Photos & Videos</h3>
              <p className="text-sm text-slate-600">Click on an item to view details</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('photo')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'photo'
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                Photos
              </button>
              <button
                onClick={() => setFilter('video')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'video'
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                Videos
              </button>
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No media records found. Upload your first photo or video to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${record.media_type === 'photo' ? 'bg-pink-100' : 'bg-purple-100'} flex items-center justify-center flex-shrink-0`}>
                      {record.media_type === 'photo' ? (
                        <Camera className="w-6 h-6 text-pink-600" />
                      ) : (
                        <Video className="w-6 h-6 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{record.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-0.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(record.date_taken).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  {getCategoryBadge(record.record_type)}
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-600">
                  {record.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {record.location}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {record.media_type === 'photo' ? (
                      <Camera className="w-4 h-4" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                    {record.media_type}
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {record.description && (
                      <div>
                        <p className="text-sm text-slate-600 mb-3">{record.description}</p>
                      </div>
                    )}

                    {record.media_type === 'photo' ? (
                      <div className="rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={record.media_url}
                          alt={record.title}
                          className="w-full h-auto object-contain max-h-96"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="p-4 text-center text-slate-600">
                                  <p class="text-sm">Image failed to load</p>
                                  <a href="${record.media_url}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
                                    Try opening in new tab →
                                  </a>
                                </div>
                              `;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-slate-200">
                        <video
                          src={record.media_url}
                          controls
                          className="w-full h-auto max-h-96"
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="p-4 text-center text-slate-600">
                                  <p class="text-sm">Video failed to load</p>
                                  <a href="${record.media_url}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
                                    Try opening in new tab →
                                  </a>
                                </div>
                              `;
                            }
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}

                    <div className="bg-slate-100 rounded-lg p-3">
                      <a
                        href={record.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 break-all"
                      >
                        Open in new tab →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
