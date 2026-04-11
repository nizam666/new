import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, HardHat, Clock, Calendar, MapPin, Fuel, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

type JCBRecord = {
  id: string;
  date: string;
  work_type: string;
  driver_name: string;
  location: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  fuel_consumed: number;
  licence_number: string | null;
  work_description: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export function JCBOperationsDetails({ workArea }: { workArea?: 'quarry' | 'crusher' }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<JCBRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('jcb_operations')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (user?.role !== 'director') {
        query = query.eq('contractor_id', user?.id);
      }

      if (workArea) {
        query = query.eq('work_area', workArea);
      }

      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      if (searchTerm) {
        query = query.or(
          `work_type.ilike.%${searchTerm}%,
           driver_name.ilike.%${searchTerm}%,
           licence_number.ilike.%${searchTerm}%,
           location.ilike.%${searchTerm}%,
           work_description.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching JCB records:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [user, dateFilter, searchTerm]);

  useEffect(() => {
    if (user) {
      fetchRecords();
    }
  }, [user, fetchRecords]);

  const handleRefresh = () => {
    fetchRecords();
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {workArea === 'quarry' ? 'Quarry ' : workArea === 'crusher' ? 'Crusher ' : ''}JCB Operations
            </h2>
            <p className="text-sm text-slate-500">View and manage {workArea ? workArea : ''} JCB operations</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent w-full sm:w-64"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <button
            onClick={() => window.location.hash = `${workArea}-jcb-operations`}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <HardHat className="w-4 h-4" />
            Add New Record
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <HardHat className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No JCB records found</h3>
          <p className="mt-1 text-sm text-slate-500">Get started by creating a new record.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Work Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Licence No
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Diesel (L)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                        <div className="text-sm font-medium text-slate-900">
                          {format(new Date(record.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{record.work_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{record.driver_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500">{record.licence_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-slate-400 mr-2" />
                        <div className="text-sm text-slate-500">{record.location}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-slate-400 mr-2" />
                        <div className="text-sm text-slate-900 font-medium">
                          {record.start_time} - {record.end_time}
                          <div className="text-xs text-slate-500 font-normal mt-1">Total: {parseFloat(record.total_hours.toString()).toFixed(1)} hours</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Fuel className="h-4 w-4 text-slate-400 mr-2" />
                        <div className="text-sm text-slate-900">
                          {record.fuel_consumed} L
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
