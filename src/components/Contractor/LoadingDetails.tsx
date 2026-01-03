import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Truck,
  Calendar,
  Package,
  Navigation,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface LoadingRecord {
  id: string;
  date: string;
  material_type: string;
  vehicle_used: string;
  vehicle_owner_name: string;
  destination: string;
  breaker_bucket: string;
  starting_hours: number;
  ending_hours: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface LoadingStats {
  totalHoursWork: number;
  uniqueOwners: number;
  uniqueVehicleTypes: number;
}

export function LoadingDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [stats, setStats] = useState<LoadingStats>({
    totalHoursWork: 0,
    uniqueOwners: 0,
    uniqueVehicleTypes: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<LoadingRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loading_records')
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      // Calculate total hours work (ending_hours - starting_hours for each record)
      const totalHoursWork = data?.reduce((sum, r) => {
        const hoursWorked = (r.ending_hours || 0) - (r.starting_hours || 0);
        return sum + (hoursWorked > 0 ? hoursWorked : 0);
      }, 0) || 0;
      const uniqueOwners = new Set(data?.map(r => r.vehicle_owner_name).filter(Boolean)).size;
      const uniqueVehicleTypes = new Set(data?.map(r => r.vehicle_used).filter(Boolean)).size;

      setStats({
        totalHoursWork,
        uniqueOwners,
        uniqueVehicleTypes
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
        <div className="text-slate-600">Loading breaking/loading details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalHoursWork.toFixed(1)} hrs</p>
          <p className="text-sm text-slate-600">Total Hours Work</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.uniqueVehicleTypes}</p>
          <p className="text-sm text-slate-600">Vehicle Types Used</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Hash className="w-5 h-5 text-violet-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.uniqueOwners}</p>
          <p className="text-sm text-slate-600">Unique Vehicle Owners</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Breaking/Loading Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No breaking/loading records found. Create your first record to get started.
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
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-6 h-6 text-green-600" />
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
                        <Package className="w-4 h-4" />
                        {record.material_type}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(record.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-slate-600">Vehicle Used</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.vehicle_used || 'N/A'}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-600">Owner</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{record.vehicle_owner_name || 'N/A'}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 md:col-span-1 col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Navigation className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-medium text-slate-600">Destination</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 truncate">{record.destination}</p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Navigation className="w-4 h-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">Full Destination</span>
                      </div>
                      <p className="text-sm text-slate-600 ml-6">{record.destination}</p>
                    </div>

                    {record.breaker_bucket && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Breaker/Bucket</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">
                          {record.breaker_bucket}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Starting Hours</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">
                          {record.starting_hours || 0} hrs
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Ending Hours</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">
                          {record.ending_hours || 0} hrs
                        </p>
                      </div>
                    </div>

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
