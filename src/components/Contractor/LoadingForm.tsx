import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Save } from 'lucide-react';
import { toast } from 'react-toastify';

const MATERIAL_TYPES = [
  'KVSS Good Boulders',
  'KVSS Weather Rocks',
  'KVSS Soil',
  'SBBM Slurry Work',
  'SBBM Stockyard Good Boulders',
  'Aggregates rehandling/ Aggregate Loading',
  'Face cleaning',
  'Crusher machine works',
  'Excavator bucket -> breaker change',
  'Excavator breaker -> bucket change',
  'Excavator maintenance work',
  'Excavator Diesel work',
  'Others'
];

const VEHICLE_TYPES = [
  'govindarajEX140'
];

const BREAKER_BUCKET_OPTIONS = [
  'Breaker',
  'Bucket'
];

export function LoadingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingLastHr, setFetchingLastHr] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    material_type: '',
    vehicle_used: '',
    diesel: '',
    breaker_bucket: '',
    starting_hours: '',
    ending_hours: '',
    notes: '',
    custom_material_type: ''
  });

  const getRunningHours = () => {
    const start = parseFloat(formData.starting_hours);
    const end = parseFloat(formData.ending_hours);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return (end - start).toFixed(1);
    }
    return '0.0';
  };

  const fetchLastEndingHours = useCallback(async (vehicle: string) => {
    if (!user || !vehicle) return;
    setFetchingLastHr(true);
    try {
      const { data, error } = await supabase
        .from('loading_records')
        .select('ending_hours')
        .eq('contractor_id', user.id)
        .eq('vehicle_used', vehicle)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.ending_hours > 0) {
        setFormData(prev => ({ 
          ...prev, 
          starting_hours: data.ending_hours.toString() 
        }));
      }
    } catch (err) {
      console.error('Error fetching last ending hours:', err);
    } finally {
      setFetchingLastHr(false);
    }
  }, [user]);

  useEffect(() => {
    if (VEHICLE_TYPES.length === 1 && !formData.vehicle_used) {
      setFormData(prev => ({ ...prev, vehicle_used: VEHICLE_TYPES[0] }));
    }
  }, [formData.vehicle_used]);

  useEffect(() => {
    if (formData.vehicle_used) {
      fetchLastEndingHours(formData.vehicle_used);
    }
  }, [formData.vehicle_used, fetchLastEndingHours]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submission attempt started', { user, formData });

    if (!user) {
      toast.error('User session not found. Please log in again.', { position: 'top-right' });
      return;
    }

    if (!formData.material_type || !formData.vehicle_used || !formData.breaker_bucket || !formData.diesel.trim()) {
      const missing = [];
      if (!formData.material_type) missing.push('Material Type');
      if (!formData.vehicle_used) missing.push('Vehicle');
      if (!formData.breaker_bucket) missing.push('Equipment Setting (Breaker/Bucket)');
      if (!formData.diesel.trim()) missing.push('Diesel Refilled');
      
      toast.error(`Please fill: ${missing.join(', ')}`, { position: 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const insertData = {
        contractor_id: user.id,
        date: formData.date,
        material_type: formData.material_type === 'Others' ? formData.custom_material_type : formData.material_type,
        vehicle_used: formData.vehicle_used,
        quantity_loaded: parseFloat(formData.diesel) || 0, // Store diesel in quantity_loaded temporarily
        breaker_bucket: formData.breaker_bucket,
        starting_hours: parseFloat(formData.starting_hours) || 0,
        ending_hours: parseFloat(formData.ending_hours) || 0,
        destination: formData.notes.trim() || null, // Store notes in destination temporarily
        status: 'pending'
      };

      console.log('Inserting data:', insertData);

      const { error } = await supabase
        .from('loading_records')
        .insert([insertData]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        material_type: '',
        vehicle_used: '',
        diesel: '',
        breaker_bucket: '',
        starting_hours: '',
        ending_hours: '',
        notes: '',
        custom_material_type: ''
      });

      toast.success('Excavator breaking/loading record submitted successfully!', { position: 'top-right' });
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Loading record submission error:', error);
      const detail = error.message || error.details || 'Check internet/permissions';
      const hint = error.hint ? ` (Hint: ${error.hint})` : '';
      const code = error.code ? ` [${error.code}]` : '';
      toast.error(`Save Failed: ${detail}${hint}${code}`, { 
        position: 'top-right',
        autoClose: 10000 // Show longer so user can read it
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-4 sm:p-8 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-6 border-b border-slate-100">
        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200 animate-in fade-in zoom-in duration-500">
          <Truck className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">Excavator Record</h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500">Excavator breaking & loading log</p>
        </div>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {/* Date Row */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">
            Operation Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 border-slate-100 bg-slate-50/50 rounded-xl sm:rounded-2xl text-sm sm:text-base focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all font-medium text-slate-900"
          />
        </div>

        {/* Material Type Selection */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 ml-1">
            Material Type <span className="text-red-500 text-base">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {MATERIAL_TYPES.map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => setFormData({ ...formData, material_type: material })}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all duration-200 group relative overflow-hidden ${
                  formData.material_type === material
                    ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20 translate-x-1'
                    : 'bg-white border-slate-100 text-slate-600 hover:border-green-200 hover:bg-green-50/30'
                }`}
              >
                <div className="relative z-10">
                  <div className="text-sm sm:text-base font-bold truncate">{material}</div>
                </div>
                {formData.material_type === material && (
                  <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            ))}
          </div>
          
          {/* Conditional "Others" Input */}
          {formData.material_type === 'Others' && (
            <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
              <label className="block text-[10px] sm:text-xs font-black text-green-600 uppercase tracking-widest mb-2 ml-1">
                Specify Other Work Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.custom_material_type}
                onChange={(e) => setFormData({ ...formData, custom_material_type: e.target.value })}
                required
                className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 border-green-100 bg-green-50/20 rounded-xl sm:rounded-2xl text-sm sm:text-base focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all font-bold text-slate-900"
                placeholder="Type the specific work here..."
              />
            </div>
          )}
        </div>

        {/* Vehicle & Breaker Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Vehicle Used
            </label>
            <div className="flex flex-col gap-2">
              {VEHICLE_TYPES.map((vehicle) => (
                <button
                  key={vehicle}
                  type="button"
                  onClick={() => setFormData({ ...formData, vehicle_used: vehicle })}
                  className={`p-4 rounded-xl border-2 font-black text-sm uppercase tracking-wider transition-all shadow-sm ${
                    formData.vehicle_used === vehicle
                      ? 'bg-green-600 border-green-600 text-white shadow-green-200'
                      : 'bg-white border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  {vehicle}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Equipment Setting
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BREAKER_BUCKET_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormData({ ...formData, breaker_bucket: option })}
                  className={`p-3 sm:p-4 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all shadow-sm ${
                    formData.breaker_bucket === option
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Diesel Input */}
        <div className="relative">
          <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 ml-1">
            Diesel Refilled <span className="text-red-500 text-base">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={formData.diesel}
              onChange={(e) => setFormData({ ...formData, diesel: e.target.value })}
              required
              min="0"
              className="w-full px-4 sm:px-5 py-3 sm:py-4 border-2 border-slate-100 bg-slate-50/50 rounded-xl sm:rounded-2xl text-sm sm:text-base focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all font-bold text-slate-900 pr-16"
              placeholder="0.0"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-widest">
              Liters
            </div>
          </div>
        </div>

        {/* Hours Tracking Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg border border-slate-800">
          <div>
            <label className="block text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>Starting Hr</span>
              {fetchingLastHr ? (
                <span className="text-[8px] text-green-500 animate-pulse normal-case font-medium">Fetching...</span>
              ) : formData.starting_hours && (
                <span className="text-[8px] text-emerald-600 normal-case font-bold bg-emerald-100/50 px-1.5 py-0.5 rounded">Auto-filled</span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.starting_hours}
              onChange={(e) => setFormData({ ...formData, starting_hours: e.target.value })}
              required
              min="0"
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-black text-lg sm:text-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
              Ending Hr
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.ending_hours}
              onChange={(e) => setFormData({ ...formData, ending_hours: e.target.value })}
              required
              min="0"
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-black text-lg sm:text-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
            />
          </div>

          {/* Result Row */}
          <div className="col-span-2 pt-4 border-t border-white/5 mt-2">
            <div className="flex justify-between items-center text-white">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">Net Running Time</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-4xl font-black text-green-400">{getRunningHours()}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-500">hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Loading conditions, special instructions, etc..."
          />
        </div>

        {/* Submit */}
        <div className="pt-4 sm:pt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 sm:py-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black text-sm sm:text-lg uppercase tracking-widest rounded-2xl sm:rounded-3xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-8 focus:ring-green-500/10 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-green-200"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Save Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
