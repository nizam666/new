import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Save } from 'lucide-react';

const materialTypes = [
  'KVSS Good Boulders',
  'KVSS Weather Rocks',
  'KVSS Soil',
  'SBBM Slurry Work',
  'SBBM Stockyard Good Boulders',
  'Others'
];

const vehicleTypes = [
  'EX140',
  '120'
];

const breakerBucketOptions = [
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
    vehicle_owner_name: '',
    destination: '',
    breaker_bucket: '',
    starting_hours: '',
    ending_hours: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
            vehicle_owner_name: formData.vehicle_owner_name,
            destination: formData.destination,
            breaker_bucket: formData.breaker_bucket,
            starting_hours: parseFloat(formData.starting_hours) || 0,
            ending_hours: parseFloat(formData.ending_hours) || 0,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        material_type: '',
        vehicle_used: '',
        vehicle_owner_name: '',
        destination: '',
        breaker_bucket: '',
        starting_hours: '',
        ending_hours: '',
        notes: ''
      });

      alert('Breaking/Loading record submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error submitting loading record: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Breaking/Loading Record</h3>
          <p className="text-sm text-slate-600">Track material breaking and loading operations</p>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Type
          </label>
          <select
            value={formData.material_type}
            onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Select material</option>
            {materialTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Used
          </label>
          <select
            value={formData.vehicle_used}
            onChange={(e) => setFormData({ ...formData, vehicle_used: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Select vehicle</option>
            {vehicleTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Owner Name
          </label>
          <input
            type="text"
            value={formData.vehicle_owner_name}
            onChange={(e) => setFormData({ ...formData, vehicle_owner_name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter vehicle owner name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Destination
          </label>
          <input
            type="text"
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter destination location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Breaker/Bucket
          </label>
          <select
            value={formData.breaker_bucket}
            onChange={(e) => setFormData({ ...formData, breaker_bucket: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Select option</option>
            {breakerBucketOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Starting Hours
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.starting_hours}
            onChange={(e) => setFormData({ ...formData, starting_hours: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter hours"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Ending Hours
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.ending_hours}
            onChange={(e) => setFormData({ ...formData, ending_hours: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter hours"
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Loading conditions, special instructions, etc..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
