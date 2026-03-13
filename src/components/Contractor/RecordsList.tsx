import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, CheckCircle, XCircle, Calendar, MapPin } from 'lucide-react';

interface Record {
  id: string;
  date: string;
  location: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  notes?: string;
  // Specific fields for different record types
  holes_drilled?: number;
  total_depth?: number;
  equipment_used?: string;
  explosive_used?: number;
  detonators_used?: number;
  rock_volume?: number;
  material_type?: string;
  quantity_loaded?: number;
  vehicle_number?: string;
  destination?: string;
}

interface RecordsListProps {
  type: 'drilling' | 'blasting' | 'loading';
}

export function RecordsList({ type }: RecordsListProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const tableName = `${type}_records`;
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  }, [type, user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const getRecordDetails = (record: Record) => {
    switch (type) {
      case 'drilling':
        return (
          <div className="text-sm text-slate-600 space-y-1">
            <p>Holes: {record.holes_drilled} | Depth: {record.total_depth}m</p>
            {record.equipment_used && <p>Equipment: {record.equipment_used}</p>}
          </div>
        );
      case 'blasting':
        return (
          <div className="text-sm text-slate-600 space-y-1">
            <p>Explosive: {record.explosive_used}kg | Detonators: {record.detonators_used}</p>
            <p>Rock Volume: {record.rock_volume}m³</p>
          </div>
        );
      case 'loading':
        return (
          <div className="text-sm text-slate-600 space-y-1">
            <p>Material: {record.material_type} | Quantity: {record.quantity_loaded} tons</p>
            <p>Vehicle: {record.vehicle_number} → {record.destination}</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-slate-600">Loading records...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-slate-600">No records found. Create your first record to get started.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div
          key={record.id}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-slate-600" />
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
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  {record.location}
                </div>
              </div>
            </div>
            {getStatusBadge(record.status)}
          </div>

          {getRecordDetails(record)}

          {record.notes && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Notes:</span> {record.notes}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
