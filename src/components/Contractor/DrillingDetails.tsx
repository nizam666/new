import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Drill,
  Calendar,
  MapPin,
  Ruler,
  Circle,
  Fuel,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface DrillingRecord {
  id: string;
  date: string;
  location: string;
  holes_drilled: number;
  total_depth: number;
  equipment_used: string;
  diesel_consumed: number;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface DrillingStats {
  totalHoles: number;
  totalDepth: number;
  totalDiesel: number;
  averageDepthPerHole: number;
}

export function DrillingDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<DrillingRecord[]>([]);
  const [stats, setStats] = useState<DrillingStats>({
    totalHoles: 0,
    totalDepth: 0,
    totalDiesel: 0,
    averageDepthPerHole: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DrillingRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drilling_records')
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      const totalHoles = data?.reduce((sum, r) => sum + r.holes_drilled, 0) || 0;
      const totalDepth = data?.reduce((sum, r) => sum + r.total_depth, 0) || 0;
      const totalDiesel = data?.reduce((sum, r) => sum + r.diesel_consumed, 0) || 0;
      const averageDepthPerHole = totalHoles > 0 ? totalDepth / totalHoles : 0;

      setStats({
        totalHoles,
        totalDepth,
        totalDiesel,
        averageDepthPerHole
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
        <div className="text-slate-600">Loading drilling details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Circle className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalHoles}</p>
          <p className="text-sm text-slate-600">Total Holes Drilled</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-emerald-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalDepth.toFixed(1)}m</p>
          <p className="text-sm text-slate-600">Total Depth</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Fuel className="w-5 h-5 text-orange-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalDiesel.toFixed(1)}L</p>
          <p className="text-sm text-slate-600">Diesel Consumed</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Drill className="w-5 h-5 text-violet-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.averageDepthPerHole.toFixed(1)}m</p>
          <p className="text-sm text-slate-600">Avg Depth/Hole</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Drilling Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No drilling records found. Create your first record to get started.
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
                      <Drill className="w-6 h-6 text-blue-600" />
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
                  {getStatusBadge(record.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Circle className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-600">Holes</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.holes_drilled}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Ruler className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-medium text-slate-600">Depth</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.total_depth}m</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Fuel className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-medium text-slate-600">Diesel</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.diesel_consumed}L</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Drill className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-medium text-slate-600">Avg/Hole</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {(record.total_depth / record.holes_drilled).toFixed(1)}m
                    </p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {record.equipment_used && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Drill className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Equipment Used</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">{record.equipment_used}</p>
                      </div>
                    )}

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
