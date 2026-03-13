import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart } from 'lucide-react';

interface PurchaseRequestFormProps {
  onSuccess: () => void;
}

export function PurchaseRequestForm({ onSuccess }: PurchaseRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    request_number: '',
    material_name: '',
    quantity: '',
    unit: 'units',
    purpose: '',
    priority: 'medium',
    required_by: '',
    estimated_cost: '',
    supplier_suggestion: '',
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
        .from('purchase_requests')
        .insert([{
          request_number: formData.request_number,
          material_name: formData.material_name,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          purpose: formData.purpose,
          priority: formData.priority,
          required_by: formData.required_by || null,
          estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
          supplier_suggestion: formData.supplier_suggestion || null,
          status: 'pending',
          notes: formData.notes || null,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Purchase request submitted successfully!');
      setFormData({
        request_number: '',
        material_name: '',
        quantity: '',
        unit: 'units',
        purpose: '',
        priority: 'medium',
        required_by: '',
        estimated_cost: '',
        supplier_suggestion: '',
        notes: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">New Purchase Request</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Request Number *
          </label>
          <input
            type="text"
            required
            value={formData.request_number}
            onChange={(e) => setFormData({ ...formData, request_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="e.g., PR-2024-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Priority *
          </label>
          <select
            required
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Name *
          </label>
          <input
            type="text"
            required
            value={formData.material_name}
            onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="e.g., Drill Bits, Explosives, Spare Parts, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              required
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0.00"
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="units">Units</option>
              <option value="pieces">Pieces</option>
              <option value="boxes">Boxes</option>
              <option value="kg">Kg</option>
              <option value="liters">Liters</option>
              <option value="tons">Tons</option>
              <option value="meters">Meters</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Estimated Cost
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimated_cost}
            onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Required By
          </label>
          <input
            type="date"
            value={formData.required_by}
            onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Suggested Supplier
          </label>
          <input
            type="text"
            value={formData.supplier_suggestion}
            onChange={(e) => setFormData({ ...formData, supplier_suggestion: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Supplier name or company"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Purpose/Reason *
          </label>
          <input
            type="text"
            required
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Explain why this material is needed..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Any additional details or specifications..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}
