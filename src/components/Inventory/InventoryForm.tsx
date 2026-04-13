import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, 
  Trash2, 
  Receipt,
  ChevronRight,
  Loader2,
  Box,
  MapPin,
  CheckCircle2,
  DollarSign,
  Info,
  Sparkles,
  AlertTriangle,
  Factory,
  Check,
  Building2,
  Layers,
  Clock
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── Types & Constants ──
interface Bill {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  amount_given: number;
  transaction_date: string;
}

interface MasterItem {
  name: string;
  category: string;
  unit: string;
}

interface LineItem {
  id: string;
  item_name: string;
  category: string;
  quantity: string;
  rate_per_unit: string;
  unit: string;
  item_ref_no: string;
  manufacturer: string;
  storage_location: string;
  custom_location: string;
}

const STORAGE_AREAS = [
  'Main Store',
  'Quarry Storage',
  'Crusher Site',
  'Tool Room',
  'Equipment Shed',
  'Explosives Magazine',
  'Workshop',
  'Other'
];

const CATEGORIES = [
  'General',
  'Fuel',
  'Explosives',
  'Tools',
  'Raw Material',
  'Machinery',
  'Safety Gear',
  'Office Supplies'
];

const UNITS = [
  'Nos',
  'Liters',
  'Kgs',
  'Tons',
  'Meters',
  'Feet',
  'Box',
  'Set'
];

// ── Utility: Reference Generator ──
const generateItemRefNo = (index: number) => {
  const year = new Date().getFullYear();
  const sequence = (index + 1).toString().padStart(3, '0');
  return `ITEM-${year}-${sequence}`;
};

// ── Skeletons ──
const FormSkeleton = () => (
  <div className="w-full space-y-12 animate-pulse">
    <div className="h-[300px] rounded-[64px] bg-slate-100/50" />
    <div className="overflow-hidden rounded-[64px] bg-white shadow-2xl border border-slate-100 p-8">
      <table className="w-full">
        <tbody>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </tbody>
      </table>
    </div>
  </div>
);

const RowSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="px-6 py-10">
        <div className="h-10 bg-slate-100 rounded-2xl" />
      </td>
    ))}
  </tr>
);

// ── Sub-component: Memoized Inventory Row ──
const InventoryRow = memo(({ 
  index, 
  line, 
  masterItems, 
  onUpdate, 
  onRemove 
}: { 
  index: number; 
  line: LineItem; 
  masterItems: MasterItem[];
  onUpdate: (updates: Partial<LineItem>) => void;
  onRemove: () => void;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MasterItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if item is already in master registry
  const isExistingItem = useMemo(() => {
    return masterItems.some(m => m.name.toLowerCase() === line.item_name.toLowerCase());
  }, [masterItems, line.item_name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (query: string) => {
    onUpdate({ item_name: query });
    
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    
    if (query.length > 0) {
      searchTimerRef.current = setTimeout(() => {
        const matches = masterItems.filter(item => 
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
        setSuggestions(matches);
        setShowSuggestions(true);
      }, 150); // 150ms debounce
    } else {
      setShowSuggestions(false);
    }
  };

  const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.rate_per_unit) || 0);

  return (
    <tr className="group hover:bg-slate-50/40 transition-all duration-300">
      <td className="px-6 py-8 align-middle">
        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg group-hover:scale-110 transition-transform">
          {index + 1}
        </div>
      </td>
      
      <td className="px-4 py-8 align-middle">
        <div className="relative" ref={containerRef}>
          <div className="relative">
            <input 
              type="text"
              required
              value={line.item_name}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => line.item_name && handleSearch(line.item_name)}
              placeholder="Search item..."
              className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold placeholder:text-slate-300 min-w-[240px]"
            />
            {!isExistingItem && line.item_name.length > 2 && (
              <div className="absolute -top-3 -right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-lg animate-bounce z-10">
                <Sparkles className="h-2 w-2" />
                NEW
              </div>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
               {suggestions.map((item) => (
                 <div 
                   key={item.name}
                   onClick={() => {
                     onUpdate({
                       item_name: item.name,
                       category: item.category,
                       unit: item.unit,
                       item_ref_no: generateItemRefNo(index)
                     });
                     setShowSuggestions(false);
                   }}
                   className="px-6 py-4 hover:bg-emerald-500 hover:text-white cursor-pointer transition-all flex items-center justify-between group"
                 >
                   <div className="flex flex-col">
                     <span className="font-black text-sm">{item.name}</span>
                     <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-emerald-100">{item.category}</span>
                   </div>
                   <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                 </div>
               ))}
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="relative min-w-[160px]">
          {!isExistingItem && line.item_name.length > 0 ? (
            <>
              <select 
                value={line.category}
                onChange={(e) => onUpdate({ category: e.target.value })}
                className="w-full text-[10px] font-black uppercase tracking-widest text-emerald-600 px-4 py-5 rounded-2xl bg-emerald-50 border-none focus:ring-4 focus:ring-emerald-500/10 appearance-none cursor-pointer pr-10"
              >
                <option value="">Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400 rotate-90 pointer-events-none" />
            </>
          ) : (
            <div className="px-4 py-5 rounded-2xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-100/50">
              {line.category || '---'}
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="relative min-w-[160px]">
          <Factory className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input 
            type="text"
            placeholder="Batch Code"
            value={line.item_ref_no}
            onChange={(e) => onUpdate({ item_ref_no: e.target.value })}
            className="w-full pl-10 pr-4 py-5 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-black text-xs placeholder:text-slate-300 uppercase tracking-tight"
          />
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="relative min-w-[160px]">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input 
            type="text"
            placeholder="Manufacturer"
            value={line.manufacturer}
            onChange={(e) => onUpdate({ manufacturer: e.target.value })}
            className="w-full pl-10 pr-4 py-5 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold text-xs placeholder:text-slate-300"
          />
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="min-w-[100px]">
          <input 
            type="number"
            required
            placeholder="0"
            value={line.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
            className="w-full px-4 py-5 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-black text-xl"
          />
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="relative min-w-[100px]">
          <select 
            value={line.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            className={`w-full px-4 py-5 rounded-2xl font-black text-xs uppercase tracking-widest appearance-none cursor-pointer border-none focus:ring-4 focus:ring-blue-500/10 pr-10 ${!isExistingItem ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}
          >
            <option value="">Unit</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronRight className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rotate-90 pointer-events-none ${!isExistingItem ? 'text-blue-300' : 'text-slate-300'}`} />
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="relative min-w-[140px]">
          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <input 
            type="number"
            required
            placeholder="0.00"
            value={line.rate_per_unit}
            onChange={(e) => onUpdate({ rate_per_unit: e.target.value })}
            className="w-full pl-12 pr-4 py-5 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-black text-lg"
          />
        </div>
      </td>

      <td className="px-4 py-6 align-top text-right">
        <div className="flex flex-col gap-1 items-end pr-4 min-w-[120px]">
          <p className="text-[11px] font-black uppercase tracking-tight text-slate-300">Total</p>
          <p className="text-lg font-black text-slate-900">₹{lineTotal.toLocaleString()}</p>
        </div>
      </td>

      <td className="px-4 py-8 align-middle">
        <div className="flex items-center gap-2 min-w-[180px]">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <select 
              value={line.storage_location}
              onChange={(e) => onUpdate({ storage_location: e.target.value })}
              className="w-full pl-10 pr-10 py-5 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold appearance-none cursor-pointer text-xs"
            >
              {STORAGE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 rotate-90 pointer-events-none" />
          </div>
          
          {line.storage_location === 'Other' && (
            <input 
              type="text"
              required
              placeholder="Custom..."
              value={line.custom_location}
              onChange={(e) => onUpdate({ custom_location: e.target.value })}
              className="w-24 px-3 py-4 rounded-2xl bg-amber-50 border border-amber-100 text-slate-900 font-bold text-[10px] animate-in slide-in-from-left-2 duration-300"
            />
          )}
        </div>
      </td>

      <td className="px-4 py-8 align-middle text-center">
        <button 
          type="button"
          onClick={onRemove}
          className="h-12 w-12 flex items-center justify-center rounded-[20px] bg-rose-50 text-rose-300 hover:bg-rose-500 hover:text-white transition-all shadow-sm hover:shadow-rose-500/20"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
});

InventoryRow.displayName = 'InventoryRow';

// ── Main Component ──
export function InventoryForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'registering' | 'committing' | 'verified'>('idle');
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const fetchMasterData = useCallback(async () => {
    try {
      setLoading(true);
      const [accRes, itemRes] = await Promise.all([
        supabase.from('accounts').select('*').in('transaction_type', ['expense', 'invoice']).order('transaction_date', { ascending: false }),
        supabase.from('master_items').select('*').order('name', { ascending: true })
      ]);
      if (accRes.error) throw accRes.error;
      if (itemRes.error) throw itemRes.error;

      setBills(accRes.data || []);
      setMasterItems(itemRes.data || []);
    } catch (err) {
      console.error('Fetch Error:', err);
      toast.error('Failed to load metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);

  const performBatchSave = async (itemsToSave: LineItem[]) => {
    if (!selectedBill) return;
    
    setSaving(true);
    setSyncStatus('registering');
    
    try {
      // 1. Handle New Item Registrations (Master Items)
      const newItemsToRegister = itemsToSave
        .filter(item => !masterItems.some(m => m.name.toLowerCase() === item.item_name.toLowerCase()))
        .map(item => ({
          name: item.item_name,
          category: item.category || 'General',
          unit: item.unit || 'Nos'
        }));

      if (newItemsToRegister.length > 0) {
        const { error: masterError } = await supabase
          .from('master_items')
          .upsert(newItemsToRegister, { onConflict: 'name' });
        if (masterError) throw masterError;
      }

      setSyncStatus('committing');
      // 2. Handle Inventory Records
      const dbEntries = itemsToSave.map(item => ({
        item_name: item.item_name,
        category: item.category || 'General',
        quantity: parseFloat(item.quantity) || 0,
        rate_per_unit: parseFloat(item.rate_per_unit) || 0,
        unit: item.unit || 'Nos',
        transaction_type: 'in',
        transaction_date: transactionDate,
        supplier: selectedBill.customer_name,
        reference_number: selectedBill.invoice_number,
        location: item.storage_location === 'Other' ? item.custom_location : item.storage_location,
        notes: `[ITEM_REF]: ${item.item_ref_no} | [MANUF]: ${item.manufacturer || 'N/A'} | [LINKED_BILL]: ${selectedBill.invoice_number}`,
        created_by: user?.id
      }));

      const { error } = await supabase.from('inventory_items').insert(dbEntries);
      if (error) throw error;

      setSyncStatus('verified');
      await fetchMasterData(); // Refresh catalog
      return true;
    } catch (err) {
      console.error('Batch Save Error:', err);
      toast.error('Failed to sync materials');
      return false;
    } finally {
      setTimeout(() => {
        setSyncStatus('idle');
        setSaving(false);
      }, 1000);
    }
  };

  const addNewRow = useCallback(async () => {
    // Audit current items: find ones that are ready to save
    const readyToSave = lineItems.filter(item => 
      item.item_name.length > 0 && 
      item.quantity.length > 0 && 
      parseFloat(item.quantity) > 0 &&
      item.rate_per_unit.length > 0
    );

    if (readyToSave.length > 0) {
      const success = await performBatchSave(readyToSave);
      if (success) {
        toast.success(`Automatically secured ${readyToSave.length} items`);
        // Remove saved items from local state
        setLineItems(prev => {
          const remaining = prev.filter(item => !readyToSave.find(s => s.id === item.id));
          return [
            ...remaining,
            {
              id: Math.random().toString(36).substr(2, 9),
              item_name: '',
              category: '',
              quantity: '',
              rate_per_unit: '',
              unit: '',
              item_ref_no: generateItemRefNo(remaining.length),
              manufacturer: '',
              storage_location: 'Main Store',
              custom_location: ''
            }
          ];
        });
        return;
      }
    }

    // Default behavior if nothing to save
    const newId = Math.random().toString(36).substr(2, 9);
    setLineItems(prev => [
      ...prev,
      {
        id: newId,
        item_name: '',
        category: '',
        quantity: '',
        rate_per_unit: '',
        unit: '',
        item_ref_no: generateItemRefNo(prev.length),
        manufacturer: '',
        storage_location: 'Main Store',
        custom_location: ''
      }
    ]);
  }, [lineItems, selectedBill, masterItems, performBatchSave]);

  const handleBillChange = useCallback((billId: string) => {
    const bill = bills.find(b => b.id === billId) || null;
    setSelectedBillId(billId);
    setSelectedBill(bill);
    if (bill && lineItems.length === 0) addNewRow();
  }, [bills, lineItems.length, addNewRow]);

  const removeRow = useCallback((id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateLineItem = useCallback((index: number, updates: Partial<LineItem>) => {
    setLineItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  }, []);

  const batchTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate_per_unit) || 0), 0);
  }, [lineItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return toast.warning('Select reference bill');
    if (lineItems.length === 0) return toast.warning('Add materials');

    if (selectedBill && batchTotal > selectedBill.amount) {
      toast.error(`Batch value (₹${batchTotal.toLocaleString()}) exceeds allowed Bill Value (₹${selectedBill.amount.toLocaleString()})`);
      return;
    }

    // Validation: New items MUST have category and unit
    const incompleteNewItems = lineItems.filter(item => {
      const exists = masterItems.some(m => m.name.toLowerCase() === item.item_name.toLowerCase());
      return !exists && (!item.category || !item.unit);
    });

    if (incompleteNewItems.length > 0) {
      toast.warning('Please set Category and Unit for new items');
      return;
    }

    const success = await performBatchSave(lineItems);
    if (success) {
      toast.success('Successfully committed full procurement batch');
      if (onSuccess) onSuccess();
      setLineItems([]);
      setSelectedBillId('');
      setSelectedBill(null);
    }
  };

  if (loading) return <FormSkeleton />;

  return (
    <div className="w-full mx-auto space-y-16 pb-20">
      
      {/* ── Bill Selection ── */}
      <div className="relative overflow-hidden rounded-[64px] bg-white p-20 shadow-2xl border border-slate-100 group transition-all hover:shadow-emerald-500/5">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity rotate-12">
          <Receipt className="h-40 w-40 text-emerald-500" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
              Procurement Batch
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            </h2>
            <p className="text-slate-500 font-medium text-lg">Convert financial bills to physical inventory arrivals</p>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-2 min-w-[320px]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Financial Link *</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300">
                  <Receipt className="h-5 w-5" />
                </div>
                <select 
                  value={selectedBillId}
                  onChange={(e) => handleBillChange(e.target.value)}
                  className="w-full pl-14 pr-12 py-5 rounded-3xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-black tracking-tight appearance-none cursor-pointer text-base"
                >
                  <option value="">Link Existing Bill</option>
                  {bills.map(bill => (
                    <option key={bill.id} value={bill.id}>{bill.invoice_number} • {bill.customer_name}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="h-5 w-5 text-slate-300 rotate-90" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Arrival Date</label>
              <input 
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="px-8 py-5 rounded-3xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold text-base"
              />
            </div>
          </div>
        </div>

        {selectedBill && (
          <div className="mt-10 pt-10 border-t border-slate-100/50 grid grid-cols-2 lg:grid-cols-4 gap-12 animate-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-6">
              <div className="h-16 w-16 rounded-[24px] bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Vendor Partner</p>
                <p className="text-xl font-black text-slate-900 truncate max-w-[200px] tracking-tight">{selectedBill.customer_name}</p>
              </div>
            </div>
            
            <div className="space-y-2 group/value">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                Total Bill Value
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-emerald-500 transition-colors">
                ₹{selectedBill.amount.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2 group/balance">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Layers className="h-3 w-3" />
                Outstanding
              </p>
              <p className="text-3xl font-black text-emerald-600 tracking-tighter group-hover:scale-105 transition-transform origin-left">
                ₹{(selectedBill.amount - (selectedBill.amount_given || 0)).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Ledger Date
              </p>
              <p className="text-xl font-bold text-slate-600 flex items-center gap-3 tracking-tight">
                {new Date(selectedBill.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Space ── */}
      {selectedBill && (
        <form onSubmit={handleSubmit} className="space-y-12 animate-in fade-in duration-700">
          <div className="overflow-x-auto rounded-[64px] bg-white shadow-2xl border border-slate-100 p-4">
            <table className="w-full border-separate border-spacing-y-3 min-w-[1800px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-12 text-center">#</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 min-w-[260px]">Material Info</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-44">Category</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-44">Batch Code</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-44">Manufacturer</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-32">Qty</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-32">Unit</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-40">Rate</th>
                  <th className="px-4 py-8 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-40">Total</th>
                  <th className="px-4 py-8 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-64">Location</th>
                  <th className="px-4 py-8 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lineItems.map((line, index) => (
                  <InventoryRow 
                    key={line.id}
                    index={index}
                    line={line}
                    masterItems={masterItems}
                    onUpdate={(updates) => updateLineItem(index, updates)}
                    onRemove={() => removeRow(line.id)}
                  />
                ))}
              </tbody>
            </table>

            <div className="p-12 flex flex-col items-center justify-center gap-6 bg-slate-50/30">
              <button 
                type="button"
                onClick={addNewRow}
                className="group flex items-center gap-4 px-12 py-6 bg-white text-slate-900 rounded-[32px] font-black text-sm tracking-tighter shadow-xl hover:shadow-2xl hover:bg-slate-900 hover:text-white transition-all duration-500 hover:-translate-y-1"
              >
                <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:rotate-90 transition-transform shadow-lg shadow-emerald-500/20">
                  <Plus className="h-6 w-6" />
                </div>
                ADD ANOTHER MATERIAL
              </button>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 tracking-wider">
                <Info className="h-4 w-4" />
                New materials will be automatically registered in Item Management
              </div>
            </div>
          </div>

          <div className={`flex flex-col lg:flex-row items-center justify-between rounded-[64px] p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-2xl relative overflow-hidden group transition-all duration-700 ${selectedBill && batchTotal > selectedBill.amount ? 'bg-rose-900/90 shadow-rose-500/20' : 'bg-slate-900/90'}`}>
            <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ${selectedBill && batchTotal > selectedBill.amount ? 'from-rose-500/30' : ''}`} />
            
            <div className="relative flex items-center gap-8">
              <div className={`h-20 w-20 rounded-[32px] flex items-center justify-center backdrop-blur-md transition-all ${selectedBill && batchTotal > selectedBill.amount ? 'bg-rose-500/20 rotate-12' : 'bg-white/10'}`}>
                {selectedBill && batchTotal > selectedBill.amount ? (
                  <AlertTriangle className="h-10 w-10 text-rose-400" />
                ) : (
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-white text-3xl font-black tracking-tight">
                  {selectedBill && batchTotal > selectedBill.amount ? 'Budget Exceeded' : `${lineItems.length} Materials in Transit`}
                </p>
                <p className={`${selectedBill && batchTotal > selectedBill.amount ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} text-base font-black tracking-[0.2em] uppercase`}>
                  BATCH VALUE • ₹{batchTotal.toLocaleString()}
                  {selectedBill && batchTotal > selectedBill.amount && ` (Limit: ₹${selectedBill.amount.toLocaleString()})`}
                </p>
              </div>
            </div>

            <button 
              type="submit"
              disabled={saving || (selectedBill && batchTotal > selectedBill.amount)}
              className={`relative px-20 py-8 text-white rounded-[32px] font-black text-xl transition-all overflow-hidden ${selectedBill && batchTotal > selectedBill.amount ? 'bg-slate-800 cursor-not-allowed opacity-50 shadow-none' : 'bg-emerald-500 shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95'}`}
            >
              <div className="flex items-center gap-4 relative z-10">
                {saving ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="tracking-widest capitalize">
                      {syncStatus === 'registering' ? 'REGISTERING MATERIALS...' : 'LINKING BATCH...'}
                    </span>
                  </>
                ) : syncStatus === 'verified' ? (
                  <>
                    <Check className="h-8 w-8 text-emerald-100 animate-bounce" />
                    <span className="tracking-tighter uppercase">VERIFIED</span>
                  </>
                ) : (
                  <>
                    <Box className="h-8 w-8" />
                    <span className="tracking-tighter uppercase">COMMIT TO REPOSITORY</span>
                  </>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/30 overflow-hidden">
                {saving && (
                  <div className={`h-full bg-white transition-all duration-1000 ${syncStatus === 'registering' ? 'w-1/2' : 'w-full'}`} />
                )}
              </div>
            </button>
          </div>
        </form>
      )}

      {!selectedBill && (
        <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-1000">
          <div className="h-40 w-40 rounded-[64px] bg-slate-50 flex items-center justify-center text-slate-100 shadow-inner group relative">
             <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Receipt className="h-20 w-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 relative z-10" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Audit Trail Required</h3>
            <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
              Please link this arrival to a financial record in the directory to continue with physical item entry.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
