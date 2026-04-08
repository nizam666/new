import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Drill, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const LOCATIONS = ['Site 1', 'Storage Bay'];
const MATERIAL_TYPES = ['Good Boulders', 'Weathered Rocks', 'Soil'];
const EQUIPMENT_OPTIONS = ['Tractor', 'Bore'];

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

  const rodSteps = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5];

  type RodMeasurementsType = Record<string, number>;

  const initialRodState = rodSteps.reduce((acc, step) => {
    const key = step.toString().replace('.', '_');
    acc[`rod${key}`] = 0;
    acc[`rod${key}_set2`] = 0;
    return acc;
  }, {} as RodMeasurementsType);

  const [rodMeasurements, setRodMeasurements] = useState<RodMeasurementsType>(initialRodState);

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.location) errors.push('Location is required');
    if (!formData.equipment_used) errors.push('Equipment used is required');
    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    setError(null);
    return true;
  };

  const calcHoles1 = () => rodSteps.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}`] || 0), 0);
  const calcFeet1 = () => rodSteps.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}`] || 0) * step, 0);
  const calcHoles2 = () => rodSteps.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}_set2`] || 0), 0);
  const calcFeet2 = () => rodSteps.reduce((s, step) => s + (rodMeasurements[`rod${step.toString().replace('.', '_')}_set2`] || 0) * step, 0);
  const totalHoles = () => calcHoles1() + calcHoles2();
  const totalFeet = () => calcFeet1() + calcFeet2();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('User not authenticated'); return; }
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
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
      setRodMeasurements(initialRodState);
      toast.success('Drilling record saved successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save: ${msg}`);
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Drill className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Drilling Record</h3>
          <p className="text-sm text-slate-500">Enter rod counts then fill details below</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════
          ROD MEASUREMENTS  (top section)
      ══════════════════════════════════════ */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden mb-6">

        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_1fr] items-center bg-slate-100 border-b border-slate-200 px-4 py-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-20">Size</span>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Set 1 (qty)</span>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider text-center">Set 2 (qty)</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {rodSteps.map((num) => {
            const k1 = `rod${num.toString().replace('.', '_')}`;
            const k2 = `rod${num.toString().replace('.', '_')}_set2`;
            const isHalf = num === 0.5;
            return (
              <div
                key={num}
                className={`grid grid-cols-[auto_1fr_1fr] items-center gap-3 px-4 py-2 ${isHalf ? 'bg-amber-50/60 border-t-2 border-amber-200' : ''}`}
              >
                {/* Size label */}
                <div className="w-20">
                  <span className={`inline-flex items-center justify-center w-14 h-7 rounded-lg text-sm font-bold
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
                    className="w-24 px-3 py-1.5 text-center border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-sm font-medium"
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
                    className="w-24 px-3 py-1.5 text-center border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 text-sm font-medium"
                    placeholder="0"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals row */}
        <div className="grid grid-cols-[auto_1fr_1fr] items-center bg-slate-100 border-t-2 border-slate-300 px-4 py-3 gap-3">
          <div className="w-20">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Totals</span>
          </div>
          <div className="text-center space-y-0.5">
            <div className="text-lg font-bold text-blue-700">{calcHoles1()} holes</div>
            <div className="text-xs text-blue-500 font-medium">{calcFeet1().toFixed(1)} ft</div>
          </div>
          <div className="text-center space-y-0.5">
            <div className="text-lg font-bold text-emerald-700">{calcHoles2()} holes</div>
            <div className="text-xs text-emerald-500 font-medium">{calcFeet2().toFixed(1)} ft</div>
          </div>
        </div>
      </div>

      {/* Combined summary */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-slate-800 text-white rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Holes</div>
          <div className="text-2xl font-bold">{totalHoles()}</div>
        </div>
        <div className="bg-slate-800 text-white rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Feet</div>
          <div className="text-2xl font-bold">{totalFeet().toFixed(1)}<span className="text-sm text-slate-400 ml-1">ft</span></div>
        </div>
        <div className="bg-emerald-700 text-white rounded-xl p-4 text-center">
          <div className="text-xs text-emerald-300 uppercase tracking-wider mb-1">Est. Production</div>
          <div className="text-2xl font-bold">{(totalFeet() * 0.8).toFixed(1)}<span className="text-sm text-emerald-300 ml-1">t</span></div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          FORM DETAILS  (bottom section)
      ══════════════════════════════════════ */}
      <div className="border-t border-slate-200 pt-6 space-y-5">

        {/* Date + Diesel on one row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Diesel Consumed (L)</label>
            <input
              type="number"
              step="0.01"
              value={formData.diesel_consumed}
              onChange={(e) => setFormData({ ...formData, diesel_consumed: e.target.value })}
              min="0"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Location toggle buttons */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <ToggleGroup options={LOCATIONS} value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} color="blue" />
        </div>

        {/* Material Type toggle buttons */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Material Type</label>
          <ToggleGroup options={MATERIAL_TYPES} value={formData.material_type} onChange={(v) => setFormData({ ...formData, material_type: v })} color="orange" />
        </div>

        {/* Equipment toggle buttons */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Equipment Used <span className="text-red-500">*</span>
          </label>
          <ToggleGroup options={EQUIPMENT_OPTIONS} value={formData.equipment_used} onChange={(v) => setFormData({ ...formData, equipment_used: v })} color="emerald" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            placeholder="Additional notes..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2 pb-6">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-semibold shadow-md shadow-blue-600/20"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Drilling Record'}
          </button>
        </div>
      </div>
    </form>
  );
}
