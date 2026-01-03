import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bomb, Save } from 'lucide-react';

export function BlastingForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ed_nos: '',
    edet_nos: '',
    nonel_3m_nos: '',
    nonel_4m_nos: '',
    pg_nos: '',
    pg_unit: 'boxes',
    material_type: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blasting_records')
        .insert([
          {
            contractor_id: user.id,
            date: formData.date,
            ed_nos: parseFloat(formData.ed_nos) || 0,
            edet_nos: parseFloat(formData.edet_nos) || 0,
            nonel_3m_nos: parseFloat(formData.nonel_3m_nos) || 0,
            nonel_4m_nos: parseFloat(formData.nonel_4m_nos) || 0,
            pg_nos: parseFloat(formData.pg_nos) || 0,
            pg_unit: formData.pg_unit,
            material_type: formData.material_type,
            notes: formData.notes,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        ed_nos: '',
        edet_nos: '',
        nonel_3m_nos: '',
        nonel_4m_nos: '',
        pg_nos: '',
        pg_unit: 'boxes',
        material_type: '',
        notes: ''
      });

      alert('Blasting record submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error submitting blasting record: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
          <Bomb className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Blasting Record</h3>
          <p className="text-sm text-slate-600">Record blasting operations</p>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Select material type</option>
            <option value="Good Boulders">Good Boulders</option>
            <option value="Weathered Rocks">Weathered Rocks</option>
            <option value="Soil">Soil</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            ED in nos
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.ed_nos}
            onChange={(e) => setFormData({ ...formData, ed_nos: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            EDET in nos
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.edet_nos}
            onChange={(e) => setFormData({ ...formData, edet_nos: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            NONEL 3m in nos
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.nonel_3m_nos}
            onChange={(e) => setFormData({ ...formData, nonel_3m_nos: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            NONEL 4m in nos
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.nonel_4m_nos}
            onChange={(e) => setFormData({ ...formData, nonel_4m_nos: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            PG Quantity
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.pg_nos}
            onChange={(e) => setFormData({ ...formData, pg_nos: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            PG Unit
          </label>
          <select
            value={formData.pg_unit}
            onChange={(e) => setFormData({ ...formData, pg_unit: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="boxes">Boxes</option>
            <option value="nos">In Nos</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Safety protocols followed, weather conditions, etc..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
