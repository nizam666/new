import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Hash, User, AlertCircle, Save, X } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  company: string;
}

interface CustomerVehicleFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any;
}

const VEHICLE_TYPES = [
  'tractor',
  '2 unit tipper',
  '4 unit tipper',
  '10 wheeler tipper',
  '12 wheeler tipper',
  '14 wheeler tipper'
];

export function CustomerVehicleForm({ onSuccess, onCancel, initialData }: CustomerVehicleFormProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    customer_id: initialData?.customer_id || '',
    vehicle_number: initialData?.vehicle_number || '',
    vehicle_type: initialData?.vehicle_type || '10 wheeler tipper'
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company')
        .order('name');
        
      if (error) throw error;
      setCustomers(data || []);
      
      // Auto-select first customer if creating new and customers exist
      if (!initialData && data && data.length > 0 && !formData.customer_id) {
        setFormData(prev => ({ ...prev, customer_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setLoading(true);

    try {
      // Data normalization
      const vehicleNumber = formData.vehicle_number.trim().toUpperCase();

      if (!vehicleNumber) throw new Error("Vehicle number is required");
      if (!formData.customer_id) throw new Error("Customer selection is required");

      const payload = {
        customer_id: formData.customer_id,
        vehicle_number: vehicleNumber,
        vehicle_type: formData.vehicle_type,
        updated_at: new Date().toISOString()
      };

      if (initialData?.id) {
        const { error: updateError } = await supabase
          .from('customer_vehicles')
          .update(payload)
          .eq('id', initialData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('customer_vehicles')
          .insert([payload]);

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(`Vehicle ${vehicleNumber} is already registered in the system.`);
          }
          throw insertError;
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the vehicle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {initialData ? 'Edit Vehicle' : 'Register New Vehicle'}
          </h3>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Link */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Owner / Customer *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  required
                  disabled={loadingCustomers}
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50 font-medium"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company ? `${c.company} (${c.name})` : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle Number */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Vehicle Number (License Plate) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Hash className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="TN01AB1234"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.replace(/\s+/g, '').toUpperCase() })}
                  className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold uppercase tracking-wider"
                />
              </div>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Vehicle Type *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Truck className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  required
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium capitalize"
                >
                  {VEHICLE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || loadingCustomers}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {initialData ? 'Update Vehicle' : 'Register Vehicle'}
          </button>
        </div>
      </form>
    </div>
  );
}
