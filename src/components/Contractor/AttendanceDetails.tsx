import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Clock,
  Calendar,
  MapPin,
  Briefcase,
  TrendingUp,
  BarChart3,
  Users
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  location: string;
  work_type: string;
  notes: string;
  status: string;
  worker_ids: string[];
  number_of_workers: number;
  worker_names: string[];
  created_at: string;
}

interface AttendanceStats {
  totalDays: number;
  totalHours: number;
  averageHours: number;
  thisMonth: number;
  totalWorkers: number;
  averageWorkersPerDay: number;
}

export function AttendanceDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    totalHours: 0,
    averageHours: 0,
    thisMonth: 0,
    totalWorkers: 0,
    averageWorkersPerDay: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      let totalHours = 0;
      const currentMonth = new Date().getMonth();
      let thisMonthCount = 0;
      let totalWorkerCount = 0;

      data?.forEach((record) => {
        if (record.check_in && record.check_out) {
          const checkIn = new Date(record.check_in);
          const checkOut = new Date(record.check_out);
          const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }

        const recordMonth = new Date(record.date).getMonth();
        if (recordMonth === currentMonth) {
          thisMonthCount++;
        }

        if (record.number_of_workers) {
          totalWorkerCount += record.number_of_workers;
        }
      });

      const totalDays = data?.length || 0;
      const averageHours = totalDays > 0 ? totalHours / totalDays : 0;
      const averageWorkersPerDay = totalDays > 0 ? totalWorkerCount / totalDays : 0;

      // Get unique workers count
      const allWorkerIds = new Set<string>();
      data?.forEach((record) => {
        if (record.worker_ids && Array.isArray(record.worker_ids)) {
          record.worker_ids.forEach((id: string) => allWorkerIds.add(id));
        }
      });

      setStats({
        totalDays,
        totalHours,
        averageHours,
        thisMonth: thisMonthCount,
        totalWorkers: allWorkerIds.size,
        averageWorkersPerDay
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

  const calculateWorkHours = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return 'In Progress';

    const inTime = new Date(checkIn);
    const outTime = new Date(checkOut);
    const hours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);

    return `${hours.toFixed(1)} hrs`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading attendance details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalDays}</p>
          <p className="text-sm text-slate-600">Total Days</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalHours.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Total Hours</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.averageHours.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Avg Hours/Day</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.thisMonth}</p>
          <p className="text-sm text-slate-600">This Month</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalWorkers}</p>
          <p className="text-sm text-slate-600">Total Workers</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-pink-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.averageWorkersPerDay.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Avg Workers/Day</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Attendance Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No attendance records found. Create your first record to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {records.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </h4>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5">
                        <MapPin className="w-4 h-4" />
                        {record.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">
                      <Users className="w-3 h-3" />
                      {record.number_of_workers || 0} Workers
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      {record.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-slate-600">Check In</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {new Date(record.check_in).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-medium text-slate-600">Check Out</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {record.check_out
                        ? new Date(record.check_out).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                        : '-'}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-600">Hours</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {calculateWorkHours(record.check_in, record.check_out)}
                    </p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">Work Type</span>
                      </div>
                      <p className="text-sm text-slate-600 ml-6">{record.work_type}</p>
                    </div>

                    {record.worker_names && record.worker_names.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">
                            Workers ({record.worker_names.length})
                          </span>
                        </div>
                        <div className="ml-6 flex flex-wrap gap-2">
                          {record.worker_names.map((name, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {record.notes && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Notes</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">{record.notes}</p>
                      </div>
                    )}
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
