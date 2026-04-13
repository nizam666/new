import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Package, 
  Plus, 
  Search, 
  MoreVertical, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  Info,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  LayoutDashboard,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'react-toastify';

interface MasterItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_stock_level: number;
  description: string;
  created_at: string;
  // Computed field
  current_quantity?: number;
}

interface ItemStats {
  totalItems: number;
  lowStockCount: number;
  totalCategories: number;
  addedToday: number;
}

const categories = [
  'Explosives',
  'Fuel',
  'Equipment',
  'Tools',
  'Spare Parts',
  'Safety Gear',
  'Consumables',
  'Other'
];

const units = [
  'liters',
  'boxes',
  'nos',
  'pieces',
  'kg',
  'meters',
  'sets',
  'units'
];

export function ItemManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [stats, setStats] = useState<ItemStats>({
    totalItems: 0,
    lowStockCount: 0,
    totalCategories: 0,
    addedToday: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    min_stock_level: '',
    description: ''
  });

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch definitions from master_items
      const { data: masterData, error: masterError } = await supabase
        .from('master_items')
        .select('*')
        .order('name', { ascending: true });

      if (masterError) throw masterError;

      // 2. Fetch current stock levels from inventory_items
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_items')
        .select('item_name, quantity');

      if (stockError) throw stockError;

      // 3. Aggregate stock by item name
      const stockMap = (stockData || []).reduce((acc: Record<string, number>, curr) => {
        if (!curr.item_name) return acc;
        acc[curr.item_name] = (acc[curr.item_name] || 0) + (curr.quantity || 0);
        return acc;
      }, {});

      // 4. Merge data
      const enrichedItems = (masterData || []).map(item => ({
        ...item,
        current_quantity: stockMap[item.name] || 0
      }));

      setItems(enrichedItems);

      // Stats calculation
      const lowStock = enrichedItems.filter(i => (i.current_quantity || 0) <= (i.min_stock_level || 0)).length;
      const cats = new Set(enrichedItems.map(i => i.category).filter(Boolean));
      const today = new Date().toISOString().split('T')[0];
      const addedToday = (masterData || []).filter(i => i.created_at.startsWith(today)).length;

      setStats({
        totalItems: enrichedItems.length,
        lowStockCount: lowStock,
        totalCategories: cats.size,
        addedToday
      });

    } catch (err) {
      console.error('Error fetching registry:', err);
      toast.error('Failed to load master item local registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: '',
      min_stock_level: '',
      description: ''
    });
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('Item Registration: Entry');
    toast.info('Starting registration process...');
    setSaving(true);
    
    if (!user) {
      console.warn('Item Registration: User is null, proceeding anyway (check RLS)');
    }

    try {
      const { error } = await supabase
        .from('master_items')
        .insert([{
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          min_stock_level: parseFloat(formData.min_stock_level) || 0,
          description: formData.description
        }]);

      if (error) throw error;
      toast.success('Item registered in master catalog!');
      resetForm();
      fetchItems();
    } catch (err) {
      toast.error('Failed to register item: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 text-cyan-500 animate-spin" />
        <p className="text-slate-400 font-black tracking-widest text-xs uppercase">Initializing Registry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 pb-20 animate-in fade-in duration-700">
      {/* ── Header & Premium Stats ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Item Management
            <div className="flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700">
              <CheckCircle2 className="h-3 w-3" /> Master Registry
            </div>
          </h2>
          <p className="text-slate-500 font-medium mt-1">Configure and monitor your operational item catalog</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="group relative overflow-hidden px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-2xl transition-all hover:scale-105 active:scale-95"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> REGISTER NEW ITEM
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Package className="h-24 w-24 text-slate-900" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Registry</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.totalItems}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3" /> Healthy Catalog
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <AlertTriangle className="h-24 w-24 text-red-600" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Low Stock Alerts</p>
          <h3 className="text-4xl font-black text-red-600">{stats.lowStockCount}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-red-500 bg-red-50 w-fit px-2 py-1 rounded-lg">
            <AlertTriangle className="h-3 w-3" /> Immediate Action
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Layers className="h-24 w-24 text-cyan-600" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Categories</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.totalCategories}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-cyan-500 bg-cyan-50 w-fit px-2 py-1 rounded-lg">
            <LayoutDashboard className="h-3 w-3" /> Sorted Hub
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Plus className="h-24 w-24 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Added Today</p>
          <h3 className="text-4xl font-black text-white">{stats.addedToday}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-cyan-400 bg-white/10 w-fit px-2 py-1 rounded-lg">
            <Info className="h-3 w-3" /> Review Necessary
          </div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search items by name or category..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-100 focus:border-transparent focus:ring-4 focus:ring-cyan-500/10 shadow-sm transition-all text-slate-900 font-semibold"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scroll-hide">
          <button 
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === 'all' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Registry Table ── */}
      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden relative">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h4 className="text-xl font-black text-slate-900 tracking-tight">Inventory Items Registry</h4>
          <Settings className="h-5 w-5 text-slate-300 transition-transform hover:rotate-90 cursor-pointer" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Item Description</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Level</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => {
                const isLow = (item.current_quantity || 0) <= (item.min_stock_level || 0);
                const progress = Math.min(((item.current_quantity || 0) / ((item.min_stock_level || 0) * 3 || 100)) * 100, 100);
                
                return (
                  <tr key={item.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${isLow ? 'bg-red-50 text-red-500 shadow-inner' : 'bg-cyan-50 text-cyan-500 shadow-inner'}`}>
                          <Package className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 tracking-tight">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            Registry Definition Verified
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-8 py-6 min-w-[200px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-900">{item.current_quantity || 0} <span className="text-slate-400 font-bold">{item.unit}</span></span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Min Level: {item.min_stock_level}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isLow ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {isLow ? (
                        <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest animate-pulse">
                          <AlertTriangle className="h-4 w-4" /> LOW STOCK
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                          <CheckCircle2 className="h-4 w-4" /> HEALTHY
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                        <button className="p-2 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors"><MoreHorizontal className="h-4 w-4" /></button>
                      </div>
                      <div className="group-hover:hidden">
                        <MoreVertical className="h-5 w-5 text-slate-200 ml-auto" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="p-20 text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-200 mb-4 animate-bounce">
                <Package className="h-10 w-10" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching items found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay Modal / Side Panel for Adding Item ── */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowAddForm(false)} />
          <div 
            className="relative z-10 w-full max-w-2xl bg-white rounded-[40px] shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Register Master Item</h3>
                <p className="text-sm font-medium text-slate-500">Define a new item in your operational catalog</p>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Item Name *</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Explosive PG, Drilling Rod..." 
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-cyan-500/10 text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category *</label>
                  <select 
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-cyan-500/10 text-slate-900 font-semibold appearance-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Unit *</label>
                  <select 
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-cyan-500/10 text-slate-900 font-semibold appearance-none"
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Min Stock Alert Level</label>
                  <input 
                    type="number" 
                    name="min_stock_level"
                    value={formData.min_stock_level}
                    onChange={handleInputChange}
                    placeholder="Alert when stock hits..." 
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-cyan-500/10 text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description / Master Notes</label>
                <textarea 
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-cyan-500/10 text-slate-900 font-medium resize-none" 
                  placeholder="Technical specs, brand preferences, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-8 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? 'REGISTERING...' : 'CONFIRM REGISTRATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
