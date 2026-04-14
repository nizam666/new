import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Truck, Package, User, RotateCcw, AlertTriangle,
  CheckCircle, Loader2, Search, Calendar,
  ArrowLeftRight, XCircle, Plus, X
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

  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

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
  const [outstandingQty, setOutstandingQty] = useState(0);

  // Fetch outstanding returnable quantity for department
  useEffect(() => {
    const fetchOutstandingDeptQty = async () => {
      if (!selectedItem || !formData.department) {
        setOutstandingQty(0);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('inventory_dispatch')
          .select('quantity_dispatched')
          .eq('item_id', selectedItem.id)
          .eq('department', formData.department)
          .eq('returnable', true)
          .eq('returned', false);
        
        if (error) throw error;
        
        const total = (data || []).reduce((sum, d) => sum + (d.quantity_dispatched || 0), 0);
        setOutstandingQty(total);
      } catch (err) {
        console.error('Error fetching outstanding qty:', err);
      }
    };

    fetchOutstandingDeptQty();
  }, [selectedItem, formData.department]);

  // Fetch inventory items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .order('item_name', { ascending: true });
        
        if (error) throw error;
        setInventoryItems(data || []);
      } catch (err) {
        toast.error('Failed to load storage items: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setFetchingItems(false);
      }
    };
    fetchItems();
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
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Item from Storage</h3>
            {!selectedItem && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Stock Available
              </div>
            )}
          </div>

          {!selectedItem ? (
            <div className="space-y-6 animate-in fade-in duration-500">
               {/* Search Bar */}
               <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder={fetchingItems ? 'Loading stock...' : 'Filter available stock…'}
                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10 placeholder:text-slate-300 shadow-inner group transition-all"
                  />
               </div>

               {/* Automatic Item Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar p-1">
                  {fetchingItems ? (
                    [1,2,3].map(i => (
                      <div key={i} className="h-32 rounded-3xl bg-slate-50 animate-pulse border border-slate-100" />
                    ))
                  ) : filteredItems.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                       <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                       <p className="text-slate-400 font-bold">No matching stock found</p>
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const outOfStock = (item.quantity || 0) <= 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (outOfStock) {
                               toast.info(`${item.item_name} is currently out of stock. Please restock first.`);
                               return;
                            }
                            setSelectedItem(item);
                            setItemSearch('');
                            update('item_name', item.item_name);
                          }}
                          className={`group p-5 rounded-[32px] bg-white border transition-all relative overflow-hidden ${
                            outOfStock 
                              ? 'opacity-60 grayscale cursor-not-allowed border-slate-100' 
                              : 'shadow-sm border-slate-100 hover:shadow-xl hover:border-emerald-500/30 hover:-translate-y-1 cursor-pointer'
                          }`}
                        >
                           <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!outOfStock && (
                                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                                   <Plus className="w-4 h-4" />
                                </div>
                              )}
                           </div>
                           <div className="flex items-center gap-4 mb-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                outOfStock ? 'bg-slate-100' : 'bg-slate-900/5 group-hover:bg-emerald-500'
                              }`}>
                                 <Package className={`w-6 h-6 ${outOfStock ? 'text-slate-300' : 'text-slate-400 group-hover:text-white'}`} />
                              </div>
                              <div className="min-w-0">
                                 <h4 className={`font-black text-sm truncate ${outOfStock ? 'text-slate-400' : 'text-slate-900'}`}>{item.item_name}</h4>
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p>
                              </div>
                           </div>
                           <div className="flex items-end justify-between pt-2 border-t border-slate-50">
                              <div>
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">
                                   {outOfStock ? 'Status' : 'Quantity'}
                                 </p>
                                 <div className="flex items-baseline gap-1">
                                    {outOfStock ? (
                                      <span className="text-xs font-black text-rose-500 uppercase tracking-tighter">Out of Stock</span>
                                    ) : (
                                      <>
                                        <span className="text-xl font-black text-slate-900">{item.quantity}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span>
                                      </>
                                    )}
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-tighter">
                                    {item.location}
                                 </span>
                              </div>
                           </div>
                        </div>
                      );
                    })
                  )}
               </div>
            </div>
          ) : (
            /* Selected item pill */
            <div className="flex flex-col sm:flex-row gap-6 p-1 bg-slate-50 rounded-[32px] border border-slate-100 items-stretch animate-in zoom-in-95 duration-500 relative">
              <div className="flex-1 p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-emerald-400 flex items-center justify-center shadow-2xl">
                  <Package className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">Stock Item Selected</p>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedItem.item_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedItem.item_code}</span>
                     <div className="w-1 h-1 rounded-full bg-slate-300" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedItem.category}</span>
                  </div>
                </div>
              </div>

              <div className="sm:w-1/3 bg-white rounded-[28px] p-6 shadow-sm border border-slate-200/50 flex flex-col justify-center">
                 <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                 </div>
                 <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1">
                       <span className="text-3xl font-black text-slate-900 tracking-tighter">{selectedItem.quantity}</span>
                       <span className="text-xs font-bold text-slate-400 uppercase">{selectedItem.unit}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600 uppercase tracking-tighter">{selectedItem.location || 'N/A'}</span>
                 </div>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute -top-3 -right-3 w-10 h-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 hover:shadow-xl hover:scale-110 transition-all shadow-lg active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
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
                max={new Date().toISOString().split('T')[0]}
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
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Debt Dashboard */}
              {formData.department && (
                <div className="p-6 bg-slate-900 rounded-[32px] text-white overflow-hidden relative group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <RotateCcw className="h-20 w-20" />
                   </div>
                   <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4">Department Inventory Debt</p>
                      <div className="grid grid-cols-2 gap-8">
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Previous Unreturned</p>
                            <div className="flex items-baseline gap-1">
                               <span className="text-3xl font-black">{outstandingQty}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedItem?.unit}</span>
                            </div>
                         </div>
                         <div className="border-l border-white/10 pl-8">
                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 font-black">Total After Dispatch</p>
                            <div className="flex items-baseline gap-1">
                               <span className="text-3xl font-black text-emerald-400">
                                  {outstandingQty + (parseFloat(formData.quantity_dispatched) || 0)}
                               </span>
                               <span className="text-[10px] font-bold text-emerald-400 uppercase">{selectedItem?.unit}</span>
                            </div>
                         </div>
                      </div>
                      <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl w-fit">
                         <AlertTriangle className="h-3 w-3 text-amber-400" />
                         <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Responsibility limits may apply to {formData.department}</p>
                      </div>
                   </div>
                </div>
              )}

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
                      max={new Date().toISOString().split('T')[0]}
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
            disabled={loading}
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
