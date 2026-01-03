import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Fuel,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface FuelRecord {
  id: string;
  date: string;
  vehicle_number: string;
  vehicle_type: string;
  fuel_type: string;
  quantity_liters: number;
  cost_per_liter: number;
  total_cost: number;
  odometer_reading: number | null;
  supplier: string;
  receipt_number: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface FuelStats {
  totalLiters: number;
  totalCost: number;
  averageCostPerLiter: number;
  totalRecords: number;
}

export function FuelDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [stats, setStats] = useState<FuelStats>({
    totalLiters: 0,
    totalCost: 0,
    averageCostPerLiter: 0,
    totalRecords: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<FuelRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      const totalLiters = data?.reduce((sum, r) => sum + r.quantity_liters, 0) || 0;
      const totalCost = data?.reduce((sum, r) => sum + r.total_cost, 0) || 0;
      const averageCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

      setStats({
        totalLiters,
        totalCost,
        averageCostPerLiter,
        totalRecords: data?.length || 0
      });
    } catch (error) {
      console.error('Error loading fuel records:', error);
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
        <div className="text-slate-600">Loading fuel records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Fuel className="w-5 h-5 text-amber-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalLiters.toFixed(1)} L</p>
          <p className="text-sm text-slate-600">Total Fuel</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{stats.totalCost.toFixed(2)}</p>
          <p className="text-sm text-slate-600">Total Cost</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{stats.averageCostPerLiter.toFixed(2)}</p>
          <p className="text-sm text-slate-600">Avg Cost/Liter</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalRecords}</p>
          <p className="text-sm text-slate-600">Total Records</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Fuel Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No fuel records found. Create your first record to get started.
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
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Fuel className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {record.vehicle_number} - {record.vehicle_type}
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
                  {getStatusBadge(record.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Fuel className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-slate-600">Fuel Type</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{record.fuel_type}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Fuel className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-600">Quantity</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{record.quantity_liters} L</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-slate-600">Cost/L</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">₹{record.cost_per_liter}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-slate-600">Total</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">₹{record.total_cost.toFixed(2)}</p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {record.odometer_reading && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Odometer: </span>
                        <span className="text-sm text-slate-600">{record.odometer_reading} km</span>
                      </div>
                    )}

                    {record.supplier && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Supplier: </span>
                        <span className="text-sm text-slate-600">{record.supplier}</span>
                      </div>
                    )}

                    {record.receipt_number && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Receipt #: </span>
                        <span className="text-sm text-slate-600">{record.receipt_number}</span>
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
        )}
      </div>
    </div>
  );
}
