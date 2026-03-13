import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package } from 'lucide-react';

interface ProductionStockFormProps {
  onSuccess: () => void;
}

export function ProductionStockForm({ onSuccess }: ProductionStockFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    material_type: '',
    quantity: '',
    unit: 'tons',
    stock_date: new Date().toISOString().split('T')[0],
    location: '',
    quality_grade: '',
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
        .from('production_stock')
        .insert([{
          material_type: formData.material_type,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          stock_date: formData.stock_date,
          location: formData.location || null,
          quality_grade: formData.quality_grade || null,
          notes: formData.notes || null,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Production stock added successfully!');
      setFormData({
        material_type: '',
        quantity: '',
        unit: 'tons',
        stock_date: new Date().toISOString().split('T')[0],
        location: '',
        quality_grade: '',
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
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Add Production Stock</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Type *
          </label>
          <select
            required
            value={formData.material_type}
            onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Material</option>
            <option value="aggregate">Aggregate</option>
            <option value="crushed_stone">Crushed Stone</option>
            <option value="sand">Sand</option>
            <option value="gravel">Gravel</option>
            <option value="boulders">Boulders</option>
            <option value="limestone">Limestone</option>
            <option value="granite">Granite</option>
            <option value="20mm">20mm</option>
            <option value="40mm">40mm</option>
            <option value="dust">Dust</option>
            <option value="other">Other</option>
          </select>
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
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            Stock Date *
          </label>
          <input
            type="date"
            required
            value={formData.stock_date}
            onChange={(e) => setFormData({ ...formData, stock_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Storage Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Yard A, Section 2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quality Grade
          </label>
          <select
            value={formData.quality_grade}
            onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Grade</option>
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
            <option value="economy">Economy</option>
            <option value="grade_a">Grade A</option>
            <option value="grade_b">Grade B</option>
            <option value="grade_c">Grade C</option>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Any additional information about this stock..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Adding...' : 'Add Stock'}
        </button>
      </div>
    </form>
  );
}
