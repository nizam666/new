import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Drill, Save, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'react-toastify';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fetchQuarryBalances } from '../../utils/quarryStock';

const LOCATIONS = ['Site 1', 'Storage Bay'];
const MATERIAL_TYPES = ['Good Boulders', 'Weathered Rocks', 'Soil'];
const MATERIAL_TYPES_TAMIL = {
  'Good Boulders': 'பாறை',
  'Weathered Rocks': 'மதுரை கல்',
  'Soil': 'மண்'
};
const EQUIPMENT_OPTIONS = ['Tractor', 'Bore'];
const ROD_STEPS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5];

const INITIAL_ROD_STATE = ROD_STEPS.reduce((acc, step) => {
  const key = step.toString().replace('.', '_');
  acc[`rod${key}`] = 0;
  acc[`rod${key}_set2`] = 0;
  return acc;
}, {} as Record<string, number>);

const safeFormat = (dateStr: string | null | undefined, formatStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return format(d, formatStr);
  } catch (e) {
    return 'Error';
  }
};

function ToggleGroup({
  options,
  value,
  onChange,
  color = 'blue',
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  color?: 'blue' | 'emerald' | 'orange';
}) {
  const base = 'px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer';
  const activeClass: Record<string, string> = {
    blue: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    emerald: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    orange: 'bg-orange-500 text-white border-orange-500 shadow-sm',
  };
  const inactiveClass = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400';

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? '' : opt)}
          className={`${base} ${value === opt ? activeClass[color] : inactiveClass}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function DrillingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    location: '',
    material_type: '',
    equipment_used: '',
    diesel_consumed: '',
    notes: ''
  });
  const [dieselStock, setDieselStock] = useState<number | null>(null);

  const [monthlyStats, setMonthlyStats] = useState<{
    date: string;
    totalFeet: number;
    totalDiesel: number;
    breakdown: Record<string, number>;
  }[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [rodMeasurements, setRodMeasurements] = useState<Record<string, number>>(INITIAL_ROD_STATE);

  const today = new Date().toISOString().split('T')[0];

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.location) errors.push('Location is required');
    if (!formData.equipment_used) errors.push('Equipment used is required');
    if (formData.date > today) errors.push('Date cannot be in the future');
    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    setError(null);
    return true;
  };

  const calcHoles1 = () => ROD_STEPS.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}`] || 0), 0);
  const calcFeet1 = () => ROD_STEPS.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}`] || 0) * step, 0);
  const calcHoles2 = () => ROD_STEPS.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}_set2`] || 0), 0);
  const calcFeet2 = () => ROD_STEPS.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}_set2`] || 0) * step, 0);
  const totalHoles = () => calcHoles1() + calcHoles2();
  const totalFeet = () => calcFeet1() + calcFeet2();

  const fetchMonthlyStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());

      const { data, error } = await supabase
        .from('drilling_records')
        .select('date, material_type, diesel_consumed, rod_measurements, rod_measurements_set2')
        .eq('contractor_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      // Group and sum by date and material
      type DailyBreakdown = { total: number; diesel: number; breakdown: Record<string, number> };
      const statsMap = new Map<string, DailyBreakdown>();

      data?.forEach(record => {
        let dailySum = 0;
        const set1 = record.rod_measurements as Record<string, number> || {};
        const set2 = record.rod_measurements_set2 as Record<string, number> || {};

        ROD_STEPS.forEach(step => {
          const key = step.toString().replace('.', '_');
          dailySum += (set1[`rod${key}`] || 0) * step;
          dailySum += (set2[`rod${key}_set2`] || 0) * step;
        });

        const mType = record.material_type || 'Unknown';
        const current = statsMap.get(record.date) || { total: 0, diesel: 0, breakdown: {} };
        current.total += dailySum;
        current.diesel += (record.diesel_consumed || 0);
        current.breakdown[mType] = (current.breakdown[mType] || 0) + dailySum;
        statsMap.set(record.date, current);
      });

      const statsArray = Array.from(statsMap.entries()).map(([date, data]) => ({
        date,
        totalFeet: data.total,
        totalDiesel: data.diesel,
        breakdown: data.breakdown
      }));
      setMonthlyStats(statsArray);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStatsError('Failed to load summary');
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMonthlyStats();
    fetchStock();
  }, [fetchMonthlyStats]);

  const fetchStock = async () => {
    const balances = await fetchQuarryBalances();
    if (balances['diesel']) {
      setDieselStock(balances['diesel'].remaining);
    }
  };

  const drillingProduction = (totalFeet() * 0.8) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('User not authenticated'); return; }
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // 🚨 Stock Validation 🚨
      const balances = await fetchQuarryBalances();
      const available = balances['diesel']?.remaining || 0;
      const requested = parseFloat(formData.diesel_consumed) || 0;

      if (requested > available) {
        setLoading(false);
        setError(`Insufficient Diesel stock. Available: ${available.toFixed(1)} L, Requested: ${requested} L`);
        toast.error('Stock validation failed: Diesel not available in Quarry Store.');
        return;
      }
      const set1Data: Record<string, number> = {};
      const set2Data: Record<string, number> = {};

      Object.keys(rodMeasurements).forEach(key => {
        if (key.endsWith('_set2')) set2Data[key] = rodMeasurements[key];
        else set1Data[key] = rodMeasurements[key];
      });

      const { error } = await supabase.from('drilling_records').insert([{
        contractor_id: user.id,
        date: formData.date,
        location: formData.location,
        material_type: formData.material_type || null,
        equipment_used: formData.equipment_used,
        diesel_consumed: parseFloat(formData.diesel_consumed) || 0,
        notes: formData.notes || null,
        status: 'pending',
        rod_measurements: set1Data,
        rod_measurements_set2: set2Data,
        created_at: new Date().toISOString()
      }]).select();

      if (error) throw error;

      setFormData({ date: new Date().toISOString().split('T')[0], location: '', material_type: '', equipment_used: '', diesel_consumed: '', notes: '' });
      setRodMeasurements(INITIAL_ROD_STATE);
      toast.success('Drilling record saved successfully!');
      fetchMonthlyStats();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Drilling save error:', err);
      let msg = 'Unknown error';
      if (err && typeof err === 'object') {
        // Supabase errors have .message, .code, .details, .hint
        const e = err as Record<string, unknown>;
        const parts: string[] = [];
        if (e.message) parts.push(String(e.message));
        if (e.details) parts.push(`Details: ${e.details}`);
        if (e.hint) parts.push(`Hint: ${e.hint}`);
        if (e.code) parts.push(`Code: ${e.code}`);
        msg = parts.join(' | ') || JSON.stringify(err);
      }
      setError(`Failed to save: ${msg}`);
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Drill className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">New Drilling Record</h3>
          <p className="text-xs sm:text-sm text-slate-500 truncate">Fill details below and enter rod counts</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-5 flex gap-2 sm:gap-3">
          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════
          FORM DETAILS
      ══════════════════════════════════════ */}
      <div className="space-y-4 sm:space-y-5">

        {/* Date + Diesel on one row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              max={today}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Diesel Consumed (L)</span>
              {dieselStock !== null && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${dieselStock <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Available: {dieselStock.toFixed(1)} L
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.diesel_consumed}
              onChange={(e) => setFormData({ ...formData, diesel_consumed: e.target.value })}
              min="0"
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm ${
                dieselStock !== null && parseFloat(formData.diesel_consumed) > dieselStock ? 'border-red-500 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Location toggle buttons */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <ToggleGroup options={LOCATIONS} value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} color="blue" />
        </div>

        {/* Material Type */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Material Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {MATERIAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, material_type: type })}
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                  formData.material_type === type
                    ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300'
                }`}
              >
                <div className="text-xs sm:text-sm font-semibold">{type}</div>
                <div className="text-[10px] sm:text-xs mt-1 opacity-75">{MATERIAL_TYPES_TAMIL[type as keyof typeof MATERIAL_TYPES_TAMIL] || ''}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Equipment toggle buttons */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
            Equipment Used <span className="text-red-500">*</span>
          </label>
          <ToggleGroup options={EQUIPMENT_OPTIONS} value={formData.equipment_used} onChange={(v) => setFormData({ ...formData, equipment_used: v })} color="emerald" />
        </div>

        {/* ══════════════════════════════════════
            ROD MEASUREMENTS  (moved here)
        ══════════════════════════════════════ */}
        <div className="pt-2">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Rod Measurements (Size)</label>
          <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-2xl overflow-hidden mb-4 sm:mb-6">

            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_1fr] items-center bg-slate-100 border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider w-12 sm:w-20">Size</span>
              <span className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Set 1</span>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider text-center">Set 2</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {ROD_STEPS.map((num: number) => {
                const k1 = `rod${num.toString().replace('.', '_')}`;
                const k2 = `rod${num.toString().replace('.', '_')}_set2`;
                const isHalf = num === 0.5;
                return (
                  <div
                    key={num}
                    className={`grid grid-cols-[auto_1fr_1fr] items-center gap-3 px-4 py-2 ${isHalf ? 'bg-amber-50/60 border-t-2 border-amber-200' : ''}`}
                  >
                    {/* Size label */}
                    <div className="w-12 sm:w-20">
                      <span className={`inline-flex items-center justify-center w-10 sm:w-14 h-6 sm:h-7 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold
                        ${isHalf
                          ? 'bg-amber-100 text-amber-700 border border-amber-300'
                          : num >= 8 ? 'bg-blue-100 text-blue-700'
                          : num >= 5 ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-200 text-slate-700'
                        }`}>
                        {num} ft
                      </span>
                    </div>

                    {/* Set 1 */}
                    <div className="flex justify-center">
                      <input
                        type="number"
                        value={rodMeasurements[k1] === 0 ? '' : rodMeasurements[k1]}
                        onChange={(e) => setRodMeasurements({ ...rodMeasurements, [k1]: parseInt(e.target.value) || 0 })}
                        min="0"
                        step="1"
                        className="w-16 sm:w-24 px-2 sm:px-3 py-1 sm:py-1.5 text-center border border-slate-300 bg-white rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-xs sm:text-sm font-medium"
                        placeholder="0"
                      />
                    </div>

                    {/* Set 2 */}
                    <div className="flex justify-center">
                      <input
                        type="number"
                        value={rodMeasurements[k2] === 0 ? '' : rodMeasurements[k2]}
                        onChange={(e) => setRodMeasurements({ ...rodMeasurements, [k2]: parseInt(e.target.value) || 0 })}
                        min="0"
                        step="1"
                        className="w-16 sm:w-24 px-2 sm:px-3 py-1 sm:py-1.5 text-center border border-slate-300 bg-white rounded-md sm:rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 text-xs sm:text-sm font-medium"
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[auto_1fr_1fr] items-center bg-slate-100 border-t-2 border-slate-300 px-3 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-3">
              <div className="w-12 sm:w-20">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Holes</span>
              </div>
              <div className="text-center space-y-0.5">
                <div className="text-sm sm:text-lg font-bold text-blue-700">{calcHoles1()}</div>
                <div className="text-[10px] sm:text-xs text-blue-500 font-medium">{calcFeet1().toFixed(1)} ft</div>
              </div>
              <div className="text-center space-y-0.5">
                <div className="text-sm sm:text-lg font-bold text-emerald-700">{calcHoles2()}</div>
                <div className="text-[10px] sm:text-xs text-emerald-500 font-medium">{calcFeet2().toFixed(1)} ft</div>
              </div>
            </div>
          </div>

          {/* Combined summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-8">
            <div className="bg-slate-800 text-white rounded-lg sm:rounded-xl p-2 sm:p-4 text-center">
              <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mb-1">Total Holes</div>
              <div className="text-sm sm:text-xl font-bold">{totalHoles()}</div>
            </div>
            
            <div className={`rounded-lg sm:rounded-xl p-2 sm:p-4 text-center transition-colors ${formData.material_type === 'Good Boulders' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider mb-1">Boulders (ft)</div>
              <div className="text-sm sm:text-xl font-bold">{formData.material_type === 'Good Boulders' ? totalFeet().toFixed(0) : '0'}</div>
            </div>

            <div className={`rounded-lg sm:rounded-xl p-2 sm:p-4 text-center transition-colors ${formData.material_type === 'Weathered Rocks' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider mb-1">Rocks (ft)</div>
              <div className="text-sm sm:text-xl font-bold">{formData.material_type === 'Weathered Rocks' ? totalFeet().toFixed(0) : '0'}</div>
            </div>

            <div className="bg-emerald-700 text-white rounded-lg sm:rounded-xl p-2 sm:p-4 text-center">
              <div className="text-[10px] sm:text-xs text-emerald-300 uppercase tracking-wider mb-1 font-semibold">Production</div>
              <div className="text-sm sm:text-xl font-bold">{drillingProduction.toFixed(1)}<span className="text-[10px] sm:text-xs text-emerald-300 ml-1">t</span></div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm resize-none"
            placeholder="Additional notes..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2 pb-6 border-b border-slate-200">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded-lg sm:rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20"
          >
            <Save className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="hidden sm:inline">{loading ? 'Saving...' : 'Save Drilling Record'}</span>
            <span className="sm:hidden">{loading ? 'Saving...' : 'Save'}</span>
          </button>
        </div>

        {/* ── Monthly Summary Section ── */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-slate-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Monthly Summary</h4>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
              {format(new Date(), 'MMMM yyyy')}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-[10px] sm:text-xs">
            <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200 px-2 sm:px-4 py-2 font-bold text-slate-500 uppercase tracking-wider text-center">
              <span className="text-left">Date</span>
              <span>Boulders</span>
              <span>Rock</span>
              <span className="text-right">Diesel</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {statsLoading ? (
                <div className="p-4 text-center text-slate-500">Loading summary...</div>
              ) : statsError ? (
                <div className="p-4 text-center text-red-500">{statsError}</div>
              ) : monthlyStats.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic">No records for this month</div>
              ) : (
                monthlyStats.map((stat) => (
                  <div key={stat.date} className="grid grid-cols-4 px-2 sm:px-4 py-3 items-center hover:bg-slate-50/50 transition-colors text-center text-xs">
                    <div className="text-left">
                      <div className="font-bold text-slate-900">{safeFormat(stat.date, 'dd MMM')}</div>
                      <div className="text-[8px] sm:text-[10px] text-slate-400 capitalize">{safeFormat(stat.date, 'EEE')}</div>
                    </div>
                    <div className="text-orange-600 font-bold">
                      {(stat.breakdown?.['Good Boulders'] || 0).toFixed(0)}<span className="text-[8px] opacity-70 ml-0.5 font-normal">ft</span>
                    </div>
                    <div className="text-amber-600 font-bold">
                      {(stat.breakdown?.['Weathered Rocks'] || 0).toFixed(0)}<span className="text-[8px] opacity-70 ml-0.5 font-normal">ft</span>
                    </div>
                    <div className="text-blue-600 font-bold text-right pr-1">
                      {stat.totalDiesel.toFixed(1)}<span className="text-[8px] opacity-70 ml-0.5 font-normal text-slate-400">L</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Monthly Total Footer - Redesigned to show material totals only */}
            {monthlyStats.length > 0 && (
              <div className="bg-slate-900 px-4 py-4 text-white">
                <div className="grid grid-cols-3 gap-4">
                  {['Good Boulders', 'Weathered Rocks'].map(type => {
                    const typeTotal = monthlyStats.reduce((acc, curr) => acc + (curr.breakdown?.[type] || 0), 0);
                    const isBoulders = type === 'Good Boulders';
                    return (
                      <div key={type} className={`p-3 rounded-lg border flex flex-col items-center ${
                        isBoulders ? 'bg-orange-600/20 border-orange-600/30' : 'bg-amber-600/20 border-amber-600/30'
                      }`}>
                        <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1 text-center">
                          {isBoulders ? 'Total G.B' : 'Total W.R'}
                        </span>
                        <span className={`text-sm sm:text-lg font-black ${isBoulders ? 'text-orange-400' : 'text-amber-400'}`}>
                          {typeTotal.toFixed(0)}
                          <span className="text-[10px] sm:text-xs font-medium opacity-60 ml-1 tracking-normal">ft</span>
                        </span>
                      </div>
                    );
                  })}
                  <div className="p-3 rounded-lg border bg-blue-600/20 border-blue-600/30 flex flex-col items-center">
                    <span className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1 text-center">
                      Total Diesel
                    </span>
                    <span className="text-sm sm:text-lg font-black text-blue-400">
                      {monthlyStats.reduce((acc, curr) => acc + curr.totalDiesel, 0).toFixed(1)}
                      <span className="text-[10px] sm:text-xs font-medium opacity-60 ml-1 tracking-normal">L</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
