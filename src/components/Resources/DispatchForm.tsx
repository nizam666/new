import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Truck, Package, User, RotateCcw, AlertTriangle,
  CheckCircle, Loader2, Search, Calendar,
  ArrowLeftRight, XCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

interface DispatchFormProps {
  onSuccess?: () => void;
}

interface InventoryItem {
  id: string;
  item_name: string;
  item_code: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  average_price?: number;
}

const DEPARTMENTS = [
  'Quarry Operations', 'Crusher Plant', 'Maintenance', 'Safety',
  'Administration', 'Transport', 'Workshop', 'General'
];

const RETURN_CONDITIONS = [
  { value: 'good', label: 'Good', color: 'bg-emerald-500', icon: CheckCircle, desc: 'Like new, fully functional' },
  { value: 'ok', label: 'OK', color: 'bg-amber-400', icon: ArrowLeftRight, desc: 'Minor wear, still functional' },
  { value: 'bad', label: 'Bad', color: 'bg-orange-500', icon: AlertTriangle, desc: 'Heavy wear, needs repair' },
  { value: 'damaged', label: 'Damaged', color: 'bg-rose-500', icon: XCircle, desc: 'Broken / unusable' },
];

function generateDispatchRef() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DSP-${year}-${rand}`;
}

export function DispatchForm({ onSuccess }: DispatchFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [fetchingItems, setFetchingItems] = useState(true);

  // Item search state
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    dispatch_ref: generateDispatchRef(),
    item_name: '',
    quantity_dispatched: '',
    dispatched_to: '',
    department: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    expected_return_date: '',
    returnable: false,
    returned: false,
    return_date: '',
    return_condition: '',
    notes: '',
  });

  // Fetch inventory items on mount
  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, item_name, item_code, category, quantity, unit, location, average_price')
        .gt('quantity', 0)
        .order('item_name', { ascending: true });
      if (!error) setInventoryItems(data || []);
      setFetchingItems(false);
    };
    fetchItems();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemRef.current && !itemRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredItems = inventoryItems.filter(item =>
    item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const update = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return toast.warning('Please select an item to dispatch');
    if (!formData.dispatched_to.trim()) return toast.warning('Please specify who this is dispatched to');

    const qty = parseFloat(formData.quantity_dispatched);
    if (!qty || qty <= 0) return toast.warning('Please enter a valid quantity');
    if (qty > selectedItem.quantity) return toast.error(`Only ${selectedItem.quantity} ${selectedItem.unit} available in stock`);

    setLoading(true);
    try {
      // 1. Create dispatch record
      const { error: dError } = await supabase.from('inventory_dispatch').insert([{
        dispatch_ref: formData.dispatch_ref,
        item_id: selectedItem?.id || null,
        item_name: formData.item_name || selectedItem?.item_name || '',
        quantity_dispatched: qty,
        unit: selectedItem?.unit || '',
        dispatched_to: formData.dispatched_to,
        department: formData.department || null,
        dispatch_date: formData.dispatch_date,
        expected_return_date: formData.returnable && formData.expected_return_date ? formData.expected_return_date : null,
        returnable: formData.returnable,
        returned: formData.returned,
        return_date: formData.returned && formData.return_date ? formData.return_date : null,
        return_condition: formData.returned && formData.return_condition ? formData.return_condition : null,
        notes: formData.notes || null,
        created_by: user?.id,
      }]);
      if (dError) throw dError;

      // 2. Deduct from inventory (only if non-returnable or dispatched out)
      const newQty = selectedItem.quantity - qty;
      const { error: iError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', selectedItem.id);
      if (iError) throw iError;

      // 3. Log transaction
      await supabase.from('inventory_transactions').insert([{
        item_id: selectedItem.id,
        user_id: user?.id,
        transaction_type: 'out',
        quantity: qty,
        date: formData.dispatch_date,
        purpose: `Dispatch to: ${formData.dispatched_to}`,
        notes: `Ref: ${formData.dispatch_ref} | ${formData.returnable ? 'Returnable' : 'Non-Returnable'}`
      }]);

      toast.success(`Dispatched ${qty} ${selectedItem.unit} of ${selectedItem.item_name} successfully!`);
      
      // Reset
      setSelectedItem(null);
      setItemSearch('');
      setFormData({
        dispatch_ref: generateDispatchRef(),
        item_name: '',
        quantity_dispatched: '',
        dispatched_to: '',
        department: '',
        dispatch_date: new Date().toISOString().split('T')[0],
        expected_return_date: '',
        returnable: false,
        returned: false,
        return_date: '',
        return_condition: '',
        notes: '',
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Dispatch failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl md:rounded-[40px] p-8 md:p-12 text-white shadow-2xl">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">Inventory</p>
            <h2 className="text-2xl font-black tracking-tight">Issue Items from Stock</h2>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Dispatch Ref</span>
          <span className="px-4 py-2 rounded-xl bg-white/10 font-black text-sm tracking-widest">{formData.dispatch_ref}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Item Selection ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Item from Storage</h3>

          <div className="relative" ref={itemRef}>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true); if (selectedItem) setSelectedItem(null); }}
                onFocus={() => setShowItemDropdown(true)}
                placeholder={fetchingItems ? 'Loading stock...' : 'Search by item name, code or category…'}
                className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10 placeholder:text-slate-300"
              />
            </div>

            {showItemDropdown && filteredItems.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedItem(item);
                      setItemSearch(item.item_name);
                      update('item_name', item.item_name);
                      setShowItemDropdown(false);
                    }}
                    className="px-6 py-4 hover:bg-slate-900 hover:text-white cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-sm">{item.item_name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-slate-300">{item.category} · {item.location}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-base">{item.quantity} <span className="text-xs font-bold">{item.unit}</span></p>
                      <p className="text-[10px] text-slate-400 group-hover:text-slate-300">In stock</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected item pill */}
          {selectedItem && (
            <div className="flex flex-wrap gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 animate-in fade-in duration-300">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Item</p>
                <p className="text-xl font-black text-slate-900 truncate">{selectedItem.item_name}</p>
                <p className="text-xs font-bold text-slate-400">{selectedItem.item_code} · {selectedItem.category}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available Stock</p>
                <p className="text-2xl font-black text-emerald-600">{selectedItem.quantity}</p>
                <p className="text-xs font-bold text-slate-400">{selectedItem.unit}</p>
              </div>
            </div>
          )}

          {/* Manual Item Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Package className="h-3 w-3" /> Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="Enter or confirm item name"
              value={formData.item_name}
              onChange={(e) => update('item_name', e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10 placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* ── Dispatch Details ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dispatch Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Dispatched To */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><User className="h-3 w-3" /> Issued To *</label>
              <input
                type="text"
                required
                placeholder="Person's name or ID"
                value={formData.dispatched_to}
                onChange={(e) => update('dispatched_to', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department</label>
              <select value={formData.department} onChange={(e) => update('department', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-sm appearance-none focus:ring-4 focus:ring-slate-500/10">
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Package className="h-3 w-3" /> Quantity to Issue *
                {selectedItem && <span className="text-emerald-500 normal-case font-bold">max: {selectedItem.quantity} {selectedItem.unit}</span>}
              </label>
              <input
                type="number"
                required
                placeholder="0"
                min="0.01"
                step="0.01"
                max={selectedItem?.quantity}
                value={formData.quantity_dispatched}
                onChange={(e) => update('quantity_dispatched', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-black text-2xl focus:ring-4 focus:ring-slate-500/10"
              />
            </div>

            {/* Dispatch Date */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Calendar className="h-3 w-3" /> Dispatch Date *</label>
              <input
                type="date"
                required
                value={formData.dispatch_date}
                onChange={(e) => update('dispatch_date', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10"
              />
            </div>
          </div>
        </div>

        {/* ── Returnable Toggle ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item Return Policy</h3>
                <p className="text-base font-black text-slate-900 mt-0.5">
                  {formData.returnable ? 'Returnable Item' : 'Non-Returnable Item'}
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              onClick={() => update('returnable', !formData.returnable)}
              className={`relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none ${formData.returnable ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${formData.returnable ? 'left-9' : 'left-1'}`} />
            </button>
          </div>

          {formData.returnable && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Expected Return Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expected Return Date</label>
                <input
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) => update('expected_return_date', e.target.value)}
                  min={formData.dispatch_date}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              {/* Already Returned? */}
              <div className="flex items-center justify-between p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div>
                  <p className="font-black text-slate-900 text-sm">Already Returned?</p>
                  <p className="text-xs text-slate-500 font-medium">Mark if item has come back</p>
                </div>
                <button
                  type="button"
                  onClick={() => update('returned', !formData.returned)}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${formData.returned ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${formData.returned ? 'left-7' : 'left-0.5'}`} />
                </button>
              </div>

              {formData.returned && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Return Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Return Date</label>
                    <input
                      type="date"
                      value={formData.return_date}
                      onChange={(e) => update('return_date', e.target.value)}
                      min={formData.dispatch_date}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  {/* Return Condition */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condition on Return *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {RETURN_CONDITIONS.map(cond => {
                        const Icon = cond.icon;
                        const selected = formData.return_condition === cond.value;
                        return (
                          <button
                            key={cond.value}
                            type="button"
                            onClick={() => update('return_condition', cond.value)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                              selected
                                ? `border-transparent ${cond.color} text-white shadow-lg scale-[1.02]`
                                : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                            }`}
                          >
                            <Icon className={`h-5 w-5 mb-2 ${selected ? 'text-white' : 'text-slate-400'}`} />
                            <p className={`font-black text-sm ${selected ? 'text-white' : 'text-slate-900'}`}>{cond.label}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${selected ? 'text-white/80' : 'text-slate-400'}`}>{cond.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes (Optional)</label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any additional information about this dispatch…"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-slate-500/10 resize-none"
          />
        </div>

        {/* ── Submit ── */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white rounded-3xl md:rounded-[40px] p-5 md:p-8 shadow-xl border border-slate-100">
          {selectedItem && formData.quantity_dispatched && (
            <div className="text-center sm:text-left">
              <p className="text-[10px] font-black uppercase text-slate-400">Issuing</p>
              <p className="text-2xl font-black text-slate-900">
                {formData.quantity_dispatched} <span className="text-slate-400 text-base">{selectedItem.unit}</span>
              </p>
              <p className="text-xs text-slate-400 font-bold truncate max-w-[200px]">{selectedItem.item_name}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !selectedItem}
            className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-2xl md:rounded-3xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
          >
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
              : <><Truck className="h-5 w-5" /> ISSUE FROM STOCK</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
