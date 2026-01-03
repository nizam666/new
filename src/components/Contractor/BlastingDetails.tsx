import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bomb,
  Calendar,
  MapPin,
  Zap,
  Target,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface BlastingRecord {
  id: string;
  date: string;
  location: string;
  ed_nos: number;
  edet_nos: number;
  nonel_3m_nos: number;
  nonel_4m_nos: number;
  pg_nos: number;
  pg_unit: string;
  material_type: string;
  rock_volume: number;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface BlastingStats {
  totalED: number;
  totalEDET: number;
  totalNONEL3m: number;
  totalNONEL4m: number;
  totalPG: number;
  remainingBalance: number;
}

export function BlastingDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<BlastingRecord[]>([]);
  const [stats, setStats] = useState<BlastingStats>({
    totalED: 0,
    totalEDET: 0,
    totalNONEL3m: 0,
    totalNONEL4m: 0,
    totalPG: 0,
    remainingBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<BlastingRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blasting_records')
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      const totalED = data?.reduce((sum, r) => sum + r.ed_nos, 0) || 0;
      const totalEDET = data?.reduce((sum, r) => sum + r.edet_nos, 0) || 0;
      const totalNONEL3m = data?.reduce((sum, r) => sum + (r.nonel_3m_nos || 0), 0) || 0;
      const totalNONEL4m = data?.reduce((sum, r) => sum + (r.nonel_4m_nos || 0), 0) || 0;
      const totalPG = data?.reduce((sum, r) => sum + r.pg_nos, 0) || 0;
      // TODO: Calculate remaining balance based on your business logic
      const remainingBalance = 0;

      setStats({
        totalED,
        totalEDET,
        totalNONEL3m,
        totalNONEL4m,
        totalPG,
        remainingBalance
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading blasting details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalED.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Total ED</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-red-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalEDET.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Total EDET</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalPG.toFixed(1)}</p>
          <p className="text-sm text-slate-600">Total PG</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Bomb className="w-5 h-5 text-purple-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalNONEL3m.toFixed(1)}</p>
          <p className="text-sm text-slate-600">NONEL 3m</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Bomb className="w-5 h-5 text-indigo-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalNONEL4m.toFixed(1)}</p>
          <p className="text-sm text-slate-600">NONEL 4m</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.remainingBalance.toFixed(2)}</p>
          <p className="text-sm text-slate-600">Remaining Balance</p>
        </div>

      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Blasting Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No blasting records found. Create your first record to get started.
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
                    <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Bomb className="w-6 h-6 text-orange-600" />
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
                      {record.material_type && (
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                            {record.material_type}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(record.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-medium text-slate-600">ED</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.ed_nos}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-medium text-slate-600">EDET</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.edet_nos}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Bomb className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-medium text-slate-600">NONEL 3m</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.nonel_3m_nos || 0}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Bomb className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-medium text-slate-600">NONEL 4m</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.nonel_4m_nos || 0}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-slate-600">PG ({record.pg_unit || 'boxes'})</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.pg_nos}</p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {record.notes && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Notes</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">{record.notes}</p>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">Submitted</span>
                      </div>
                      <p className="text-sm text-slate-600 ml-6">
                        {new Date(record.created_at).toLocaleString()}
                      </p>
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
