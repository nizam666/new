import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bomb, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const MATERIAL_TYPES = ['Good Boulders', 'Weathered Rocks', 'Soil'];
const PG_UNITS = ['boxes', 'nos'];

function ToggleGroup({
  options,
  value,
  onChange,
  color = 'orange',
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
    orange: 'bg-orange-600 text-white border-orange-600 shadow-sm',
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
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function BlastingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
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
    if (!formData.material_type) errors.push('Material type is required');
    if (formData.date > today) errors.push('Date cannot be in the future');
    if (errors.length > 0) {
      setErrorStatus(errors.join(', '));
      return false;
    }
    setErrorStatus(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Bomb className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Blasting Record</h3>
          <p className="text-sm text-slate-500">Record explosives used for blasting</p>
        </div>
      </div>

      {errorStatus && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorStatus}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date Row */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            max={today}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Material Type */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Material Type <span className="text-red-500">*</span>
          </label>
          <ToggleGroup options={MATERIAL_TYPES} value={formData.material_type} onChange={(v) => setFormData({ ...formData, material_type: v })} color="orange" />
        </div>

        {/* Explosives Grid */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ED (nos)</label>
            <input
              type="number"
              step="0.01"
              value={formData.ed_nos}
              onChange={(e) => setFormData({ ...formData, ed_nos: e.target.value })}
              required
              min="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 text-sm"
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
              required
              min="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 text-sm"
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
              required
              min="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 text-sm"
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
              required
              min="0"
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        {/* PG Quantity & Unit */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">PG Quantity</label>
            <input
              type="number"
              step="0.01"
              value={formData.pg_nos}
              onChange={(e) => setFormData({ ...formData, pg_nos: e.target.value })}
              required
              min="0"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">PG Unit</label>
            <ToggleGroup options={PG_UNITS} value={formData.pg_unit} onChange={(v) => setFormData({ ...formData, pg_unit: v })} color="orange" />
          </div>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm resize-none"
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-semibold shadow-md shadow-orange-600/20"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Saving...' : 'Save Blasting Record'}
        </button>
      </div>
    </form>
  );
}
