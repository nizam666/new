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

const locationTypes = [
  'Quarry',
  'Stockyard',
  'Crusher'
];

const getToLocationOptions = (fromLocation: string) => {
  if (!fromLocation) return locationTypes;

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
    from_location: '',
    to_location: '',
    distance_km: '',
    fuel_consumed: '',
    material_transported: '',
    quantity: '',
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
    } else {
      setFormData(prev => ({
        ...prev,
        material_transported: material,
        from_location: prev.from_location === 'Crusher' ? '' : prev.from_location,
        to_location: prev.to_location === 'Crusher' ? '' : prev.to_location
      }));
    }
  };

  const handleLocationChange = (fromLocation: string) => {
    // Don't allow changing locations when 'Aggregate's Rehandling' is selected
    if (formData.material_transported === "Aggregate's Rehandling") {
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
            from_location: formData.from_location,
            to_location: formData.to_location,
            distance_km: parseFloat(formData.distance_km) || 0,
            fuel_consumed: parseFloat(formData.fuel_consumed) || 0,
            material_transported: formData.material_transported,
            quantity: parseFloat(formData.quantity) || 0,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        vehicle_type: '',
        from_location: '',
        to_location: '',
        distance_km: '',
        fuel_consumed: '',
        material_transported: '',
        quantity: '',
        notes: ''
      });

      alert('Transport record submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error submitting transport record: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
            Vehicle Type
          </label>
          <select
            value={formData.vehicle_type}
            onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select vehicle type</option>
            {vehicleTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Transported *
          </label>
          <select
            value={formData.material_transported}
            onChange={(e) => handleMaterialChange(e.target.value)}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select material type</option>
            {materialTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            From Location *
          </label>
          <select
            value={formData.from_location}
            onChange={(e) => handleLocationChange(e.target.value)}
            required
            disabled={formData.material_transported === "Aggregate's Rehandling"}
            className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${formData.material_transported === "Aggregate's Rehandling" ? 'bg-gray-100' : ''
              }`}
          >
            <option value="">Select source location</option>
            {locationTypes.map((location) => (
              <option key={`from-${location}`} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            To Location *
          </label>
          <select
            value={formData.to_location}
            onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
            required
            disabled={!formData.from_location || formData.material_transported === "Aggregate's Rehandling"}
            className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${!formData.from_location || formData.material_transported === "Aggregate's Rehandling" ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            <option value="">
              {formData.material_transported === "Aggregate's Rehandling"
                ? 'Crusher to Crusher (auto-set)'
                : formData.from_location
                  ? 'Select destination'
                  : 'Select source location first'}
            </option>
            {getToLocationOptions(formData.from_location).map((location) => (
              <option key={`to-${location}`} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Distance (km)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.distance_km}
            onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="0.0"
          />
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
