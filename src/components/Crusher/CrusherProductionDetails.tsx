import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Factory, Calendar, TrendingUp, Clock, AlertCircle, Play, Pause, AlertTriangle } from 'lucide-react';

interface ProductionRecord {
  id: string;
  date: string;
  material_input: number;
  output_20mm: number;
  output_40mm: number;
  output_dust: number;
  total_output: number;
  working_hours: number;
  downtime_hours: number;
  product_type: string;
  status: string;
  maintenance_notes: string;
  notes: string;
  created_at: string;
}

interface CrusherSession {
  crusher_type: 'jaw' | 'vsi';
  mode: 'idle' | 'production' | 'breakdown';
  production_start: string | null;
  production_end: string | null;
  breakdown_start: string | null;
  material_source: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function CrusherProductionDetails() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [crusherSessions, setCrusherSessions] = useState<CrusherSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ProductionRecord | null>(null);
  const [runningTime, setRunningTime] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchRecords();
    fetchCrusherSessions();

    // Subscribe to real-time changes
    const sessionsSubscription = supabase
      .channel('crusher_sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'crusher_active_sessions'
      }, (payload) => {
        console.log('Crusher session change:', payload);
        fetchCrusherSessions();
      })
      .subscribe();

    return () => {
      sessionsSubscription.unsubscribe();
    };
  }, []);

  // Update running timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newRunningTime: { [key: string]: string } = {};

      crusherSessions.forEach(session => {
        if (session.mode === 'production' && session.production_start) {
          const startTime = new Date(session.production_start);
          const now = new Date();
          const diff = now.getTime() - startTime.getTime();

          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          newRunningTime[session.crusher_type] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      });

      setRunningTime(newRunningTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [crusherSessions]);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('production_records')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching production records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCrusherSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('crusher_active_sessions')
        .select('*');

      if (error) throw error;
      setCrusherSessions(data || []);
    } catch (error) {
      console.error('Error fetching crusher sessions:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-amber-100 text-amber-800';
      case 'breakdown':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const calculateStats = () => {
    const totalInput = records.reduce((sum, r) => sum + r.material_input, 0);
    const totalOutput = records.reduce((sum, r) => sum + (r.total_output || 0), 0);
    const totalHours = records.reduce((sum, r) => sum + r.working_hours, 0);
    const avgEfficiency = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
    return { totalInput, totalOutput, totalHours, avgEfficiency };
  };

  const getCrusherStatusColor = (mode: string) => {
    switch (mode) {
      case 'production':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'breakdown':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'idle':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCrusherIcon = (mode: string) => {
    switch (mode) {
      case 'production':
        return <Play className="w-5 h-5 text-green-600" />;
      case 'breakdown':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'idle':
        return <Pause className="w-5 h-5 text-slate-600" />;
      default:
        return <Factory className="w-5 h-5 text-slate-600" />;
    }
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading production records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Crusher Sessions - Real-time */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Factory className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Active Crusher Sessions</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            Real-time • {crusherSessions.length} active
          </span>
        </div>

        {crusherSessions.length === 0 ? (
          <div className="text-center py-8">
            <Factory className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No active crusher sessions</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crusherSessions.map((session) => (
              <div
                key={session.crusher_type}
                className={`p-4 rounded-lg border-2 transition-all ${getCrusherStatusColor(session.mode)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getCrusherIcon(session.mode)}
                    <div>
                      <h4 className="font-semibold text-lg capitalize">
                        {session.crusher_type.toUpperCase()} Crusher
                      </h4>
                      <p className="text-sm opacity-75 capitalize">{session.mode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono font-bold">
                      {runningTime[session.crusher_type] || '00:00:00'}
                    </div>
                    {session.mode === 'production' && (
                      <div className="text-xs opacity-75">Running</div>
                    )}
                  </div>
                </div>

                {session.material_source && (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Source: </span>
                    <span className="text-sm">{session.material_source}</span>
                  </div>
                )}

                {session.production_start && session.mode === 'production' && (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Started: </span>
                    <span className="text-sm">
                      {new Date(session.production_start).toLocaleString()}
                    </span>
                  </div>
                )}

                {session.breakdown_start && session.mode === 'breakdown' && (
                  <div className="mb-2">
                    <span className="text-sm font-medium">Breakdown: </span>
                    <span className="text-sm">
                      {new Date(session.breakdown_start).toLocaleString()}
                    </span>
                  </div>
                )}

                {session.notes && (
                  <div className="text-sm opacity-75 italic">
                    "{session.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-3">
            <Factory className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-xs text-orange-600 font-medium">Total Input</p>
              <p className="text-xl font-bold text-orange-900">{stats.totalInput.toFixed(2)} T</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-xs text-green-600 font-medium">Total Output</p>
              <p className="text-xl font-bold text-green-900">{stats.totalOutput.toFixed(2)} T</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600 font-medium">Working Hours</p>
              <p className="text-xl font-bold text-blue-900">{stats.totalHours.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-xs text-purple-600 font-medium">Efficiency</p>
              <p className="text-xl font-bold text-purple-900">{stats.avgEfficiency.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <Factory className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No production records found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Production Records</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {records.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Factory className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Production - {new Date(record.date).toLocaleDateString()}
                      </h4>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                    {record.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Input</p>
                    <p className="text-sm font-bold text-slate-900">{record.material_input} T</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Output 20mm</p>
                    <p className="text-sm font-bold text-slate-900">{record.output_20mm || 0} T</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Output 40mm</p>
                    <p className="text-sm font-bold text-slate-900">{record.output_40mm || 0} T</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Output Dust</p>
                    <p className="text-sm font-bold text-slate-900">{record.output_dust || 0} T</p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm font-medium text-slate-700">Total Output: </span>
                        <span className="text-sm text-slate-900 font-bold">{record.total_output || 0} T</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700">Working Hours: </span>
                        <span className="text-sm text-slate-900">{record.working_hours} hrs</span>
                      </div>
                      {record.downtime_hours > 0 && (
                        <div>
                          <span className="text-sm font-medium text-slate-700">Downtime: </span>
                          <span className="text-sm text-red-600">{record.downtime_hours} hrs</span>
                        </div>
                      )}
                    </div>

                    {record.maintenance_notes && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Maintenance: </span>
                        <p className="text-sm text-slate-600 mt-1">{record.maintenance_notes}</p>
                      </div>
                    )}

                    {record.notes && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Notes: </span>
                        <p className="text-sm text-slate-600 mt-1">{record.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
