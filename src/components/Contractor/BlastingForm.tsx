import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bomb, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const MATERIAL_TYPES = ['Good Boulders', 'Weathered Rocks', 'Soil'];
const MATERIAL_TYPES_TAMIL = {
  'Good Boulders': 'பாறை',
  'Weathered Rocks': 'மதுரை கல்',
  'Soil': 'மண்'
};
const LOCATIONS = ['Site 1', 'Storage Bay'];
const PG_UNITS = ['boxes', 'nos'];

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateForm()) return;

    setLoading(true);
    setErrorStatus(null);

    try {
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
            pg_nos: parseFloat(formData.pg_nos) || 0,
            pg_unit: formData.pg_unit,
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
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm ${
                  formData.location === loc
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
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                  formData.material_type === type
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
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ED (nos)</label>
            <input
              type="number"
              step="0.01"
              value={formData.ed_nos}
              onChange={(e) => setFormData({ ...formData, ed_nos: e.target.value })}
              min="0"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">EDET (nos)</label>
            <input
              type="number"
              step="0.01"
              value={formData.edet_nos}
              onChange={(e) => setFormData({ ...formData, edet_nos: e.target.value })}
              min="0"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">NONEL 3m (nos)</label>
            <input
              type="number"
              step="0.01"
              value={formData.nonel_3m_nos}
              onChange={(e) => setFormData({ ...formData, nonel_3m_nos: e.target.value })}
              min="0"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">NONEL 4m (nos)</label>
            <input
              type="number"
              step="0.01"
              value={formData.nonel_4m_nos}
              onChange={(e) => setFormData({ ...formData, nonel_4m_nos: e.target.value })}
              min="0"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
              placeholder="0"
            />
          </div>
        </div>

        {/* PG Quantity */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">PG Quantity</label>
          <input
            type="number"
            step="0.01"
            value={formData.pg_nos}
            onChange={(e) => setFormData({ ...formData, pg_nos: e.target.value })}
            min="0"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-orange-500 text-xs sm:text-sm"
            placeholder="0.00"
          />
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
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-xs sm:text-sm ${
                  formData.pg_unit === unit
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
    </form>
  );
}
