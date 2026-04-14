import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, 
  Trash2, 
  ChevronRight,
  Loader2,
  MapPin,
  DollarSign,
  Sparkles,
  Factory
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── Types ──
interface PurchaseBill {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  amount_given: number;
  transaction_date: string;
  reason: string;
  status: string;
}

interface MasterItem {
  id: string;
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

interface InventoryFormProps {
  onSuccess?: () => void;
}

const STORAGE_AREAS = [
  'Main Store', 'Quarry Storage', 'Crusher Site', 'Tool Room',
  'Equipment Shed', 'Explosives Magazine', 'Workshop', 'Other'
];

const CATEGORIES = [
  'General', 'Fuel', 'Explosives', 'Tools',
  'Raw Material', 'Machinery', 'Safety Gear', 'Office Supplies'
];

const UNITS = ['Nos', 'Liters', 'Kgs', 'Tons', 'Meters', 'Feet', 'Box', 'Set'];

// ── Utility: Reference Generator ──
const generateItemRefNo = (baseCount: number, index: number) => {
  const year = new Date().getFullYear();
  const sequence = (baseCount + index + 1).toString().padStart(3, '0');
  return `ITEM-${year}-${sequence}`;
};

// ── Shared: Item Name Search Field ──
const ItemNameField = ({ line, showSuggestions, suggestions, containerRef, onSearch, onFocus, onSelect, onHide, isExistingItem }: any) => (
  <div className="relative" ref={containerRef}>
    <input
      type="text"
      required
      value={line.item_name}
      onChange={(e) => onSearch(e.target.value)}
      onFocus={onFocus}
      placeholder="Search or add item..."
      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold placeholder:text-slate-300 text-base"
    />
    {!isExistingItem && line.item_name.length > 2 && (
      <div className="absolute -top-3 -right-2 px-2 py-1 rounded-lg bg-emerald-500 text-white text-[8px] font-black uppercase shadow-lg animate-bounce z-10 flex items-center gap-1">
        <Sparkles className="h-2 w-2" /> NEW
      </div>
    )}
    {showSuggestions && suggestions.length > 0 && (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {suggestions.map((item: MasterItem) => (
          <div
            key={item.id}
            onMouseDown={(e) => { e.preventDefault(); onSelect(item); onHide(); }}
            className="px-5 py-3 hover:bg-emerald-500 hover:text-white cursor-pointer transition-all flex items-center justify-between group"
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
);

// ── Mobile Card Item ──
const MobileItemCard = memo(({ index, line, masterItems, onUpdate, onRemove }: {
  index: number; line: LineItem; masterItems: MasterItem[];
  onUpdate: (u: Partial<LineItem>) => void; onRemove: () => void;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MasterItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isExistingItem = useMemo(() => masterItems.some(m => m.name.toLowerCase() === line.item_name.toLowerCase()), [masterItems, line.item_name]);
  const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.rate_per_unit) || 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (q: string) => {
    onUpdate({ item_name: q });
    const matches = q.length > 0
      ? masterItems.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
      : masterItems.slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(true);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">{index + 1}</div>
          {lineTotal > 0 && <span className="text-lg font-black text-emerald-600">₹{lineTotal.toLocaleString()}</span>}
        </div>
        <button type="button" onClick={onRemove} className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name *</label>
        <ItemNameField
          line={line} masterItems={masterItems} showSuggestions={showSuggestions}
          suggestions={suggestions} containerRef={containerRef} isExistingItem={isExistingItem}
          onSearch={handleSearch}
          onFocus={() => {
            const matches = line.item_name
              ? masterItems.filter(i => i.name.toLowerCase().includes(line.item_name.toLowerCase())).slice(0, 8)
              : masterItems.slice(0, 8);
            setSuggestions(matches); setShowSuggestions(matches.length > 0);
          }}
          onSelect={(item: MasterItem) => onUpdate({ item_name: item.name, category: item.category, unit: item.unit })}
          onHide={() => setShowSuggestions(false)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
          <select value={line.category} onChange={(e) => onUpdate({ category: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-emerald-50 border-none text-[11px] font-black uppercase tracking-widest text-emerald-600 appearance-none">
            <option value="">Category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manufacturer</label>
          <input type="text" placeholder="Brand / Mfg" value={line.manufacturer}
            onChange={(e) => onUpdate({ manufacturer: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none text-slate-900 font-bold text-sm placeholder:text-slate-300" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty *</label>
          <input type="number" required placeholder="0" value={line.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-black text-xl" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
          <select value={line.unit} onChange={(e) => onUpdate({ unit: e.target.value })}
            className="w-full px-3 py-4 rounded-2xl bg-slate-50 border-none font-black text-xs uppercase text-slate-500 appearance-none">
            <option value="">Unit</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate ₹ *</label>
          <input type="number" required placeholder="0" value={line.rate_per_unit}
            onChange={(e) => onUpdate({ rate_per_unit: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-black text-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref No</label>
          <input type="text" placeholder="REF CODE" value={line.item_ref_no}
            onChange={(e) => onUpdate({ item_ref_no: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none text-slate-900 font-black text-xs uppercase" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
          <select value={line.storage_location} onChange={(e) => onUpdate({ storage_location: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-bold text-xs appearance-none">
            {STORAGE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
});
MobileItemCard.displayName = 'MobileItemCard';

// ── Desktop Table Row ──
const InventoryRow = memo(({ index, line, masterItems, onUpdate, onRemove }: {
  index: number; line: LineItem; masterItems: MasterItem[];
  onUpdate: (updates: Partial<LineItem>) => void; onRemove: () => void;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MasterItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isExistingItem = useMemo(() => masterItems.some(m => m.name.toLowerCase() === line.item_name.toLowerCase()), [masterItems, line.item_name]);
  const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.rate_per_unit) || 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (query: string) => {
    onUpdate({ item_name: query });
    const matches = query.length > 0
      ? masterItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
      : [];
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  return (
    <tr className="group hover:bg-slate-50/40 transition-all duration-300 border-b border-slate-50">
      <td className="px-6 py-10 align-middle">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg group-hover:scale-110 transition-transform">{index + 1}</div>
      </td>
      <td className="px-6 py-10 align-middle min-w-[260px]">
        <ItemNameField
          line={line} masterItems={masterItems} showSuggestions={showSuggestions}
          suggestions={suggestions} containerRef={containerRef} isExistingItem={isExistingItem}
          onSearch={handleSearch}
          onFocus={() => {
            const matches = line.item_name
              ? masterItems.filter(i => i.name.toLowerCase().includes(line.item_name.toLowerCase()) || i.category.toLowerCase().includes(line.item_name.toLowerCase())).slice(0, 8)
              : masterItems.slice(0, 8);
            setSuggestions(matches); setShowSuggestions(matches.length > 0);
          }}
          onSelect={(item: MasterItem) => onUpdate({ item_name: item.name, category: item.category, unit: item.unit })}
          onHide={() => setShowSuggestions(false)}
        />
      </td>
      <td className="px-6 py-10 align-middle">
        <select value={line.category} onChange={(e) => onUpdate({ category: e.target.value })}
          className="w-full text-[10px] font-black uppercase tracking-widest text-emerald-600 px-5 py-5 rounded-2xl bg-emerald-50 border-none appearance-none cursor-pointer min-w-[140px]">
          <option value="">Category</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-6 py-10 align-middle">
        <div className="relative min-w-[170px]">
          <Factory className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input type="text" placeholder="Batch Code" value={line.item_ref_no}
            onChange={(e) => onUpdate({ item_ref_no: e.target.value })}
            className="w-full pl-10 pr-4 py-5 rounded-2xl bg-slate-50 border-none text-slate-900 font-black text-xs uppercase" />
        </div>
      </td>
      <td className="px-6 py-10 align-middle">
        <input type="text" placeholder="Manufacturer" value={line.manufacturer}
          onChange={(e) => onUpdate({ manufacturer: e.target.value })}
          className="w-full px-5 py-5 rounded-2xl bg-slate-50 border-none text-slate-900 font-bold text-sm placeholder:text-slate-300 min-w-[180px]" />
      </td>
      <td className="px-6 py-10 align-middle">
        <input type="number" required placeholder="0" value={line.quantity}
          onChange={(e) => onUpdate({ quantity: e.target.value })}
          className="w-full px-5 py-5 rounded-2xl bg-slate-50 border-none font-black text-xl min-w-[100px]" />
      </td>
      <td className="px-6 py-10 align-middle">
        <select value={line.unit} onChange={(e) => onUpdate({ unit: e.target.value })}
          className="w-full px-5 py-5 rounded-2xl font-black text-xs uppercase bg-slate-50 text-slate-500 min-w-[100px]">
          <option value="">Unit</option>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-6 py-10 align-middle">
        <div className="relative min-w-[140px]">
          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <input type="number" required placeholder="0.00" value={line.rate_per_unit}
            onChange={(e) => onUpdate({ rate_per_unit: e.target.value })}
            className="w-full pl-10 pr-4 py-5 rounded-2xl bg-slate-50 border-none font-black text-lg" />
        </div>
      </td>
      <td className="px-6 py-10 align-middle">
        <div className="relative min-w-[180px]">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <select value={line.storage_location} onChange={(e) => onUpdate({ storage_location: e.target.value })}
            className="w-full pl-10 pr-10 py-5 rounded-2xl bg-slate-50 border-none font-bold text-xs appearance-none">
            {STORAGE_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
          </select>
        </div>
      </td>
      <td className="px-6 py-10 align-middle text-right min-w-[120px]">
        <p className="text-lg font-black text-slate-900 whitespace-nowrap">₹{lineTotal.toLocaleString()}</p>
      </td>
      <td className="px-6 py-10 align-middle text-center">
        <button type="button" onClick={onRemove}
          className="h-12 w-12 flex items-center justify-center rounded-[20px] bg-rose-50 text-rose-300 hover:bg-rose-500 hover:text-white transition-all">
          <Trash2 className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
});
InventoryRow.displayName = 'InventoryRow';

export function InventoryForm({ onSuccess }: InventoryFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbItemCount, setDbItemCount] = useState(0);
  // Map: lowercase item_name → existing item_reference_number from DB
  const [inventoryRefMap, setInventoryRefMap] = useState<Record<string, string>>({});

  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const [billsRes, itemsRes, countRes, refsRes] = await Promise.all([
          supabase.from('accounts').select('*').in('transaction_type', ['expense', 'invoice']).order('transaction_date', { ascending: false }),
          supabase.from('master_items').select('*').order('name', { ascending: true }),
          supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
          supabase.from('inventory_items').select('item_name, item_reference_number').not('item_reference_number', 'is', null)
        ]);
        setPurchaseBills(billsRes.data || []);
        setMasterItems(itemsRes.data || []);
        setDbItemCount(countRes.count || 0);
        // Build name → ref map for auto-fill
        const refMap: Record<string, string> = {};
        (refsRes.data || []).forEach((r: any) => {
          if (r.item_name && r.item_reference_number)
            refMap[r.item_name.toLowerCase()] = r.item_reference_number;
        });
        setInventoryRefMap(refMap);
      } catch (err) {
        console.error('Initialization Error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleBillSelect = (billId: string) => {
    setSelectedBillId(billId);
    const bill = purchaseBills.find(b => b.id === billId);
    setSelectedBill(bill || null);
    if (bill && lineItems.length === 0) addNewRow();
  };

  const addNewRow = useCallback(() => {
    setLineItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        item_name: '', category: 'General', quantity: '', rate_per_unit: '',
        unit: 'Nos', item_ref_no: generateItemRefNo(dbItemCount, prev.length),
        manufacturer: '', storage_location: 'Main Store', custom_location: ''
      }
    ]);
  }, [dbItemCount]);

  const updateItem = useCallback((idx: number, u: Partial<LineItem>) => {
    setLineItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...u };
      // If the item_name changed, resolve the correct ref number:
      // 1. Existing DB item → use its stored ref
      // 2. Another row in this batch with the same name → share its ref
      // 3. Brand new → keep the generated sequential ref
      if (u.item_name !== undefined) {
        const key = u.item_name.toLowerCase();
        if (inventoryRefMap[key]) {
          next[idx].item_ref_no = inventoryRefMap[key];
        } else {
          const siblingRow = prev.find((row, i) =>
            i !== idx && row.item_name.toLowerCase() === key && row.item_ref_no
          );
          if (siblingRow) next[idx].item_ref_no = siblingRow.item_ref_no;
        }
      }
      return next;
    });
  }, [inventoryRefMap]);

  const removeItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const performBatchSave = async (itemsToSave: LineItem[]) => {
    if (!selectedBill || !user) {
      toast.error('Session or Bill Reference lost. Please try again.');
      return false;
    }
    const billCustomer = selectedBill.customer_name;
    const billInvoice = selectedBill.invoice_number;
    setSaving(true);
    try {
      const newItemsToRegister = itemsToSave
        .filter(item => !masterItems.some(m => m.name.toLowerCase() === item.item_name.toLowerCase()))
        .reduce((acc: any[], item) => {
          if (!acc.some(a => a.name.toLowerCase() === item.item_name.toLowerCase())) {
            acc.push({ name: item.item_name, category: item.category || 'General', unit: item.unit || 'Nos' });
          }
          return acc;
        }, []);

      if (newItemsToRegister.length > 0) {
        const { error } = await supabase.from('master_items').upsert(newItemsToRegister, { onConflict: 'name' });
        if (error) throw error;
      }

      const aggregated = itemsToSave.reduce((acc: any, curr) => {
        const name = curr.item_name.toLowerCase();
        if (!acc[name]) acc[name] = { ...curr, q: 0, c: 0 };
        const q = parseFloat(curr.quantity) || 0;
        const r = parseFloat(curr.rate_per_unit) || 0;
        acc[name].q += q;
        acc[name].c += q * r;
        return acc;
      }, {});

      const { data: existing, error: eError } = await supabase.from('inventory_items').select('*').in('item_name', Object.values(aggregated).map((a: any) => a.item_name));
      if (eError) throw eError;

      const upserts = Object.values(aggregated).map((item: any) => {
        const dbItem = existing?.find(e => e.item_name.toLowerCase() === item.item_name.toLowerCase());
        const totalQty = (dbItem?.quantity || 0) + item.q;
        const totalValue = ((dbItem?.quantity || 0) * (dbItem?.average_price || 0)) + item.c;
        const newAvg = totalQty > 0 ? totalValue / totalQty : (item.q > 0 ? item.c / item.q : 0);
        
        return {
          id: dbItem?.id,
          item_name: item.item_name,
          item_code: dbItem?.item_code || item.item_ref_no,
          category: item.category,
          quantity: totalQty,
          average_price: newAvg,
          unit: item.unit,
          location: item.storage_location,
          supplier: billCustomer,
          last_restock_date: transactionDate,
          item_reference_number: dbItem?.item_reference_number || item.item_ref_no,
          updated_at: new Date().toISOString()
        };
      });

      const { data: saved, error: uError } = await supabase.from('inventory_items').upsert(upserts, { onConflict: 'item_code' }).select();
      if (uError) throw uError;

      const trans = itemsToSave.map(item => {
        const si = saved?.find(s => s.item_name.toLowerCase() === item.item_name.toLowerCase());
        return {
          item_id: si?.id,
          user_id: user.id,
          transaction_type: 'in',
          quantity: parseFloat(item.quantity) || 0,
          date: transactionDate,
          purpose: `Purchase Ref: ${billInvoice}`,
          notes: `Bill: ${billInvoice} | Rate: ${item.rate_per_unit}`
        };
      });

      const { error: tError } = await supabase.from('inventory_transactions').insert(trans);
      if (tError) throw tError;

      return true;
    } catch (err) {
      console.error('Procurement Error:', err);
      toast.error('Commit Failed: ' + (err instanceof Error ? err.message : 'DB Error'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return toast.warning('Please select a purchase bill reference first');
    if (lineItems.length === 0) return toast.warning('Please add at least one line item');

    // Robust Validation
    const invalidItems = lineItems.filter(i => !i.item_name || !i.quantity || parseFloat(i.quantity) <= 0 || !i.category);
    if (invalidItems.length > 0) {
      return toast.warning('Please ensure all items have a Name, valid Quantity (>0), and Category selected');
    }

    const success = await performBatchSave(lineItems);
    if (success) {
      toast.success('Inventory Catalog Updated Successfully!');
      if (onSuccess) onSuccess();
      setLineItems([]); setSelectedBillId(''); setSelectedBill(null);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400 font-bold">Initializing Interface...</div>;

  const batchTotal = lineItems.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate_per_unit) || 0), 0);

  return (
    <div className="space-y-5 md:space-y-10 pb-24">
      {/* ── Bill Selector ── */}
      <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-12 shadow-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Reference Bill</label>
          <select value={selectedBillId} onChange={(e) => handleBillSelect(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10">
            <option value="">Select a Purchase Bill / Expense</option>
            {purchaseBills.map(b => (
              <option key={b.id} value={b.id}>
                {b.invoice_number ? `${b.invoice_number} - ` : ''}{b.customer_name} (₹{b.amount?.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Arrival Date</label>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10" />
        </div>
      </div>

      {/* ── Bill Detail Card ── */}
      {selectedBill && (
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor</p>
              <p className="text-base md:text-xl font-black text-slate-900 truncate">{selectedBill.customer_name}</p>
              {selectedBill.invoice_number && <p className="text-xs text-slate-400 font-bold">{selectedBill.invoice_number}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bill Value</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">₹{(selectedBill.amount || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance Due</p>
              <p className="text-xl md:text-2xl font-black text-rose-600">
                ₹{((selectedBill.amount || 0) - (selectedBill.amount_given || 0)).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
              <p className="text-base md:text-xl font-bold text-slate-600">
                {new Date(selectedBill.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Items Form ── */}
      {selectedBill && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-500">

          {/* MOBILE: Card layout */}
          <div className="md:hidden space-y-4">
            {lineItems.map((line, idx) => (
              <MobileItemCard
                key={line.id} index={idx} line={line} masterItems={masterItems}
                onUpdate={(u) => updateItem(idx, u)}
                onRemove={() => removeItem(line.id)}
              />
            ))}
          </div>

          {/* DESKTOP: Table layout */}
          <div className="hidden md:block bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-6 py-6 text-left">#</th>
                    <th className="px-4 py-6 text-left">Item Name</th>
                    <th className="px-4 py-6 text-left">Category</th>
                    <th className="px-4 py-6 text-left">Ref No</th>
                    <th className="px-4 py-6 text-left">Manufacturer</th>
                    <th className="px-4 py-6 text-left">Qty</th>
                    <th className="px-4 py-6 text-left">Unit</th>
                    <th className="px-4 py-6 text-left">Rate</th>
                    <th className="px-4 py-6 text-left">Location</th>
                    <th className="px-4 py-6 text-right">Total</th>
                    <th className="px-4 py-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lineItems.map((line, idx) => (
                    <InventoryRow
                      key={line.id} index={idx} line={line} masterItems={masterItems}
                      onUpdate={(u) => updateItem(idx, u)}
                      onRemove={() => removeItem(line.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white rounded-3xl md:rounded-[40px] p-5 md:p-8 shadow-xl border border-slate-100">
            <button type="button" onClick={addNewRow}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-50 rounded-2xl font-black text-xs text-slate-900 border border-slate-200 hover:shadow-xl transition-all">
              <Plus className="h-4 w-4" /> ADD LINE ITEM
            </button>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
              <div className="text-center sm:text-right">
                <p className="text-[10px] font-black uppercase text-slate-400">Batch Value</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">₹{batchTotal.toLocaleString()}</p>
              </div>
              <button type="submit" disabled={saving || lineItems.length === 0}
                className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-emerald-600 text-white rounded-2xl md:rounded-3xl font-black text-sm shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : '✓ COMMIT TO REPOSITORY'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
