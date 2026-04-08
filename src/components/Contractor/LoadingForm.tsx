import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const MATERIAL_TYPES = [
  'KVSS Good Boulders',
  'KVSS Weather Rocks',
  'KVSS Soil',
  'SBBM Slurry Work',
  'SBBM Stockyard Good Boulders',
  'Aggregates rehandling/ Aggregate Loading',
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
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    material_type: '',
    vehicle_used: '',
    diesel: '',
    breaker_bucket: '',
    starting_hours: '',
    ending_hours: '',
    notes: ''
  });

  const getRunningHours = () => {
    const start = parseFloat(formData.starting_hours);
    const end = parseFloat(formData.ending_hours);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return (end - start).toFixed(1);
    }
    return '0.0';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.material_type || !formData.vehicle_used || !formData.breaker_bucket) {
      toast.error('Please select all required fields', { position: 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('loading_records')
        .insert([
          {
            contractor_id: user.id,
            date: formData.date,
            material_type: formData.material_type,
            vehicle_used: formData.vehicle_used,
            destination: formData.diesel,
            breaker_bucket: formData.breaker_bucket,
            starting_hours: parseFloat(formData.starting_hours) || 0,
            ending_hours: parseFloat(formData.ending_hours) || 0,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        material_type: '',
        vehicle_used: '',
        diesel: '',
        breaker_bucket: '',
        starting_hours: '',
        ending_hours: '',
        notes: ''
      });

      toast.success('Breaking/Loading record submitted successfully!', { position: 'top-right' });
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error submitting loading record: ' + (error instanceof Error ? error.message : 'Unknown error'), { position: 'top-right' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Breaking/Loading Record</h3>
          <p className="text-xs sm:text-sm text-slate-600">Track material breaking and loading operations</p>
        </div>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {/* Date */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Material Type */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Material Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {MATERIAL_TYPES.map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => setFormData({ ...formData, material_type: material })}
                className={`p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] font-bold text-left text-xs sm:text-sm ${
                  formData.material_type === material
                    ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-green-300'
                }`}
                title={material}
              >
                {material}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Used */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Vehicle Used <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {VEHICLE_TYPES.map((vehicle) => (
              <button
                key={vehicle}
                type="button"
                onClick={() => setFormData({ ...formData, vehicle_used: vehicle })}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-xs sm:text-sm ${
                  formData.vehicle_used === vehicle
                    ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-green-300'
                }`}
              >
                {vehicle}
              </button>
            ))}
          </div>
        </div>

        {/* Breaker/Bucket */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg sm:rounded-2xl border border-slate-100">
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Breaker/Bucket <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {BREAKER_BUCKET_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFormData({ ...formData, breaker_bucket: option })}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-xs sm:text-sm ${
                  formData.breaker_bucket === option
                    ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-green-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Diesel */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
            Diesel (Liters)
          </label>
          <input
            type="text"
            value={formData.diesel}
            onChange={(e) => setFormData({ ...formData, diesel: e.target.value })}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter diesel quantity"
          />
        </div>

        {/* Hours Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
              Starting Hours
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.starting_hours}
              onChange={(e) => setFormData({ ...formData, starting_hours: e.target.value })}
              required
              min="0"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0.0"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">
              Ending Hours
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.ending_hours}
              onChange={(e) => setFormData({ ...formData, ending_hours: e.target.value })}
              required
              min="0"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0.0"
            />
          </div>
        </div>

        {/* Calculated Running Hours Display */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg sm:rounded-2xl p-4 text-center">
          <div className="text-[10px] sm:text-xs text-emerald-600 uppercase font-bold tracking-widest mb-1">
            Running Hours Result
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-700 leading-none">
            {getRunningHours()} <span className="text-xs sm:text-sm font-normal opacity-70">hrs</span>
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

        {/* Submit Button */}
        <div className="flex justify-center pt-2 sm:pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-green-600 text-white font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-600/20"
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            {loading ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </div>
    </form>
  );
}
