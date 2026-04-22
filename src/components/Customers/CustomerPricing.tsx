import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Tag, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';

interface PricingRule {
  id: string;
  customer_id: string;
  product_name: string;
  price_per_unit: number;
  unit: string;
  notes?: string;
  created_at?: string;
}

interface CustomerPricingProps {
  customerId: string;
  customerName: string;
}

const COMMON_PRODUCTS = [
  'M-Sand', 'P-Sand', 'Crusher Dust', 'Blue Metal 6mm', 'Blue Metal 12mm',
  'Blue Metal 20mm', 'Blue Metal 40mm', 'WBM', 'GSB', 'Gravel', 'Aggregate'
];

export function CustomerPricing({ customerId, customerName }: CustomerPricingProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_name: '',
    price_per_unit: '',
    unit: 'Ton',
    notes: ''
  });

  const [editForm, setEditForm] = useState({
    product_name: '',
    price_per_unit: '',
    unit: '',
    notes: ''
  });

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_pricing')
        .select('*')
        .eq('customer_id', customerId)
        .order('product_name', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (err: any) {
      console.error('Error fetching pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, [customerId]);

  const handleAdd = async () => {
    if (!form.product_name || !form.price_per_unit) {
      toast.warning('Please fill Product Name and Price');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('customer_pricing').insert([{
        customer_id: customerId,
        product_name: form.product_name.trim(),
        price_per_unit: parseFloat(form.price_per_unit),
        unit: form.unit,
        notes: form.notes.trim() || null
      }]);
      if (error) throw error;
      toast.success(`Price set for ${form.product_name}`);
      setForm({ product_name: '', price_per_unit: '', unit: 'Ton', notes: '' });
      setShowAddForm(false);
      fetchPricing();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setEditForm({
      product_name: rule.product_name,
      price_per_unit: rule.price_per_unit.toString(),
      unit: rule.unit,
      notes: rule.notes || ''
    });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('customer_pricing')
        .update({
          product_name: editForm.product_name.trim(),
          price_per_unit: parseFloat(editForm.price_per_unit),
          unit: editForm.unit,
          notes: editForm.notes.trim() || null
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Price updated');
      setEditingId(null);
      fetchPricing();
    } catch (err: any) {
      toast.error('Update failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove custom price for "${name}"?`)) return;
    try {
      const { error } = await supabase.from('customer_pricing').delete().eq('id', id);
      if (error) throw error;
      toast.info(`Removed custom price for ${name}`);
      fetchPricing();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-cyan-600" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Custom Pricing for {customerName}
          </span>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-cyan-700 transition-all shadow-md shadow-cyan-200"
        >
          <Plus className="w-3.5 h-3.5" /> Add Price
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <p className="text-xs font-black text-cyan-700 uppercase tracking-widest">New Custom Price</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Name *</label>
              <input
                list="product-suggestions"
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder="e.g. M-Sand"
                className="w-full px-3 py-2.5 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-bold text-sm outline-none transition-all"
              />
              <datalist id="product-suggestions">
                {COMMON_PRODUCTS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price_per_unit}
                onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
                placeholder="e.g. 720"
                className="w-full px-3 py-2.5 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 font-black text-lg outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Per Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 font-bold text-sm outline-none appearance-none"
              >
                {['Ton', 'MT', 'CFT', 'Nos', 'Load', 'KG', 'Ltr'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes (Optional)</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Rate valid until June 2026"
                className="w-full px-3 py-2.5 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 font-medium text-sm outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-cyan-700 transition-all disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Price'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setForm({ product_name: '', price_per_unit: '', unit: 'Ton', notes: '' }); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pricing List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No custom prices set</p>
          <p className="text-[11px] text-slate-400 mt-1">Click "Add Price" to set a special rate for this customer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 hover:border-cyan-300 transition-all group"
            >
              {editingId === rule.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        list="product-suggestions-edit"
                        value={editForm.product_name}
                        onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none"
                      />
                      <datalist id="product-suggestions-edit">
                        {COMMON_PRODUCTS.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div>
                      <input
                        type="number"
                        value={editForm.price_per_unit}
                        onChange={(e) => setEditForm({ ...editForm, price_per_unit: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-lg outline-none"
                      />
                    </div>
                    <div>
                      <select
                        value={editForm.unit}
                        onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none appearance-none"
                      >
                        {['Ton', 'MT', 'CFT', 'Nos', 'Load', 'KG', 'Ltr'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Notes..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(rule.id)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-black uppercase hover:bg-cyan-700 transition-all disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-200 transition-all"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                      <Tag className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate">{rule.product_name}</p>
                      {rule.notes && (
                        <p className="text-[10px] font-medium text-slate-400 truncate">{rule.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-cyan-700">₹{rule.price_per_unit.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">per {rule.unit}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(rule)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-cyan-100 hover:text-cyan-700 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id, rule.product_name)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
