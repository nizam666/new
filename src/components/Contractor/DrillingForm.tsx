import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Drill, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

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
  
  const rodSteps = [
    10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 
    5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5
  ];

  type RodMeasurementsType = Record<string, number>;

  // Initialize all values to 0 dynamically
  const initialRodState = rodSteps.reduce((acc, step) => {
    const key = step.toString().replace('.', '_');
    acc[`rod${key}`] = 0;
    acc[`rod${key}_set2`] = 0;
    return acc;
  }, {} as RodMeasurementsType);

  const [rodMeasurements, setRodMeasurements] = useState<RodMeasurementsType>(initialRodState);
  const [showRodPopup, setShowRodPopup] = useState(false);

  // Validate form data
  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.location) {
      errors.push('Location is required');
    }
    if (!formData.equipment_used) {
      errors.push('Equipment used is required');
    }
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    
    setError(null);
    return true;
  };

  const calculateTotalHolesSet1 = () => {
    let sum = 0;
    rodSteps.forEach(step => {
      const key = `rod${step.toString().replace('.', '_')}`;
      sum += (rodMeasurements[key] || 0);
    });
    return sum;
  };
  
  const calculateTotalFeetSet1 = () => {
    let sum = 0;
    rodSteps.forEach(step => {
      const key = `rod${step.toString().replace('.', '_')}`;
      sum += (rodMeasurements[key] || 0) * step;
    });
    return sum;
  };

  const calculateTotalHolesSet2 = () => {
    let sum = 0;
    rodSteps.forEach(step => {
      const key = `rod${step.toString().replace('.', '_')}_set2`;
      sum += (rodMeasurements[key] || 0);
    });
    return sum;
  };

  const calculateTotalFeetSet2 = () => {
    let sum = 0;
    rodSteps.forEach(step => {
      const key = `rod${step.toString().replace('.', '_')}_set2`;
      sum += (rodMeasurements[key] || 0) * step;
    });
    return sum;
  };

  const calculateOverallHoles = () => calculateTotalHolesSet1() + calculateTotalHolesSet2();
  const calculateOverallFeet = () => calculateTotalFeetSet1() + calculateTotalFeetSet2();

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
      // Split measurements for DB structure
      const set1Data: Record<string, number> = {};
      const set2Data: Record<string, number> = {};

      Object.keys(rodMeasurements).forEach(key => {
        if (key.endsWith('_set2')) {
          set2Data[key] = rodMeasurements[key];
        } else {
          set1Data[key] = rodMeasurements[key];
        }
      });
      
      const drillingData = {
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
      };

      const { error } = await supabase
        .from('drilling_records')
        .insert([drillingData])
        .select();

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        location: '',
        material_type: '',
        equipment_used: '',
        diesel_consumed: '',
        notes: ''
      });

      setRodMeasurements(initialRodState);

      toast.success('Drilling record saved successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(`Failed to save drilling record: ${errorMessage}`);
      toast.error(`Failed to save: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const RodMeasurementPopup = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Measurements</h3>
          <p className="text-sm text-slate-500 mb-4">Please input measurements directly on the main form.</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowRodPopup(false)}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
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
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Drill className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Drilling Record</h3>
          <p className="text-sm text-slate-600">Record daily drilling operations</p>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Location
          </label>
          <select
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select location</option>
            <option value="Site 1">Site 1</option>
            <option value="Storage Bay">Storage Bay</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Type
          </label>
          <select
            value={formData.material_type}
            onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select material type</option>
            <option value="Good Boulders">Good Boulders</option>
            <option value="Weathered Rocks">Weathered Rocks</option>
            <option value="Soil">Soil</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Equipment Used
          </label>
          <select
            value={formData.equipment_used}
            onChange={(e) => setFormData({ ...formData, equipment_used: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select equipment</option>
            <option value="Tractor">Tractor</option>
            <option value="Bore">Bore</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Diesel Consumed (L)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.diesel_consumed}
            onChange={(e) => setFormData({ ...formData, diesel_consumed: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Additional notes..."
          />
        </div>

      </div>

      {/* Rod Measurements Section */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Rod Measurements</h3>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Set 1 */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <h4 className="text-lg font-semibold text-blue-600 mb-4">Set 1</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {rodSteps.map((num) => {
                const key = `rod${num.toString().replace('.', '_')}`;
                return (
                 <div key={`set1-${num}`}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {num}ft (qty)
                    </label>
                    <input
                      type="number"
                      value={rodMeasurements[key] === 0 ? '' : rodMeasurements[key]}
                      onChange={(e) => setRodMeasurements({
                        ...rodMeasurements,
                        [key]: parseInt(e.target.value) || 0
                      })}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0"
                    />
                 </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
              <div className="font-semibold text-slate-900">
                Holes: {calculateTotalHolesSet1()}
              </div>
              <div className="font-semibold text-blue-600">
                Feet: {calculateTotalFeetSet1().toFixed(1)}
              </div>
            </div>
          </div>

          {/* Set 2 */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <h4 className="text-lg font-semibold text-emerald-600 mb-4">Set 2</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {rodSteps.map((num) => {
                const key = `rod${num.toString().replace('.', '_')}_set2`;
                return (
                 <div key={`set2-${num}`}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {num}ft (qty)
                    </label>
                    <input
                      type="number"
                      value={rodMeasurements[key] === 0 ? '' : rodMeasurements[key]}
                      onChange={(e) => setRodMeasurements({
                        ...rodMeasurements,
                        [key]: parseInt(e.target.value) || 0
                      })}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="0"
                    />
                 </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
              <div className="font-semibold text-slate-900">
                Holes: {calculateTotalHolesSet2()}
              </div>
              <div className="font-semibold text-emerald-600">
                Feet: {calculateTotalFeetSet2().toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-6 bg-slate-800 rounded-xl shadow-inner border border-slate-700 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-600">
            <div className="px-4">
              <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Combined Total Holes</div>
              <div className="text-3xl font-bold">
                {calculateOverallHoles()}
              </div>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Combined Total Feet</div>
              <div className="text-3xl font-bold">
                {calculateOverallFeet().toFixed(1)}<span className="text-lg text-slate-500 ml-1">ft</span>
              </div>
            </div>
            <div className="px-4 pt-4 md:pt-0">
              <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Approx Production</div>
              <div className="text-3xl font-bold text-emerald-400">
                {(calculateOverallFeet() * 0.8).toFixed(2)}<span className="text-lg text-emerald-600/70 ml-1">tons</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end pb-8">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-medium shadow-md shadow-blue-600/20"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Saving Record...' : 'Save Drilling Record'}
        </button>
      </div>

      {showRodPopup && <RodMeasurementPopup />}
    </form>
  );
}
