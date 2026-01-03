import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Drill, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface RodMeasurement {
  rod10: number;
  rod9: number;
  rod8: number;
  rod7: number;
  rod6: number;
  rod5: number;
  rod4: number;
  rod3: number;
  rod2: number;
  rod1: number;
  rod10_set2: number;
  rod9_set2: number;
  rod8_set2: number;
  rod7_set2: number;
  rod6_set2: number;
  rod5_set2: number;
  rod4_set2: number;
  rod3_set2: number;
  rod2_set2: number;
  rod1_set2: number;
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
  const [showRodPopup, setShowRodPopup] = useState(false);
  const [rodMeasurements, setRodMeasurements] = useState<RodMeasurement>({
    rod10: 0,
    rod9: 0,
    rod8: 0,
    rod7: 0,
    rod6: 0,
    rod5: 0,
    rod4: 0,
    rod3: 0,
    rod2: 0,
    rod1: 0,
    rod10_set2: 0,
    rod9_set2: 0,
    rod8_set2: 0,
    rod7_set2: 0,
    rod6_set2: 0,
    rod5_set2: 0,
    rod4_set2: 0,
    rod3_set2: 0,
    rod2_set2: 0,
    rod1_set2: 0
  });

  // Validate form data
  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.location) {
      errors.push('Location is required');
    }
    if (!formData.equipment_used) {
      errors.push('Equipment used is required');
    }
    
    // Material type is not required as per the database schema
    
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
      console.log('Current user ID:', user.id);
      
      const drillingData = {
        contractor_id: user.id,
        date: formData.date,
        location: formData.location,
        material_type: formData.material_type || null,
        equipment_used: formData.equipment_used,
        diesel_consumed: parseFloat(formData.diesel_consumed) || 0,
        notes: formData.notes || null,
        status: 'pending',
        rod_measurements: rodMeasurements, 
        created_at: new Date().toISOString()
      };

      console.log('Submitting drilling data:', drillingData);

      // First check if we can access the table
      console.log('Checking access to drilling_records table...');
      const { error: tableError } = await supabase
        .from('drilling_records')
        .select('*')
        .limit(1);

      if (tableError) {
        console.error('Error accessing drilling_records table:', tableError);
        throw new Error(`Database error: ${tableError.message}`);
      }

      console.log('Table access successful, proceeding with insert...');
      const { data, error } = await supabase
        .from('drilling_records')
        .insert([drillingData])
        .select();

      console.log('Insert response:', { data, error });

      if (error) {
        console.error('Detailed error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      setFormData({
        date: new Date().toISOString().split('T')[0],
        location: '',
        material_type: '',
        equipment_used: '',
        diesel_consumed: '',
        notes: ''
      });

      // Reset form including rod measurements
      setRodMeasurements({
        rod10: 0,
        rod9: 0,
        rod8: 0,
        rod7: 0,
        rod6: 0,
        rod5: 0,
        rod4: 0,
        rod3: 0,
        rod2: 0,
        rod1: 0,
        rod10_set2: 0,
        rod9_set2: 0,
        rod8_set2: 0,
        rod7_set2: 0,
        rod6_set2: 0,
        rod5_set2: 0,
        rod4_set2: 0,
        rod3_set2: 0,
        rod2_set2: 0,
        rod1_set2: 0
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      let errorMessage = 'An unknown error occurred';
      
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      setError(`Failed to save drilling record: ${errorMessage}`);
      toast.error(`Failed to save: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalRodsSet1 = () => {
    return Object.values(rodMeasurements).reduce((sum, value) => sum + value, 0);
  };

  const RodMeasurementPopup = () => {
    const calculateTotal = () => {
      return Object.values(rodMeasurements).reduce((sum, value) => sum + value, 0);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Rod Measurements</h3>
          
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
            <div key={num} className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rod {num} (feet)
              </label>
              <input
                type="number"
                value={rodMeasurements[`rod${num}` as keyof RodMeasurement]}
                onChange={(e) => setRodMeasurements({
                  ...rodMeasurements,
                  [`rod${num}`]: parseFloat(e.target.value) || 0
                })}
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="font-semibold text-slate-900">
              Total: {calculateTotal()} feet
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
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

  const calculateTotalFeetSet2 = () => {
    return (
      rodMeasurements.rod10_set2 * 10 +
      rodMeasurements.rod9_set2 * 9 +
      rodMeasurements.rod8_set2 * 8 +
      rodMeasurements.rod7_set2 * 7 +
      rodMeasurements.rod6_set2 * 6 +
      rodMeasurements.rod5_set2 * 5 +
      rodMeasurements.rod4_set2 * 4 +
      rodMeasurements.rod3_set2 * 3 +
      rodMeasurements.rod2_set2 * 2 +
      rodMeasurements.rod1_set2 * 1
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
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Rod Measurements (10 to 1 size)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Set 1 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-600 mb-4">Set 1</h4>
            <div className="grid grid-cols-2 gap-3">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                <div key={`set1-${num}`}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {num}ft holes (qty)
                  </label>
                  <input
                    type="number"
                    value={rodMeasurements[`rod${num}` as keyof RodMeasurement] === 0 ? '' : rodMeasurements[`rod${num}` as keyof RodMeasurement]}
                    onChange={(e) => setRodMeasurements({
                      ...rodMeasurements,
                      [`rod${num}`]: parseFloat(e.target.value) || 0
                    })}
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900">
                Total Holes: {calculateTotalRodsSet1()} holes
              </div>
              <div className="font-semibold text-blue-600">
                Total Feet: {calculateTotalRodsSet1()} ft
              </div>
            </div>
          </div>

          {/* Set 2 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-emerald-600 mb-4">Set 2</h4>
            <div className="grid grid-cols-2 gap-3">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
                <div key={`set2-${num}`}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {num}ft holes (qty)
                  </label>
                  <input
                    type="number"
                    value={rodMeasurements[`rod${num}_set2` as keyof RodMeasurement] === 0 ? '' : rodMeasurements[`rod${num}_set2` as keyof RodMeasurement]}
                    onChange={(e) => setRodMeasurements({
                      ...rodMeasurements,
                      [`rod${num}_set2`]: parseFloat(e.target.value) || 0
                    })}
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900">
                Total Holes: {calculateTotalRodsSet1()} holes
              </div>
              <div className="font-semibold text-emerald-600">
                Total Feet: {calculateTotalFeetSet2()} ft
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-slate-600">Combined Total Holes</div>
              <div className="text-xl font-bold text-slate-900">
                {calculateTotalRodsSet1() + calculateTotalRodsSet1()} holes
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Combined Total Feet</div>
              <div className="text-xl font-bold text-slate-900">
                {(calculateTotalRodsSet1() + calculateTotalFeetSet2()).toFixed(1)} ft
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Approx Production (tons)</div>
              <div className="text-xl font-bold text-emerald-600">
                {((calculateTotalRodsSet1() + calculateTotalFeetSet2()) * 0.8).toFixed(2)} tons
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>

      {showRodPopup && <RodMeasurementPopup />}
    </form>
  );
}
