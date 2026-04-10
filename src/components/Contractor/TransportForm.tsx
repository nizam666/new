import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Save } from 'lucide-react';

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

const locationTypes = [
  'Quarry',
  'Stockyard',
  'Crusher',
  'Soil dumping yard'
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
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error submitting transport record:', error);
      alert('Error submitting transport record: ' + (error.message || error.details || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}
