import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bomb, Save, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'react-toastify';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fetchQuarryBalances } from '../../utils/quarryStock';

const MATERIAL_TYPES = ['Good Boulders', 'Weathered Rocks', 'Soil'];
const MATERIAL_TYPES_TAMIL = {
  'Good Boulders': 'பாறை',
  'Weathered Rocks': 'மதுரை கல்',
  'Soil': 'மண்'
};
const MATERIAL_TYPES_ABBR = {
  'Good Boulders': 'G.B',
  'Weathered Rocks': 'W.R',
  'Soil': 'Soil'
};
const LOCATIONS = ['Site 1', 'Storage Bay'];
const PG_UNITS = ['boxes', 'nos'];
const PG_BOX_SIZE = 200;

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

export function BlastingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    location: '',
    ed_nos: '',
    edet_nos: '',
    nonel_3m_nos: '',
    nonel_4m_nos: '',
    pg_nos: '',
    pg_unit: 'boxes',
    material_type: '',
    notes: ''
  });
  const [quarryBalances, setQuarryBalances] = useState<any>(null);

  const [monthlyStats, setMonthlyStats] = useState<{
    date: string;
    material_type: string;
    ed: number;
    edet: number;
    nonel_3m: number;
    nonel_4m: number;
    pg: number;
  }[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const today = new Date().toISOString().split('T')[0];

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.location) errors.push('Location is required');
    if (!formData.material_type) errors.push('Material type is required');
    if (formData.date > today) errors.push('Date cannot be in the future');
    if (errors.length > 0) {
      setErrorStatus(errors.join(', '));
      return false;
    }
    setErrorStatus(null);
    return true;
  };

  const fetchMonthlyStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]) - 1;
      const start = startOfMonth(new Date(year, month));
      const end = endOfMonth(new Date(year, month));

      const { data, error } = await supabase
        .from('blasting_records')
        .select('*')
        .eq('contractor_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      // Group by date + material
      type Key = string; // date_material
      const statsMap = new Map<Key, any>();

      data?.forEach(record => {
        const key = `${record.date}_${record.material_type}`;
        const current = statsMap.get(key) || {
          date: record.date,
          material_type: record.material_type,
          ed: 0,
          edet: 0,
          nonel_3m: 0,
          nonel_4m: 0,
          pg: 0
        };

        current.ed += (record.ed_nos || 0);
        current.edet += (record.edet_nos || 0);
        current.nonel_3m += (record.nonel_3m_nos || 0);
        current.nonel_4m += (record.nonel_4m_nos || 0);
        current.pg += (record.pg_nos || 0);

        statsMap.set(key, current);
      });

      setMonthlyStats(Array.from(statsMap.values()));
    } catch (err) {
      console.error('Error fetching blasting stats:', err);
      setStatsError('Failed to load summary');
    } finally {
      setStatsLoading(false);
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    fetchMonthlyStats();
    fetchBalances();
  }, [fetchMonthlyStats]);

  const fetchBalances = async () => {
    const b = await fetchQuarryBalances();
    setQuarryBalances(b);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateForm()) return;

    setLoading(true);
    setErrorStatus(null);

    try {
      // 🚨 Stock Validation 🚨
      const b = await fetchQuarryBalances();

      const check = (key: string, qty: number, label: string) => {
        const available = b[key]?.remaining || 0;
        if (qty > available) {
          throw new Error(`Insufficient ${label} stock. Available: ${available.toFixed(1)}, Requested: ${qty}`);
        }
      };

      const rawPg = parseFloat(formData.pg_nos) || 0;
      const finalPg = formData.pg_unit === 'nos' ? rawPg / 200 : rawPg;

      check('pg', finalPg, 'PG (boxes)');
      check('ed', parseFloat(formData.ed_nos) || 0, 'ED');
      check('edet', parseFloat(formData.edet_nos) || 0, 'EDET');
      check('nonel_3m', parseFloat(formData.nonel_3m_nos) || 0, 'NONEL 3m');
      check('nonel_4m', parseFloat(formData.nonel_4m_nos) || 0, 'NONEL 4m');

      const { error } = await supabase
        .from('blasting_records')
        .insert([
          {
            contractor_id: user.id,
            date: formData.date,
            location: formData.location,
            ed_nos: parseFloat(formData.ed_nos) || 0,
            edet_nos: parseFloat(formData.edet_nos) || 0,
            nonel_3m_nos: parseFloat(formData.nonel_3m_nos) || 0,
            nonel_4m_nos: parseFloat(formData.nonel_4m_nos) || 0,
            pg_nos: finalPg,
            pg_unit: 'boxes', // Always save in boxes for consistency
            material_type: formData.material_type,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        location: '',
        ed_nos: '',
        edet_nos: '',
        nonel_3m_nos: '',
        nonel_4m_nos: '',
        pg_nos: '',
        pg_unit: 'boxes',
        material_type: '',
        notes: ''
      });

      toast.success('Blasting record saved successfully!');
      fetchMonthlyStats();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Blasting save error:', err);
      let msg = 'Unknown error';
      if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        const parts: string[] = [];
        if (e.message) parts.push(String(e.message));
        if (e.details) parts.push(`Details: ${e.details}`);
        if (e.hint) parts.push(`Hint: ${e.hint}`);
        if (e.code) parts.push(`Code: ${e.code}`);
        msg = parts.join(' | ') || JSON.stringify(err);
      }
      setErrorStatus(msg);
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 sm:space-y-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Bomb className="w-4 sm:w-5 h-4 sm:h-5 text-orange-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">New Blasting Record</h3>
          <p className="text-xs sm:text-sm text-slate-500 truncate">Record explosives used for blasting</p>
        </div>
      </div>

      {errorStatus && (
        <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-5 flex gap-2 sm:gap-3">
          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-red-700">{errorStatus}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Date Row */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            max={today}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-xs sm:text-sm"
          />
        </div>

        {/* Location Selection */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Location <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setFormData({ ...formData, location: loc })}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm ${formData.location === loc
                    ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300'
                  }`}
              >
                <div className="font-semibold">{loc}</div>
              </button>
            ))}
          </div>
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
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${formData.material_type === type
                    ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300'
                  }`}
              >
                <div className="text-xs sm:text-sm font-semibold">{type}</div>
                <div className="text-xs mt-1 opacity-75">{MATERIAL_TYPES_TAMIL[type as keyof typeof MATERIAL_TYPES_TAMIL]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Explosives Grid */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>ED (nos)</span>
              {quarryBalances?.['ed'] && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${quarryBalances['ed'].remaining <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Avail: {quarryBalances['ed'].remaining.toFixed(0)}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.ed_nos}
              onChange={(e) => setFormData({ ...formData, ed_nos: e.target.value })}
              min="0"
              className={`w-full px-3 sm:px-4 py-2 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm ${quarryBalances?.['ed'] && parseFloat(formData.ed_nos) > quarryBalances['ed'].remaining ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>EDET (nos)</span>
              {quarryBalances?.['edet'] && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${quarryBalances['edet'].remaining <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Avail: {quarryBalances['edet'].remaining.toFixed(0)}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.edet_nos}
              onChange={(e) => setFormData({ ...formData, edet_nos: e.target.value })}
              min="0"
              className={`w-full px-3 sm:px-4 py-2 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm ${quarryBalances?.['edet'] && parseFloat(formData.edet_nos) > quarryBalances['edet'].remaining ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>NONEL 3m (nos)</span>
              {quarryBalances?.['nonel_3m'] && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${quarryBalances['nonel_3m'].remaining <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Avail: {quarryBalances['nonel_3m'].remaining.toFixed(0)}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.nonel_3m_nos}
              onChange={(e) => setFormData({ ...formData, nonel_3m_nos: e.target.value })}
              min="0"
              className={`w-full px-3 sm:px-4 py-2 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm ${quarryBalances?.['nonel_3m'] && parseFloat(formData.nonel_3m_nos) > quarryBalances['nonel_3m'].remaining ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>NONEL 4m (nos)</span>
              {quarryBalances?.['nonel_4m'] && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${quarryBalances['nonel_4m'].remaining <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  Avail: {quarryBalances['nonel_4m'].remaining.toFixed(0)}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.nonel_4m_nos}
              onChange={(e) => setFormData({ ...formData, nonel_4m_nos: e.target.value })}
              min="0"
              className={`w-full px-3 sm:px-4 py-2 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm ${quarryBalances?.['nonel_4m'] && parseFloat(formData.nonel_4m_nos) > quarryBalances['nonel_4m'].remaining ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              placeholder="0"
            />
          </div>
        </div>

        {/* PG Quantity */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
            <span>PG Quantity</span>
            {quarryBalances?.['pg'] && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${quarryBalances['pg'].remaining <= 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                Available: {quarryBalances['pg'].remaining.toFixed(1)} boxes / {(quarryBalances['pg'].remaining * PG_BOX_SIZE).toFixed(0)} nos
              </span>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.pg_nos}
            onChange={(e) => setFormData({ ...formData, pg_nos: e.target.value })}
            min="0"
            className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm ${quarryBalances?.['pg'] && (formData.pg_unit === 'nos' ? parseFloat(formData.pg_nos) / 200 : parseFloat(formData.pg_nos)) > quarryBalances['pg'].remaining ? 'border-red-500 bg-red-50' : 'border-slate-300'
              }`}
            placeholder={formData.pg_unit === 'nos' ? "Enter quantity in nos (e.g. 200)" : "Enter quantity in boxes"}
          />
          {formData.pg_nos && formData.pg_unit === 'nos' && (
            <div className="mt-1 ml-1 text-[10px] font-semibold text-orange-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
              Equates to {(parseFloat(formData.pg_nos) / 200).toFixed(3)} boxes (1 box = 200 nos)
            </div>
          )}
        </div>

        {/* PG Unit */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            PG Unit <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {PG_UNITS.map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setFormData({ ...formData, pg_unit: unit })}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-xs sm:text-sm ${formData.pg_unit === unit
                    ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300'
                  }`}
              >
                {unit.charAt(0).toUpperCase() + unit.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-xs sm:text-sm resize-none"
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-2 sm:pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 sm:px-8 py-2 sm:py-3 bg-orange-600 text-white rounded-lg sm:rounded-xl hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-semibold text-xs sm:text-sm shadow-md shadow-orange-600/20"
        >
          <Save className="w-4 sm:w-5 h-4 sm:h-5" />
          <span className="hidden sm:inline">{loading ? 'Saving...' : 'Save Blasting Record'}</span>
          <span className="sm:hidden">{loading ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* ── Monthly Summary Section ── */}
      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Monthly Usage Summary</h4>
          </div>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-[10px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Table Wrapper for Horizontal Scroll on small screens */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[90px_110px_70px_70px_70px_60px_60px] bg-slate-50 border-b border-slate-200 px-3 py-3.5 font-bold text-slate-500 uppercase text-[10px] tracking-tight text-center">
                <span className="text-left font-black">Date</span>
                <span className="text-left font-black">Material</span>
                <span>PG (bx)</span>
                <span>NLO 3m</span>
                <span>NLO 4m</span>
                <span>ED</span>
                <span>EDET</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {statsLoading ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading summary...</div>
                ) : statsError ? (
                  <div className="p-4 text-center text-xs text-red-500">{statsError}</div>
                ) : monthlyStats.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">No records for {safeFormat(selectedMonth + '-01', 'MMMM yyyy')}</div>
                ) : (
                  monthlyStats.map((stat, idx) => (
                    <div key={`${stat.date}-${stat.material_type}-${idx}`} className="grid grid-cols-[90px_110px_70px_70px_70px_60px_60px] px-3 py-4 items-center hover:bg-slate-50/50 transition-colors text-center text-xs">
                      <div className="text-left">
                        <div className="font-bold text-slate-900 leading-tight">{safeFormat(stat.date, 'dd MMM')}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{safeFormat(stat.date, 'EEE')}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-orange-600 truncate mr-1">
                          {MATERIAL_TYPES_ABBR[stat.material_type as keyof typeof MATERIAL_TYPES_ABBR] || stat.material_type}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {MATERIAL_TYPES_TAMIL[stat.material_type as keyof typeof MATERIAL_TYPES_TAMIL]}
                        </div>
                      </div>
                      <div className="font-bold text-slate-700 bg-orange-50 py-1.5 rounded-lg border border-orange-100 mx-1">
                        {stat.pg > 0 ? stat.pg.toFixed(1) : '-'}
                      </div>
                      <div className="text-slate-700 font-medium">
                        {stat.nonel_3m > 0 ? stat.nonel_3m : '-'}
                      </div>
                      <div className="text-slate-700 font-medium">
                        {stat.nonel_4m > 0 ? stat.nonel_4m : '-'}
                      </div>
                      <div className="text-slate-700 font-medium">
                        {stat.ed > 0 ? stat.ed : '-'}
                      </div>
                      <div className="text-slate-700 font-medium">
                        {stat.edet > 0 ? stat.edet : '-'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Monthly Totals Footer - Separated to show each explosive type independently */}
          {monthlyStats.length > 0 && (
            <div className="bg-slate-900 p-4 text-white">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Total Monthly Usage</h5>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex flex-col items-center">
                  <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">ED</span>
                  <span className="text-sm font-black text-white">
                    {monthlyStats.reduce((acc, curr) => acc + curr.ed, 0)}
                    <span className="text-[8px] opacity-40 ml-0.5 font-normal capitalize">nos</span>
                  </span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex flex-col items-center">
                  <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1">EDET</span>
                  <span className="text-sm font-black text-white">
                    {monthlyStats.reduce((acc, curr) => acc + curr.edet, 0)}
                    <span className="text-[8px] opacity-40 ml-0.5 font-normal capitalize">nos</span>
                  </span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex flex-col items-center">
                  <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1 text-center">NLO 3m</span>
                  <span className="text-sm font-black text-white">
                    {monthlyStats.reduce((acc, curr) => acc + curr.nonel_3m, 0)}
                    <span className="text-[8px] opacity-40 ml-0.5 font-normal capitalize">nos</span>
                  </span>
                </div>

                <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex flex-col items-center">
                  <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1 text-center">NLO 4m</span>
                  <span className="text-sm font-black text-white">
                    {monthlyStats.reduce((acc, curr) => acc + curr.nonel_4m, 0)}
                    <span className="text-[8px] opacity-40 ml-0.5 font-normal capitalize">nos</span>
                  </span>
                </div>

                <div className="bg-orange-600/20 p-2 rounded-lg border border-orange-600/30 flex flex-col items-center col-span-2 sm:col-span-1">
                  <span className="text-[8px] text-orange-400 uppercase font-bold tracking-wider mb-1">PG Total</span>
                  <span className="text-sm font-black text-orange-400">
                    {monthlyStats.reduce((acc, curr) => acc + curr.pg, 0).toFixed(2)}
                    <span className="text-[8px] opacity-60 ml-0.5 font-normal capitalize text-orange-400">bx</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
