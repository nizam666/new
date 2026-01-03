import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Fuel, Save } from 'lucide-react';

const vehicleTypes = [
  'Truck',
  'Loader',
  'Excavator',
  'Dumper',
  'Drill Rig',
  'Crusher',
  'Generator',
  'Other'
];

const fuelTypes = [
  'Diesel',
  'Petrol'
];

export function FuelForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const generateRecordNumber = () => {
    const prefix = 'FUEL';
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `${prefix}-${new Date().getFullYear()}-${randomNum}`;
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicle_number: generateRecordNumber(),
    vehicle_type: '',
    fuel_type: '',
    quantity_liters: '',
    cost_per_liter: '',
    odometer_reading: '',
    supplier: '',
    receipt_number: '',
    notes: ''
  });

  const totalCost = (parseFloat(formData.quantity_liters) || 0) * (parseFloat(formData.cost_per_liter) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('fuel_records')
        .insert([
          {
            user_id: user.id,
            date: formData.date,
            vehicle_number: formData.vehicle_number,
            vehicle_type: formData.vehicle_type,
            fuel_type: formData.fuel_type,
            quantity_liters: parseFloat(formData.quantity_liters) || 0,
            cost_per_liter: parseFloat(formData.cost_per_liter) || 0,
            total_cost: totalCost,
            odometer_reading: formData.odometer_reading ? parseFloat(formData.odometer_reading) : null,
            supplier: formData.supplier,
            receipt_number: formData.receipt_number,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        vehicle_number: generateRecordNumber(),
        vehicle_type: '',
        fuel_type: '',
        quantity_liters: '',
        cost_per_liter: '',
        odometer_reading: '',
        supplier: '',
        receipt_number: '',
        notes: ''
      });

      alert('Fuel record submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error submitting fuel record: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <Fuel className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Fuel Record</h3>
          <p className="text-sm text-slate-600">Track fuel consumption and costs</p>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Record Number
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.vehicle_number}
              readOnly
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed"
              aria-label="Auto-generated record number"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-sm">
              Auto-generated
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Type
          </label>
          <select
            value={formData.vehicle_type}
            onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Select vehicle type</option>
            {vehicleTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Fuel Type
          </label>
          <select
            value={formData.fuel_type}
            onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Select fuel type</option>
            {fuelTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity (liters)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quantity_liters}
            onChange={(e) => setFormData({ ...formData, quantity_liters: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cost per Liter
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.cost_per_liter}
            onChange={(e) => setFormData({ ...formData, cost_per_liter: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Total Cost
          </label>
          <input
            type="text"
            value={totalCost.toFixed(2)}
            readOnly
            className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-semibold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Odometer Reading (optional)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.odometer_reading}
            onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="0.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Supplier
          </label>
          <input
            type="text"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Fuel supplier name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Receipt Number
          </label>
          <input
            type="text"
            value={formData.receipt_number}
            onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Receipt #"
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Additional details..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
