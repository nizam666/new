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
  Factory,
  TrendingUp,
  Layers,
  FileText,
  History,
  X,
  PackagePlus
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
  units_per_box: string; // How many Nos fit in 1 Box (only relevant when unit === 'Box')
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

// ── Quick Ref No Generator: ITEM-DDMMYY-001 ──
const generateQuickRefNo = () => {
  const now = new Date();
  const dd = now.getDate().toString().padStart(2, '0');
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const yy = now.getFullYear().toString().slice(-2);
  const seq = Math.floor(Math.random() * 90 + 10).toString().padStart(3, '0'); // 010–099 range
  return `ITEM-${dd}${mm}${yy}-${seq}`;
};

// ── Shared: Item Name Search Field ──
const ItemNameField = ({ line, showSuggestions, suggestions, containerRef, onSearch, onFocus, onSelect, onHide, isExistingItem, onRegisterItem }: any) => (
  <div className="relative" ref={containerRef}>
    <input
      type="text"
      required
      value={line.item_name}
      onChange={(e) => onSearch(e.target.value)}
      onFocus={onFocus}
      placeholder="Search or add item..."
      className={`w-full px-5 py-4 rounded-2xl border-none focus:ring-4 text-slate-900 font-bold placeholder:text-slate-300 text-base transition-all ${
        !isExistingItem && line.item_name.length >= 2
          ? 'bg-amber-50 focus:ring-amber-400/20 ring-2 ring-amber-300'
          : 'bg-slate-50 focus:ring-emerald-500/10'
      }`}
    />
    {/* NEW item indicator + quick register button */}
    {!isExistingItem && line.item_name.length >= 2 && (
      <div className="absolute top-full left-0 right-0 z-50 mt-2">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onRegisterItem(line.item_name); }}
          className="w-full flex items-center gap-3 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl shadow-xl transition-all active:scale-95 font-black text-sm"
        >
          <PackagePlus className="h-5 w-5" />
          <span>Register &ldquo;{line.item_name}&rdquo; in Master Catalog</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
    )}
    {showSuggestions && suggestions.length > 0 && (
      <div className="absolute top-full left-0 right-0 z-40 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
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
const MobileItemCard = memo(({ index, line, masterItems, onUpdate, onRemove, onRegisterItem }: {
  index: number; line: LineItem; masterItems: MasterItem[];
  onUpdate: (u: Partial<LineItem>) => void; onRemove: () => void; onRegisterItem: (name: string) => void;
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
          onRegisterItem={onRegisterItem}
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
          <select value={line.unit} onChange={(e) => onUpdate({ unit: e.target.value, units_per_box: '' })}
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

      {/* Box breakdown field */}
      {line.unit === 'Box' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100">
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest whitespace-nowrap">1 Box =</span>
          <input
            type="number"
            min="1"
            placeholder="e.g. 12"
            value={line.units_per_box}
            onChange={(e) => onUpdate({ units_per_box: e.target.value })}
            className="w-full px-4 py-2 rounded-xl bg-white border border-amber-200 font-black text-amber-900 text-base focus:ring-2 focus:ring-amber-400/30"
          />
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest whitespace-nowrap">Nos</span>
        </div>
      )}

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
const InventoryRow = memo(({ index, line, masterItems, onUpdate, onRemove, onRegisterItem }: {
  index: number; line: LineItem; masterItems: MasterItem[];
  onUpdate: (updates: Partial<LineItem>) => void; onRemove: () => void; onRegisterItem: (name: string) => void;
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
          onRegisterItem={onRegisterItem}
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
        <div className="flex flex-col gap-2 min-w-[130px]">
          <select value={line.unit} onChange={(e) => onUpdate({ unit: e.target.value, units_per_box: '' })}
            className="w-full px-5 py-5 rounded-2xl font-black text-xs uppercase bg-slate-50 text-slate-500">
            <option value="">Unit</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          {line.unit === 'Box' && (
            <div className="flex items-center gap-1 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-[9px] font-black text-amber-600 uppercase whitespace-nowrap">1 Box=</span>
              <input
                type="number"
                min="1"
                placeholder="Nos"
                value={line.units_per_box}
                onChange={(e) => onUpdate({ units_per_box: e.target.value })}
                className="w-full px-2 py-1 rounded-lg bg-white border border-amber-200 font-black text-amber-900 text-sm focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
          )}
        </div>
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
  const [inventoryRefMap, setInventoryRefMap] = useState<Record<string, string>>({});

  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ totalValue: 0, totalItems: 0, billCount: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalQty, setOriginalQty] = useState(0);
  const [billItems, setBillItems] = useState<any[]>([]);

  // ── Quick Register new item state ──
  const [quickRegister, setQuickRegister] = useState<{
    show: boolean; name: string; category: string; unit: string; refNo: string; saving: boolean; lineIndex: number;
  }>({ show: false, name: '', category: '', unit: '', refNo: '', saving: false, lineIndex: -1 });

  const handleQuickRegister = async () => {
    if (!quickRegister.name || !quickRegister.category || !quickRegister.unit) {
      toast.warning('Please fill in Item Name, Category, and Unit');
      return;
    }
    setQuickRegister(prev => ({ ...prev, saving: true }));
    try {
      const { error } = await supabase.from('master_items').upsert([{
        name: quickRegister.name.trim(),
        category: quickRegister.category,
        unit: quickRegister.unit,
        min_stock_level: 0,
        description: ''
      }], { onConflict: 'name' });
      if (error) throw error;
      toast.success(`"${quickRegister.name}" registered in Master Catalog!`);
      // Refresh master items list
      const { data: masterData } = await supabase.from('master_items').select('id, name, category, unit');
      setMasterItems((masterData || []).map((m: any) => ({ id: m.id, name: m.name, category: m.category, unit: m.unit })));
      // Auto-fill the triggering line item with Category, Unit and Ref No
      if (quickRegister.lineIndex >= 0) {
        updateItem(quickRegister.lineIndex, {
          category: quickRegister.category,
          unit: quickRegister.unit,
          item_ref_no: quickRegister.refNo,
        });
      }
      setQuickRegister({ show: false, name: '', category: '', unit: '', refNo: '', saving: false, lineIndex: -1 });
    } catch (err: any) {
      toast.error('Failed to register: ' + (err.message || 'Unknown error'));
      setQuickRegister(prev => ({ ...prev, saving: false }));
    }
  };

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      // Fetch latest monthly stats
      const startOfMontObj = new Date();
      startOfMontObj.setDate(1);
      startOfMontObj.setHours(0, 0, 0, 0);
      const startOfMonth = startOfMontObj.toISOString();

      // 1. Fetch all expenses for this month to calculate true Procurement Spend
      const { data: monthBills } = await supabase
        .from('accounts')
        .select('amount')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', startOfMonth.split('T')[0]);

      const totalVal = (monthBills || []).reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);

      // 2. Fetch inventory items to calculate item count
      const { data: statsData } = await supabase
        .from('inventory_transactions')
        .select('quantity')
        .eq('transaction_type', 'in')
        .gte('date', startOfMonth.split('T')[0]);

      let totalI = 0;
      (statsData || []).forEach(s => {
        totalI += (s.quantity || 0);
      });

      // 3. Fetch all expense bills for the selection dropdown (including closed ones for editing)
      const { data: allBills } = await supabase
        .from('accounts')
        .select('*')
        .eq('transaction_type', 'expense')
        .order('transaction_date', { ascending: false });

      const pendingCount = (allBills || []).filter((b: any) => b.status === 'pending').length;

      setMonthlyStats({
        totalValue: totalVal,
        totalItems: totalI,
        billCount: pendingCount
      });
      setPurchaseBills(allBills || []);

      // Fetch master items lookup
      const { data: masterData } = await supabase
        .from('inventory_items')
        .select('id, item_name, item_code, category, unit, location');
      
      const mappedMaster: MasterItem[] = (masterData || []).map((m: any) => ({
        id: m.id,
        name: m.item_name,
        category: m.category,
        unit: m.unit
      }));
      setMasterItems(mappedMaster);
      setDbItemCount(mappedMaster.length);

      // Fetch recent history
      const { data: hData } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          inventory_items!inner(item_name, item_code, category, unit, location)
        `)
        .eq('transaction_type', 'in')
        .gte('date', startOfMonth.split('T')[0])
        .order('date', { ascending: false });
      setHistory(hData || []);

      // Build name → ref map for auto-fill
      const refMap: Record<string, string> = {};
      (masterData || []).forEach((r: any) => {
        if (r.item_name && r.item_code)
          refMap[r.item_name.toLowerCase()] = r.item_code;
      });
      setInventoryRefMap(refMap);
    } catch (err) {
      console.error('Initialization Error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBillSelect = async (billId: string) => {
    setSelectedBillId(billId);
    setBillItems([]); // Reset previous
    const bill = purchaseBills.find(b => b.id === billId);
    setSelectedBill(bill || null);
    
    if (bill) {
      // Fetch already recorded items for this bill
      try {
        const { data } = await supabase
          .from('inventory_transactions')
          .select(`
            *,
            inventory_items(item_name, unit)
          `)
          .eq('transaction_type', 'in')
          .eq('purpose', `Purchase Ref: ${bill.invoice_number}`);
        
        if (data) setBillItems(data);
      } catch (err) {
        console.error('Error fetching bill items:', err);
      }
      
      if (lineItems.length === 0) addNewRow();
    }
  };

  const addNewRow = useCallback(() => {
    setLineItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        item_name: '', category: 'General', quantity: '', rate_per_unit: '',
        unit: 'Nos', units_per_box: '', item_ref_no: generateItemRefNo(dbItemCount, prev.length),
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
      // 1. Register new items in the master catalog if they don't exist
      const newItemsToRegister = itemsToSave
        .filter(item => !masterItems.some(m => m.name.toLowerCase() === item.item_name.toLowerCase()))
        .reduce((acc: any[], item) => {
          if (!acc.some(a => a.name.toLowerCase() === item.item_name.toLowerCase())) {
            acc.push({ 
              name: item.item_name.trim(), 
              category: item.category || 'General', 
              unit: item.unit === 'Box' ? 'Nos' : (item.unit || 'Nos') // Always store base unit as Nos
            });
          }
          return acc;
        }, []);

      if (newItemsToRegister.length > 0) {
        // Use upsert on 'name' to ensure we don't create duplicates and we populate the master catalog correctly
        const { error: miError } = await supabase.from('master_items').upsert(newItemsToRegister, { onConflict: 'name' });
        if (miError) throw miError;
      }

      // 2. Aggregate identical items in the current batch for inventory update
      const aggregated = itemsToSave.reduce((acc: any, curr) => {
        const name = curr.item_name.trim().toLowerCase();
        if (!acc[name]) acc[name] = { ...curr, q: 0, c: 0 };
        const boxes = parseFloat(curr.quantity) || 0;
        const unitsPerBox = curr.unit === 'Box' && curr.units_per_box ? parseFloat(curr.units_per_box) : 1;
        const q = boxes * unitsPerBox; // Always accumulate in Nos
        const r = parseFloat(curr.rate_per_unit) || 0;
        acc[name].q += q;
        acc[name].c += q * r;
        return acc;
      }, {});

      if (Object.keys(aggregated).length === 0) throw new Error('No valid items found in batch');

      // Helper: Generate UUID if not found
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // 3. Fetch existing inventory items by Name OR Code with robust escaping
      const itemNames = Object.values(aggregated).map((a: any) => a.item_name.replace(/'/g, "''"));
      const itemCodes = Object.values(aggregated).map((a: any) => a.item_ref_no.replace(/'/g, "''"));

      const { data: existing, error: eError } = await supabase
        .from('inventory_items')
        .select('id, item_name, item_code, quantity')
        .or(`item_name.in.(${itemNames.map(n => `"${n}"`).join(',')}),item_code.in.(${itemCodes.map(c => `"${c}"`).join(',')})`);
      
      if (eError) throw eError;

      // 4. Prepare updates/inserts for inventory_items - GURANTEEING ID
      const upserts = Object.values(aggregated).map((item: any) => {
        // Precise matching by item_code (Reliable unique key)
        const dbItem = existing?.find(e => e.item_code === item.item_ref_no) || 
                       existing?.find(e => e.item_name.toLowerCase() === item.item_name.toLowerCase());

        const totalQty = (dbItem?.quantity || 0) + item.q;
        
        // Build the update payload
        const upsertRow: any = {
          id: dbItem?.id || generateUUID(),
          item_name: item.item_name.trim(),
          item_code: item.item_ref_no,
          category: item.category,
          quantity: totalQty,
          unit: item.unit === 'Box' ? 'Nos' : item.unit,
          location: item.storage_location,
          supplier: billCustomer,
          last_restock_date: transactionDate || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        };

        return upsertRow;
      });

      const { data: saved, error: uError } = await supabase
        .from('inventory_items')
        .upsert(upserts, { onConflict: 'item_code' })
        .select();
      if (uError) throw uError;

      // 5. Log individual transactions for each line item
      const trans = itemsToSave.map(item => {
        const si = saved?.find(s => s.item_name.toLowerCase() === item.item_name.toLowerCase());
        const boxes = parseFloat(item.quantity) || 0;
        const unitsPerBox = item.unit === 'Box' && item.units_per_box ? parseFloat(item.units_per_box) : 1;
        const actualQty = boxes * unitsPerBox; // Always store in Nos
        const boxNote = item.unit === 'Box' && item.units_per_box
          ? ` | Box: ${boxes} × ${unitsPerBox} Nos`
          : '';
        return {
          item_id: si?.id,
          user_id: user.id,
          transaction_type: 'in',
          quantity: actualQty,
          date: transactionDate || new Date().toISOString().split('T')[0],
          purpose: `Purchase Ref: ${billInvoice}`,
          notes: `Bill: ${billInvoice} | Rate: ${item.rate_per_unit}${boxNote}`
        };
      });

      const { error: tError } = await supabase.from('inventory_transactions').insert(trans);
      if (tError) throw tError;

      // 6. Automatically Close Bill if fully allocated
      const batchTotal = itemsToSave.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate_per_unit) || 0), 0);
      
      const currentSpentValue = billItems
        .filter(item => item.id !== editingId)
        .reduce((acc, item) => {
          const notes = item.notes || '';
          const rateMatch = notes.match(/Rate:\s*([\d.]+)/);
          const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;
          
          const boxMatch = notes.match(/Box:\s*([\d.]+)\s*×\s*([\d.]+)\s*Nos/);
          if (boxMatch) {
            const boxCount = parseFloat(boxMatch[1]) || 0;
            return acc + (boxCount * rate);
          }
          return acc + ((parseFloat(item.quantity) || 0) * rate);
        }, 0);

      const totalAfterBatch = currentSpentValue + batchTotal;
      const isActuallyComplete = Math.abs(totalAfterBatch - selectedBill.amount) < 0.05;

      if (isActuallyComplete) {
        await supabase
          .from('accounts')
          .update({ status: 'completed' })
          .eq('id', selectedBill.id);
        toast.info('Bill fully allocated and moved to completed registry');
      }

      return true;
    } catch (err: any) {
      console.error('Procurement Error:', err);
      // Display detailed error code/message to aid debugging
      const errorMsg = err.message || err.details || 'Database Error';
      const errorCode = err.code ? `[${err.code}] ` : '';
      toast.error(`Commit Failed: ${errorCode}${errorMsg}`);
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

    if (remainingAllocation < -0.01) {
      toast.error(`Over-Entry Alert: This entry would exceed the bill's total amount by ₹${Math.abs(remainingAllocation).toLocaleString()}. Please adjust your quantities or rates.`);
      return;
    }

    // Capture bill ID before async save (state may shift)
    const savedBillId = selectedBill!.id;
    const wasEditing = !!editingId;

    const success = await performBatchSave(lineItems);
    if (success) {
      // If we were editing, delete the old transaction to avoid duplication
      if (wasEditing) {
        const oldItem = history.find(h => h.id === editingId);
        if (oldItem) {
          const { data: inv } = await supabase.from('inventory_items').select('quantity').eq('id', oldItem.item_id).single();
          if (inv) {
            await supabase.from('inventory_items').update({ quantity: inv.quantity - originalQty }).eq('id', oldItem.item_id);
          }
        }
        await supabase.from('inventory_transactions').delete().eq('id', editingId);
      }

      toast.success(wasEditing ? 'Transaction Corrected Successfully!' : 'Inventory Catalog Updated Successfully!');

      // Refresh global data (re-fetches purchaseBills with status='pending' only)
      await fetchData();

      // PARTIAL ENTRY LOGIC: Check the live DB to see if the bill is still pending.
      // We cannot use the pre-save 'remainingAllocation' here — it's stale.
      const { data: freshBill } = await supabase
        .from('accounts')
        .select('status')
        .eq('id', savedBillId)
        .single();

      const billStillPending = freshBill?.status === 'pending';

      if (billStillPending && !wasEditing) {
        // Keep bill context but clear line items for the next partial entry
        setLineItems([]);
        setEditingId(null);
        setOriginalQty(0);
        // Refresh billItems panel and allocation counter
        handleBillSelect(savedBillId);
        toast.info('Partial Save: Bill still has a remaining balance. Add more items to complete it.');
      } else {
        // Bill fully allocated or this was an edit — reset everything
        setLineItems([]);
        setSelectedBillId('');
        setSelectedBill(null);
        setBillItems([]);
        setEditingId(null);
        setOriginalQty(0);
      }
      
      if (onSuccess) onSuccess();
    }
  };

  // Calculate Remaining Allocation: Bill Amount - Value of items already in inventory
  const totalAllocatedValue = useMemo(() => {
    return billItems
      .filter(item => item.id !== editingId) // Ignore the record we are currently correcting/editing
      .reduce((acc, item) => {
        const notes = item.notes || '';
        // Robust Extraction: Look for 'Rate: ' followed by a numeric value
        const rateMatch = notes.match(/Rate:\s*([\d.]+)/);
        const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;
        
        // BOX-AWARE LOGIC:
        // If notes contain "| Box: [Qty] × [Units] Nos", we calculate based on the Box count
        // because the stored rate was 'Rate per Box'.
        const boxMatch = notes.match(/Box:\s*([\d.]+)\s*×\s*([\d.]+)\s*Nos/);
        
        if (boxMatch) {
          const boxCount = parseFloat(boxMatch[1]) || 0;
          return acc + (boxCount * rate);
        } else {
          // Regular 'Nos' entry
          const qtyCount = parseFloat(item.quantity) || 0;
          return acc + (qtyCount * rate);
        }
      }, 0);
  }, [billItems, editingId]);

  const batchTotal = lineItems.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate_per_unit) || 0), 0);
  const remainingAllocation = (selectedBill?.amount || 0) - totalAllocatedValue - batchTotal;

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400 font-bold">Initializing Interface...</div>;

  return (
    <div className="space-y-5 md:space-y-10 pb-24">
      {/* ── Monthly Summary Dashboard ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="relative overflow-hidden rounded-[40px] bg-white p-8 shadow-xl border border-slate-100 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp className="h-24 w-24 text-slate-900" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Monthly Procurement Spend</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-slate-900">₹{monthlyStats.totalValue.toLocaleString()}</h3>
          </div>
          <p className="text-[10px] font-black text-emerald-500 mt-2 uppercase tracking-widest bg-emerald-50 w-fit px-2 py-1 rounded-lg">Month Target tracking</p>
        </div>

        <div className="relative overflow-hidden rounded-[40px] bg-slate-900 p-8 shadow-xl transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Layers className="h-24 w-24 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Procured Inventory Volume</p>
          <h3 className="text-4xl font-black text-white">{monthlyStats.totalItems.toLocaleString()} <span className="text-sm font-bold text-slate-500">Units</span></h3>
          <p className="text-[10px] font-black text-teal-400 mt-2 uppercase tracking-widest bg-white/10 w-fit px-2 py-1 rounded-lg">Real-time restock depth</p>
        </div>

        <div className="relative overflow-hidden rounded-[40px] bg-white p-8 shadow-xl border border-slate-100 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <FileText className="h-24 w-24 text-slate-900" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pending Bill Registry</p>
          <h3 className="text-4xl font-black text-slate-900">{monthlyStats.billCount} <span className="text-sm font-bold text-slate-500">Invoices</span></h3>
          <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest bg-slate-50 w-fit px-2 py-1 rounded-lg">Available for processing</p>
        </div>
      </div>

      {/* ── Bill Selector ── */}
      <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-12 shadow-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Reference Bill</label>
          <select value={selectedBillId} onChange={(e) => handleBillSelect(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10">
            <option value="">Select a Purchase Bill / Expense</option>
            {purchaseBills.map(b => (
              <option key={b.id} value={b.id}>
                {b.invoice_number ? `${b.invoice_number} - ` : ''}{b.customer_name} (₹{b.amount?.toLocaleString()}) {b.status === 'completed' ? '✓ CLOSED' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Arrival Date</label>
          <input type="date" value={transactionDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setTransactionDate(e.target.value)}
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
              <p className={`text-[10px] font-black uppercase tracking-widest ${remainingAllocation < -0.01 ? 'text-rose-500' : 'text-slate-400'}`}>Remaining Allocation</p>
              <p className={`text-xl md:text-2xl font-black ${remainingAllocation < -0.01 ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>
                ₹{remainingAllocation.toLocaleString()}
              </p>
              <div className="flex flex-col">
                <p className={`text-[8px] font-bold uppercase tracking-widest ${remainingAllocation < -0.01 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {remainingAllocation < -0.01 ? 'OVER-ALLOCATED: Adjust rates/qty' : 'Pending to be stocked'}
                </p>
                <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest mt-0.5">
                  Total Spent: ₹{totalAllocatedValue.toLocaleString()}
                </p>
              </div>
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

      {/* ── Recorded Items for this Bill ── */}
      {selectedBill && billItems.length > 0 && (
        <div className="bg-slate-900 rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-2xl border border-white/10 animate-in fade-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <History className="w-32 h-32 text-white" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white tracking-tight leading-none">Previously Recorded Items</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Existing stock arrivals for this reference</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {billItems.map((item, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-all">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors">
                      {item.inventory_items?.item_name || 'Generic Item'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
                      Recorded on {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400 leading-none">+{item.quantity}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{item.inventory_items?.unit}</p>
                    {(() => {
                      const notes = item.notes || '';
                      const rateMatch = notes.match(/Rate:\s*([\d.]+)/);
                      const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;
                      
                      const boxMatch = notes.match(/Box:\s*([\d.]+)\s*×\s*([\d.]+)\s*Nos/);
                      const val = boxMatch 
                        ? (parseFloat(boxMatch[1]) || 0) * rate 
                        : (item.quantity || 0) * rate;

                      if (val > 0) {
                        return <p className="text-[9px] font-black text-white/50 mt-1">₹{val.toLocaleString()}</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))}
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
                onRegisterItem={(name: string) => setQuickRegister({ show: true, name, category: '', unit: '', refNo: generateQuickRefNo(), saving: false, lineIndex: idx })}
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
                      onRegisterItem={(name: string) => setQuickRegister({ show: true, name, category: '', unit: '', refNo: generateQuickRefNo(), saving: false, lineIndex: idx })}
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
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="text-center sm:text-right">
                <p className="text-[10px] font-black uppercase text-slate-400">Batch Value</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">₹{batchTotal.toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                <button type="submit" disabled={saving || lineItems.length === 0}
                  className={`w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 text-white rounded-2xl md:rounded-3xl font-black text-sm shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 ${
                    editingId ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-emerald-600 shadow-emerald-600/20'
                  }`}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? '✓ UPDATE REGISTRY' : '✓ COMMIT TO REPOSITORY')}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingId(null);
                      setLineItems([]);
                      setSelectedBill(null);
                      setSelectedBillId('');
                      setOriginalQty(0);
                      toast.info('Correction mode cancelled');
                    }}
                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                  >
                    Cancel Correction
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Procurement History List (Monthly Summary) ── */}
      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden mt-10">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Recent Procurements</h4>
              <p className="text-xs font-bold text-slate-400">Review and correct this month's stock arrivals</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <TrendingUp className="h-3 w-3" /> Monthly Activity
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Item Details</th>
                <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Bill Ref</th>
                <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</th>
                <th className="px-10 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-10 py-6 text-sm font-bold text-slate-600">
                    {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{item.inventory_items?.item_name || 'Generic Item'}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.inventory_items?.category}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest">
                      {item.purpose?.split('Purchase Ref: ')[1] || 'Direct'}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-slate-900">{item.quantity}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.inventory_items?.unit}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        // Resolving Bill context
                        const billRef = item.purpose?.split('Purchase Ref: ')[1];
                        const matchedBill = purchaseBills.find(b => b.invoice_number === billRef);
                        if (matchedBill) {
                          handleBillSelect(matchedBill.id);
                        }
                        
                        // Loading Item
                        setEditingId(item.id);
                        setOriginalQty(item.quantity);
                        setLineItems([{
                          id: Math.random().toString(36).substr(2, 9),
                          item_name: item.inventory_items?.item_name || '',
                          category: item.inventory_items?.category || 'General',
                          quantity: item.quantity.toString(),
                          rate_per_unit: (item.notes?.split('Rate: ')[1] || '').split(' ')[0],
                          unit: item.inventory_items?.unit || 'Nos',
                          units_per_box: '',
                          item_ref_no: item.inventory_items?.item_code || '',
                          manufacturer: '',
                          storage_location: item.inventory_items?.location || 'Main Store',
                          custom_location: ''
                        }]);
                        toast.info('Editing entry: Correcting stock arrival recorded on ' + item.date);
                      }}
                      className="px-6 py-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Edit Entry
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No procurement activity recorded this month</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick Register Item Modal ── */}
      {quickRegister.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={() => setQuickRegister(prev => ({ ...prev, show: false }))} />
          <div
            className="relative z-10 w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10 border border-white/20 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <PackagePlus className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Register New Item</h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">Add to Master Catalog</p>
                </div>
              </div>
              <button
                onClick={() => setQuickRegister(prev => ({ ...prev, show: false }))}
                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Item name (pre-filled) */}
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Item Name *</label>
                <input
                  type="text"
                  value={quickRegister.name}
                  onChange={(e) => setQuickRegister(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-5 py-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-slate-900 font-black text-base focus:outline-none focus:ring-4 focus:ring-amber-400/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category *</label>
                  <select
                    value={quickRegister.category}
                    onChange={(e) => setQuickRegister(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 appearance-none focus:ring-4 focus:ring-amber-400/20"
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Unit *</label>
                  <select
                    value={quickRegister.unit}
                    onChange={(e) => setQuickRegister(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900 appearance-none focus:ring-4 focus:ring-amber-400/20"
                  >
                    <option value="">Select Unit</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Ref No */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ref No / Item Code</label>
                <input
                  type="text"
                  value={quickRegister.refNo}
                  onChange={(e) => setQuickRegister(prev => ({ ...prev, refNo: e.target.value }))}
                  placeholder="e.g. PG-100, NONEL-3M..."
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none text-slate-900 font-bold uppercase text-sm focus:outline-none focus:ring-4 focus:ring-amber-400/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickRegister(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickRegister}
                  disabled={quickRegister.saving}
                  className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {quickRegister.saving
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <PackagePlus className="h-4 w-4" />}
                  {quickRegister.saving ? 'REGISTERING...' : 'SAVE TO CATALOG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
