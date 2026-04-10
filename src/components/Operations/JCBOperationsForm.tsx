import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, AlertCircle, HardHat, Calendar, ChevronDown, TrendingUp, Fuel } from 'lucide-react';
import { toast } from 'react-toastify';

export function JCBOperationsForm({ onSuccess, workArea }: { onSuccess?: () => void, workArea?: 'quarry' | 'crusher' }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    work_type: '',
    driver_name: '',
    start_time: '',
    end_time: '',
    total_hours: '',
    fuel_consumed: '',
    work_description: '',
    notes: ''
  });

  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth());
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [summaryTotals, setSummaryTotals] = useState({ hours: 0, fuel: 0, records: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialNameSet, setInitialNameSet] = useState(false);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchSummary = async () => {
    if (!user) return;
    setSummaryLoading(true);

    try {
      const firstDay = new Date(summaryYear, summaryMonth, 1);
      const lastDay = new Date(summaryYear, summaryMonth + 1, 0);
      const fromStr = firstDay.toISOString().split('T')[0];
      const toStr = lastDay.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('jcb_operations')
        .select('date, start_time, end_time, total_hours, fuel_consumed')
        .eq('contractor_id', user.id)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        const grouped: Record<string, any> = {};
        let totalHours = 0;
        let totalFuel = 0;
        let totalRecords = 0;

        data.forEach((row: any) => {
          if (!grouped[row.date]) {
            grouped[row.date] = {
              date: row.date,
              start: row.start_time,
              end: row.end_time,
              hours: 0,
              fuel: 0,
              records: 0
            };
          }

          // Track min start and max end for the day
          if (parseFloat(row.start_time) < parseFloat(grouped[row.date].start)) {
            grouped[row.date].start = row.start_time;
          }
          if (parseFloat(row.end_time) > parseFloat(grouped[row.date].end)) {
            grouped[row.date].end = row.end_time;
          }

          const hours = parseFloat(row.total_hours) || 0;
          const fuel = parseFloat(row.fuel_consumed) || 0;

          grouped[row.date].hours += hours;
          grouped[row.date].fuel += fuel;
          grouped[row.date].records += 1;

          totalHours += hours;
          totalFuel += fuel;
          totalRecords += 1;
        });

        setSummaryRows(Object.values(grouped));
        setSummaryTotals({
          hours: totalHours,
          fuel: totalFuel,
          records: totalRecords
        });
      } else {
        setSummaryRows([]);
        setSummaryTotals({ hours: 0, fuel: 0, records: 0 });
      }
    } catch (err) {
      console.error('Error fetching JCB monthly summary:', err);
      setSummaryRows([]);
      setSummaryTotals({ hours: 0, fuel: 0, records: 0 });
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchLastReading = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('jcb_operations')
        .select('end_time')
        .eq('contractor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, start_time: data[0].end_time.toString() }));
      }
    } catch (err) {
      console.error('Error fetching last JCB reading:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSummary();
      fetchLastReading();
    }
  }, [user, summaryMonth, summaryYear, refreshKey]);

  useEffect(() => {
    if (user && user.full_name && !initialNameSet && !formData.driver_name) {
      setFormData(prev => ({ ...prev, driver_name: user.full_name }));
      setInitialNameSet(true);
    }
  }, [user, initialNameSet, formData.driver_name]);

  const calculateHours = () => {
    if (formData.start_time && formData.end_time) {
      const start = parseFloat(formData.start_time);
      const end = parseFloat(formData.end_time);

      if (!isNaN(start) && !isNaN(end)) {
        const diffHours = end - start;
        setFormData(prev => ({
          ...prev,
          total_hours: diffHours >= 0 ? diffHours.toFixed(2) : '0.00'
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          total_hours: ''
        }));
      }
    }
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.work_type) {
      setError('Work Type is required');
      return false;
    }
    if (!formData.driver_name) {
      errors.push('Driver Name is required');
    }
    if (!formData.start_time) {
      errors.push('Start time is required');
    }
    if (!formData.end_time) {
      errors.push('End time is required');
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const jcbData = {
        contractor_id: user?.id,
        date: formData.date,
        work_type: formData.work_type,
        driver_name: formData.driver_name,
        location: workArea === 'quarry' ? 'Quarry' : workArea === 'crusher' ? 'Crusher' : 'Site',
        start_time: formData.start_time,
        end_time: formData.end_time,
        total_hours: parseFloat(formData.total_hours) || 0,
        fuel_consumed: parseFloat(formData.fuel_consumed) || 0,
        work_description: formData.work_description || null,
        notes: formData.notes || null,
        status: 'pending',
        ...(workArea === 'quarry' || workArea === 'crusher' ? { work_area: workArea } : {}),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('jcb_operations')
        .insert([jcbData]);

      if (error) throw error;

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        work_type: '',
        driver_name: '',
        start_time: '',
        end_time: '',
        total_hours: '',
        fuel_consumed: '',
        work_description: '',
        notes: ''
      });

      toast.success('JCB operation recorded successfully!');
      setRefreshKey(prev => prev + 1);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving JCB operation:', error);
      setError(error instanceof Error ? error.message : 'Failed to save JCB operation');
      toast.error('Failed to save JCB operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
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

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {workArea === 'quarry' ? 'Quarry ' : workArea === 'crusher' ? 'Crusher ' : ''}JCB Operations
          </h3>
          <p className="text-sm text-slate-600">Record {workArea ? workArea : ''} JCB operations and maintenance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Work Type *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              'Good borders loading',
              'Material loading',
              'Bunker works',
              'Crusher works',
              'Quarry works'
            ].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData(p => ({ ...p, work_type: type }))}
                className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${formData.work_type === type
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400 hover:bg-amber-50'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
          <input
            type="hidden"
            name="work_type"
            value={formData.work_type}
            required
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Driver Name
            </label>
            <input
              type="text"
              name="driver_name"
              value={formData.driver_name}
              onChange={handleChange}
              required
              readOnly
              className="w-full px-4 py-2 border border-slate-300 bg-slate-50 rounded-lg font-medium text-slate-900"
              placeholder="Driver name"
            />
          </div>

        </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Start Reading (Hrs)
            </label>
            <input
              type="number"
              step="0.01"
              name="start_time"
              value={formData.start_time}
              onChange={handleChange}
              onBlur={calculateHours}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="Machine start hours"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Reading (Hrs)
            </label>
            <input
              type="number"
              step="0.01"
              name="end_time"
              value={formData.end_time}
              onChange={handleChange}
              onBlur={calculateHours}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="Machine end hours"
            />
          </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Total Hours
          </label>
          <input
            type="number"
            name="total_hours"
            value={formData.total_hours}
            readOnly
            className="w-full px-4 py-3 border border-slate-300 bg-slate-50 rounded-lg text-lg font-bold text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Diesel (Liters)
          </label>
          <input
            type="number"
            name="fuel_consumed"
            value={formData.fuel_consumed}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="0.0"
          />
        </div>


        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Work Description
          </label>
          <input
            type="text"
            name="work_description"
            value={formData.work_description}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="E.g., Loading, Leveling, Excavation, etc."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Any additional notes or observations..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>

    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-500" />
          <div>
            <h4 className="text-lg font-semibold text-slate-900">Monthly JCB Summary</h4>
            <p className="text-sm text-slate-600">Review monthly totals for the selected period.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
            <div className="relative">
              <select
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(Number(e.target.value))}
                className="w-full sm:w-auto appearance-none px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                {Array.from({ length: 12 }, (_, idx) => idx).map((month) => (
                  <option key={month} value={month}>{new Date(0, month).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
            <div className="relative">
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
                className="w-full sm:w-auto appearance-none px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                {Array.from({ length: 3 }, (_, idx) => now.getFullYear() - 1 + idx).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-slate-700">Date</th>
              <th className="px-4 py-3 text-center">Start (Hrs)</th>
              <th className="px-4 py-3 text-center">End (Hrs)</th>
              <th className="px-4 py-3 text-center">Total Hrs</th>
              <th className="px-4 py-3 text-right">Diesel (L)</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.length > 0 ? (
              summaryRows.map((row) => (
                <tr key={row.date} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.date}</td>
                  <td className="px-4 py-3 text-center text-slate-600 border-l border-slate-100">{parseFloat(row.start).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-slate-600 border-l border-slate-100">{parseFloat(row.end).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-slate-900 font-bold border-l border-slate-100">{row.hours.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 border-l border-slate-100">{row.fuel.toFixed(1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {summaryLoading ? 'Loading monthly summary...' : 'No JCB operations found for this month.'}
                </td>
              </tr>
            )}
          </tbody>
          {summaryRows.length > 0 && (
            <tfoot className="bg-slate-50 text-slate-900 font-semibold">
              <tr>
                <td className="px-4 py-3 text-slate-900 uppercase font-black">Total</td>
                <td className="px-4 py-3 border-l border-slate-100"></td>
                <td className="px-4 py-3 border-l border-slate-100"></td>
                <td className="px-4 py-3 text-center text-slate-900 font-bold border-l border-slate-100">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="w-4 h-4 text-amber-500" />{summaryTotals.hours.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-900 font-bold border-l border-slate-100">
                  <span className="inline-flex items-center gap-1"><Fuel className="w-4 h-4 text-red-500" />{summaryTotals.fuel.toFixed(1)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  </div>
  );
}
