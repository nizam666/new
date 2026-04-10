import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Save, Calendar, ChevronDown, Package, Fuel, TrendingUp } from 'lucide-react';

const vehicleTypes = [
  'Truck',
  'Tractor'
];

const materialTypes = [
  'Good Boulders',
  'Weather Rocks',
  'Soil',
  "Aggregate's Rehandling"
];

const fromLocationTypes = [
  'Quarry',
  'Stockyard',
  'Crusher'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEAR_OPTIONS = [
  new Date().getFullYear() - 1,
  new Date().getFullYear(),
  new Date().getFullYear() + 1
];

const getToLocationOptions = (fromLocation: string) => {
  if (!fromLocation) return ['Stockyard', 'Crusher', 'Soil dumping yard'];

  switch (fromLocation) {
    case 'Quarry':
      return ['Stockyard', 'Crusher'];
    case 'Stockyard':
      return ['Crusher'];
    case 'Crusher':
      return [];
    default:
      return [];
  }
};

export function TransportForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicle_type: '',
    vehicle_number: '',
    from_location: '',
    to_location: '',
    fuel_consumed: '',
    material_transported: '',
    quantity: '',
    number_of_trips: '1',
    notes: ''
  });

  // Summary State
  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth());
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [summaryTotals, setSummaryTotals] = useState({ fuel: 0, quantity: 0, trips: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchSummary = async () => {
    if (!user) return;
    setSummaryLoading(true);
    try {
      const firstDay = new Date(summaryYear, summaryMonth, 1);
      const lastDay = new Date(summaryYear, summaryMonth + 1, 0);
      const fromStr = firstDay.toISOString().split('T')[0];
      const toStr = lastDay.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('transport_records')
        .select('date, fuel_consumed, quantity, number_of_trips')
        .eq('contractor_id', user.id)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        // Group by date
        const grouped: Record<string, any> = {};
        let totalFuel = 0, totalQty = 0, totalTrips = 0;

        data.forEach(row => {
          if (!grouped[row.date]) {
            grouped[row.date] = { date: row.date, fuel: 0, qty: 0, trips: 0 };
          }
          const f = parseFloat(row.fuel_consumed) || 0;
          const q = parseFloat(row.quantity) || 0;
          const t = parseInt(row.number_of_trips) || 0;

          grouped[row.date].fuel += f;
          grouped[row.date].qty += q;
          grouped[row.date].trips += t;

          totalFuel += f;
          totalQty += q;
          totalTrips += t;
        });

        setSummaryRows(Object.values(grouped));
        setSummaryTotals({ fuel: totalFuel, quantity: totalQty, trips: totalTrips });
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };


  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user, summaryMonth, summaryYear, refreshKey]);

  const handleMaterialChange = (material: string) => {
    if (material === "Aggregate's Rehandling") {
      setFormData(prev => ({
        ...prev,
        material_transported: material,
        from_location: 'Crusher',
        to_location: 'Crusher'
      }));
    } else if (material === "Soil") {
      setFormData(prev => ({
        ...prev,
        material_transported: material,
        to_location: 'Soil dumping yard'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        material_transported: material,
        from_location: prev.from_location === 'Crusher' ? '' : prev.from_location,
        to_location: prev.to_location === 'Crusher' || prev.to_location === 'Soil dumping yard' ? '' : prev.to_location
      }));
    }
  };

  const handleLocationChange = (fromLocation: string) => {
    // Don't allow changing locations when 'Aggregate's Rehandling' or 'Soil' is selected
    if (formData.material_transported === "Aggregate's Rehandling" || formData.material_transported === "Soil") {
      return;
    }

    setFormData({
      ...formData,
      from_location: fromLocation,
      to_location: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transport_records')
        .insert([
          {
            contractor_id: user.id,
            date: formData.date,
            vehicle_type: formData.vehicle_type,
            vehicle_number: formData.vehicle_number,
            from_location: formData.from_location,
            to_location: formData.to_location,
            fuel_consumed: parseFloat(formData.fuel_consumed) || 0,
            material_transported: formData.material_transported,
            quantity: parseFloat(formData.quantity) || 0,
            number_of_trips: parseInt(formData.number_of_trips) || 1,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        vehicle_type: '',
        vehicle_number: '',
        from_location: '',
        to_location: '',
        fuel_consumed: '',
        material_transported: '',
        quantity: '',
        number_of_trips: '1',
        notes: ''
      });

      alert('Transport record submitted successfully!');
      setRefreshKey(prev => prev + 1);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error submitting transport record:', error);
      alert('Error submitting transport record: ' + (error.message || error.details || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Transport Record</h3>
          <p className="text-sm text-slate-600">Track vehicle and material transport</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {vehicleTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, vehicle_type: type })}
                className={`px-4 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 ${
                  formData.vehicle_type === type
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Number *
          </label>
          <input
            type="text"
            value={formData.vehicle_number}
            onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g. TN 01 AB 1234"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Transported *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {materialTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleMaterialChange(type)}
                className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                  formData.material_transported === type
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            From Location *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {fromLocationTypes.map((location) => (
              <button
                key={`from-${location}`}
                type="button"
                onClick={() => handleLocationChange(location)}
                disabled={formData.material_transported === "Aggregate's Rehandling" || formData.material_transported === "Soil"}
                className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                  formData.from_location === location
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : formData.material_transported === "Aggregate's Rehandling" || formData.material_transported === "Soil"
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {location}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            To Location *
          </label>
          {formData.material_transported === "Aggregate's Rehandling" ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-100 text-gray-600 border-gray-200 text-sm">
              Crusher to Crusher (auto-set)
            </div>
          ) : formData.material_transported === "Soil" ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-100 text-gray-600 border-gray-200 text-sm">
              Soil dumping yard (auto-set)
            </div>
          ) : !formData.from_location ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-50 text-gray-400 border-gray-200 text-sm">
              Select source location first
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {getToLocationOptions(formData.from_location).map((location) => (
                <button
                  key={`to-${location}`}
                  type="button"
                  onClick={() => setFormData({ ...formData, to_location: location })}
                  className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                    formData.to_location === location
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          )}
        </div>


        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Fuel Consumed (liters)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.fuel_consumed}
            onChange={(e) => setFormData({ ...formData, fuel_consumed: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="0.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Number of Trips
          </label>
          <input
            type="number"
            step="1"
            value={formData.number_of_trips}
            onChange={(e) => setFormData({ ...formData, number_of_trips: e.target.value })}
            min="1"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity (tons)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Trip details, route conditions, etc..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
      </form>

      {/* ── Monthly Transport Summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Monthly Transport Report</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={summaryMonth}
                onChange={e => setSummaryMonth(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={summaryYear}
                onChange={e => setSummaryYear(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {summaryLoading ? (
          <div className="py-12 text-center text-slate-500">
            <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p>Loading summary…</p>
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No records found for this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Trips</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Fuel (L)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider">Quantity (tons)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryRows.map((row, idx) => (
                  <tr key={row.date} className={`hover:bg-slate-50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short', day: '2-digit', month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{row.trips}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{row.fuel.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-purple-700">{row.qty.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-purple-50 border-t-2 border-purple-200">
                  <td className="px-4 py-3 text-xs font-bold text-purple-900">
                    MONTHLY TOTALS
                  </td>
                  <td className="px-4 py-3 text-right" colSpan={3}>
                    <div className="flex flex-wrap justify-end gap-6">
                      <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        {summaryTotals.trips} Trips
                      </span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <Fuel className="w-4 h-4 text-red-500" />
                        {summaryTotals.fuel.toFixed(1)} L
                      </span>
                      <span className="flex items-center gap-1 text-sm font-bold text-purple-900">
                        <Package className="w-4 h-4 text-purple-600" />
                        {summaryTotals.quantity.toFixed(2)} tons
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
