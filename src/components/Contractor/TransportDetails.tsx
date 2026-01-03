import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Truck,
  Calendar,
  MapPin,
  Navigation,
  Fuel,
  Package,
  TrendingUp,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface TransportRecord {
  id: string;
  date: string;
  vehicle_number: string;
  vehicle_type: string;
  from_location: string;
  to_location: string;
  distance_km: number;
  fuel_consumed: number;
  material_transported: string;
  quantity: number;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface TransportStats {
  totalDistance: number;
  totalFuel: number;
  totalQuantity: number;
  totalTrips: number;
}

export function TransportDetails() {
  const { user } = useAuth();
  const [records, setRecords] = useState<TransportRecord[]>([]);
  const [stats, setStats] = useState<TransportStats>({
    totalDistance: 0,
    totalFuel: 0,
    totalQuantity: 0,
    totalTrips: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<TransportRecord | null>(null);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transport_records')
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setRecords(data || []);

      const totalDistance = data?.reduce((sum, r) => sum + r.distance_km, 0) || 0;
      const totalFuel = data?.reduce((sum, r) => sum + r.fuel_consumed, 0) || 0;
      const totalQuantity = data?.reduce((sum, r) => sum + r.quantity, 0) || 0;
      const totalTrips = data?.length || 0;

      setStats({
        totalDistance,
        totalFuel,
        totalQuantity,
        totalTrips
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
        <div className="text-slate-600">Loading transport details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-purple-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalDistance.toFixed(1)} km</p>
          <p className="text-sm text-slate-600">Total Distance</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Fuel className="w-5 h-5 text-red-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalFuel.toFixed(1)} L</p>
          <p className="text-sm text-slate-600">Total Fuel</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalQuantity.toFixed(1)} tons</p>
          <p className="text-sm text-slate-600">Material Transported</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalTrips}</p>
          <p className="text-sm text-slate-600">Total Trips</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Transport Records</h3>
          <p className="text-sm text-slate-600">Click on a record to view details</p>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No transport records found. Create your first record to get started.
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
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-6 h-6 text-purple-600" />
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
                      <MapPin className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-medium text-slate-600">From</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">{record.from_location}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Navigation className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-medium text-slate-600">To</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">{record.to_location}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Navigation className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-medium text-slate-600">Distance</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{record.distance_km} km</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Fuel className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-medium text-slate-600">Fuel</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{record.fuel_consumed} L</p>
                  </div>
                </div>

                {selectedRecord?.id === record.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {record.material_transported && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Material</span>
                        </div>
                        <p className="text-sm text-slate-600 ml-6">
                          {record.material_transported} - {record.quantity} tons
                        </p>
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
