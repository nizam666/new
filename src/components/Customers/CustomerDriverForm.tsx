import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Save, X } from 'lucide-react';

interface DriverFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any;
}

export function CustomerDriverForm({ onSuccess, onCancel, initialData }: DriverFormProps) {
  useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    license_no: initialData?.license_no || '',
    driver_name: initialData?.driver_name || '',
    license_expiry: initialData?.license_expiry || '',
    mobile_number: initialData?.mobile_number || '',
    status: initialData?.status || 'Active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const licenseNo = formData.license_no.trim().toUpperCase();
      const driverName = formData.driver_name.trim();

      if (!licenseNo) throw new Error("License No is required");
      if (!driverName) throw new Error("Driver Name is required");
      if (!formData.license_expiry) throw new Error("License Expiry Date is required");
      if (!formData.mobile_number) throw new Error("Driver Mobile Number is required");

      const payload = {
        license_no: licenseNo,
        driver_name: driverName,
        license_expiry: formData.license_expiry,
        mobile_number: formData.mobile_number.trim(),
        status: formData.status,
        updated_at: new Date().toISOString()
      };

      if (initialData?.id) {
        const { error: updateError } = await supabase
          .from('drivers')
          .update(payload)
          .eq('id', initialData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('drivers')
          .insert([payload]);

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(`License ${licenseNo} is already registered.`);
          }
          throw insertError;
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative max-w-4xl mx-auto w-full">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
        <h3 className="text-xl font-semibold text-slate-800 tracking-wide">
          {initialData ? 'Edit Driver' : 'Add Driver'}
        </h3>
        <button 
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 bg-white">
        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* Row 1: License No | Driver Name */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                License No<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="TN2420001000053"
                value={formData.license_no}
                onChange={(e) => setFormData({ ...formData, license_no: e.target.value.replace(/\s+/g, '').toUpperCase() })}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Driver Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="mani"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400 text-slate-700"
              />
            </div>

            {/* Row 2: License Expiry Date | Driver Mobile Number */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                License Expiry Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.license_expiry}
                onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Driver Mobile Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Driver Mobile Number"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400 text-slate-700"
              />
              {!formData.mobile_number && <p className="text-xs text-red-500 mt-1">Driver Mobile Number is required.</p>}
            </div>

            {/* Row 3: Status */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Status<span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-700 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-slate-900 font-bold rounded shadow hover:bg-amber-500 transition-colors"
          >
            <X className="w-4 h-4 stroke-[3]" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#4B6B9E] text-white font-bold rounded shadow hover:bg-[#3d5782] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
