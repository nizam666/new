import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Search, Calendar, RefreshCw, Users, AlertCircle, X, MapPin as MapPinIcon, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type WorkAreaFilter = 'all' | 'quarry' | 'crusher' | 'general';

type AttendanceRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
  location_in: string | null;
  location_out: string | null;
  work_area: string | null;
  created_at: string;
};

function formatTime(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), 'hh:mm a');
  } catch {
    return '—';
  }
}

function calcHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '—';
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000;
  if (diff < 0) return '—';
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return `${h}h ${m}m`;
}

export function AttendanceReportModule() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workAreaFilter, setWorkAreaFilter] = useState<WorkAreaFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('attendance_details_view')
        .select('*')
        .order('date', { ascending: false })
        .order('check_in', { ascending: false });

      if (workAreaFilter !== 'all') {
        query = query.eq('work_area', workAreaFilter);
      }
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      if (searchTerm) {
        query = query.or(`employee_id.ilike.%${searchTerm}%,employee_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  }, [workAreaFilter, dateFrom, dateTo, searchTerm]);

  const runCleanup = useCallback(async () => {
    try {
      await supabase.rpc('process_stale_attendance');
      fetchRecords();
    } catch (err) {
      console.error('Error running cleanup:', err);
    }
  }, [fetchRecords]);

  useEffect(() => {
    runCleanup();
    fetchRecords();
  }, [fetchRecords, runCleanup]);

  const workAreaTabs: { key: WorkAreaFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'slate' },
    { key: 'quarry', label: '⛏ Quarry', color: 'orange' },
    { key: 'crusher', label: '🏭 Crusher', color: 'blue' },
    { key: 'general', label: 'General', color: 'gray' },
  ];

  const getWorkAreaBadge = (area: string | null) => {
    switch (area) {
      case 'quarry':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">⛏ Quarry</span>;
      case 'crusher':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">🏭 Crusher</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">General</span>;
    }
  };

  const presentCount = records.filter(r => r.check_in && !r.check_out).length;
  const completedCount = records.filter(r => r.check_in && r.check_out).length;
  const quarryCount = records.filter(r => r.work_area === 'quarry').length;
  const crusherCount = records.filter(r => r.work_area === 'crusher').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Records', value: records.length, color: 'slate', icon: Users },
          { label: 'Checked In', value: presentCount, color: 'green', icon: Clock },
          { label: 'Quarry', value: quarryCount, color: 'orange', icon: Users },
          { label: 'Crusher', value: crusherCount, color: 'blue', icon: Users },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 md:p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 md:w-4 h-4 text-${color}-600`} />
              <p className={`text-[10px] md:text-xs font-medium text-${color}-700 uppercase tracking-wider`}>{label}</p>
            </div>
            <p className={`text-xl md:text-2xl font-bold text-${color}-900`}>{value}</p>
          </div>
        ))}

        {/* Quick Actions / Cleanup */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">System Maintenance</p>
          </div>
          <button
            onClick={runCleanup}
            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm shadow-amber-200"
          >
            Auto-Punch Out Stale
          </button>
          <p className="text-[10px] text-amber-600 mt-2 font-medium leading-tight">Closes all forgotten shifts older than 12h or from previous days.</p>
        </div>
      </div>

      {/* Work Area Tabs */}
      <div className="flex gap-2 flex-wrap">
        {workAreaTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setWorkAreaFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${workAreaFilter === tab.key
                ? tab.key === 'quarry'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : tab.key === 'crusher'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-end">
        <div className="flex-1 min-w-[180px] relative">
          <label className="block text-xs font-medium text-slate-600 mb-1">Search Employee ID</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="EMP001..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-slate-700">No attendance records found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting the filters above</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Date', 'Employee', 'Work Area', 'Check In', 'Check Out', 'Hours Worked', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(record => {
                  const isPresent = record.check_in && !record.check_out;
                  const isComplete = record.check_in && record.check_out;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                        {record.date ? format(parseISO(record.date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td
                        className="px-5 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 group transition-all"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">
                            {record.employee_name}
                          </span>
                          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                            {record.employee_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {getWorkAreaBadge(record.work_area)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {formatTime(record.check_in)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {formatTime(record.check_out)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                        {calcHours(record.check_in, record.check_out)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {isComplete ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completed</span>
                        ) : isPresent ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 animate-pulse">Present</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-500">Absent</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            Showing {records.length} record{records.length !== 1 ? 's' : ''}
            {completedCount > 0 && ` · ${completedCount} completed`}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedRecord.employee_name}</h3>
                  <p className="text-sm text-slate-500 uppercase tracking-widest font-mono font-semibold">{selectedRecord.employee_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">Punch In</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 italic">{formatTime(selectedRecord.check_in)}</p>
                  <p className="text-xs text-slate-400 mt-1">{selectedRecord.date ? format(parseISO(selectedRecord.date), 'dd MMM yyyy') : ''}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">Punch Out</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 italic">{formatTime(selectedRecord.check_out) || 'Active Shift'}</p>
                  <p className="text-xs text-slate-400 mt-1">{calcHours(selectedRecord.check_in, selectedRecord.check_out) !== '—' ? `Total: ${calcHours(selectedRecord.check_in, selectedRecord.check_out)}` : 'In Progress'}</p>
                </div>
              </div>

              {/* Photos Grid */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  Visual Logs
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Check-in Photo</p>
                    <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner">
                      {selectedRecord.check_in_photo ? (
                        <img src={selectedRecord.check_in_photo} alt="Punch In" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">No Photo</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Check-out Photo</p>
                    <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner">
                      {selectedRecord.check_out_photo ? (
                        <img src={selectedRecord.check_out_photo} alt="Punch Out" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">No Photo</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Data - Embedded Maps */}
              {(selectedRecord.location_in || selectedRecord.location_out) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-rose-500" />
                    Live Location Map
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRecord.location_in && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Login Location</p>
                          <a
                            href={`https://www.google.com/maps?q=${selectedRecord.location_in}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            Open Maps <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all hover:shadow-md">
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://maps.google.com/maps?q=${selectedRecord.location_in}&t=k&z=18&output=embed`}
                            className="contrast-[110%]"
                          ></iframe>
                        </div>
                      </div>
                    )}
                    {selectedRecord.location_out && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logout Location</p>
                          <a
                            href={`https://www.google.com/maps?q=${selectedRecord.location_out}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            Open Maps <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all hover:shadow-md">
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://maps.google.com/maps?q=${selectedRecord.location_out}&t=k&z=18&output=embed`}
                            className="contrast-[110%]"
                          ></iframe>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
