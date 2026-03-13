import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Package } from 'lucide-react';

interface DispatchFormProps {
  onSuccess: () => void;
}

export function DispatchForm({ onSuccess }: DispatchFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dispatch_number: '',
    material_type: '',
    quantity_dispatched: '',
    quantity_received: '',
    unit: 'tons',
    transportation_mode: '',
    vehicle_number: '',
    driver_name: '',
    driver_contact: '',
    destination: '',
    customer_name: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_status: 'dispatched',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('dispatch_list')
        .insert([{
          dispatch_number: formData.dispatch_number,
          material_type: formData.material_type,
          quantity_dispatched: parseFloat(formData.quantity_dispatched),
          quantity_received: formData.quantity_received ? parseFloat(formData.quantity_received) : 0,
          unit: formData.unit,
          transportation_mode: formData.transportation_mode,
          vehicle_number: formData.vehicle_number || null,
          driver_name: formData.driver_name || null,
          driver_contact: formData.driver_contact || null,
          destination: formData.destination,
          customer_name: formData.customer_name,
          dispatch_date: formData.dispatch_date,
          expected_delivery_date: formData.expected_delivery_date || null,
          delivery_status: formData.delivery_status,
          notes: formData.notes || null,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Dispatch record created successfully!');
      setFormData({
        dispatch_number: '',
        material_type: '',
        quantity_dispatched: '',
        quantity_received: '',
        unit: 'tons',
        transportation_mode: '',
        vehicle_number: '',
        driver_name: '',
        driver_contact: '',
        destination: '',
        customer_name: '',
        dispatch_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        delivery_status: 'dispatched',
        notes: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalance = () => {
    const dispatched = parseFloat(formData.quantity_dispatched) || 0;
    const received = parseFloat(formData.quantity_received) || 0;
    return dispatched - received;
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Truck className="w-5 h-5 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">New Dispatch Entry</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Dispatch Number *
          </label>
          <input
            type="text"
            required
            value={formData.dispatch_number}
            onChange={(e) => setFormData({ ...formData, dispatch_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="e.g., DSP-2024-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Customer Name *
          </label>
          <input
            type="text"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter customer name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Type *
          </label>
          <select
            required
            value={formData.material_type}
            onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Select Material</option>
            <option value="aggregate">Aggregate</option>
            <option value="crushed_stone">Crushed Stone</option>
            <option value="sand">Sand</option>
            <option value="gravel">Gravel</option>
            <option value="boulders">Boulders</option>
            <option value="limestone">Limestone</option>
            <option value="granite">Granite</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Destination *
          </label>
          <input
            type="text"
            required
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter destination address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity Dispatched *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              required
              value={formData.quantity_dispatched}
              onChange={(e) => setFormData({ ...formData, quantity_dispatched: e.target.value })}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.00"
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="tons">Tons</option>
              <option value="cubic_meters">Cubic M³</option>
              <option value="loads">Loads</option>
              <option value="kg">Kg</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity Received
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quantity_received}
            onChange={(e) => setFormData({ ...formData, quantity_received: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        {(formData.quantity_dispatched || formData.quantity_received) && (
          <div className="md:col-span-2">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Balance Material:</span>
                </div>
                <span className={`text-lg font-bold ${calculateBalance() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {calculateBalance().toFixed(2)} {formData.unit}
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Transportation Mode *
          </label>
          <select
            required
            value={formData.transportation_mode}
            onChange={(e) => setFormData({ ...formData, transportation_mode: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Select Mode</option>
            <option value="truck">Truck</option>
            <option value="dumper">Dumper</option>
            <option value="trailer">Trailer</option>
            <option value="rail">Rail</option>
            <option value="conveyor">Conveyor Belt</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Number
          </label>
          <input
            type="text"
            value={formData.vehicle_number}
            onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="e.g., ABC-1234"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Driver Name
          </label>
          <input
            type="text"
            value={formData.driver_name}
            onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter driver name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Driver Contact
          </label>
          <input
            type="tel"
            value={formData.driver_contact}
            onChange={(e) => setFormData({ ...formData, driver_contact: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Phone number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Dispatch Date *
          </label>
          <input
            type="date"
            required
            value={formData.dispatch_date}
            onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Expected Delivery Date
          </label>
          <input
            type="date"
            value={formData.expected_delivery_date}
            onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Delivery Status *
          </label>
          <select
            required
            value={formData.delivery_status}
            onChange={(e) => setFormData({ ...formData, delivery_status: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="dispatched">Dispatched</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Any additional information about this dispatch..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Dispatch'}
        </button>
      </div>
    </form>
  );
}
