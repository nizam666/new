import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Package, 
  Search, 
  Archive,
  Layers,
  Truck,
  Box,
  DollarSign,
  User,
  History,
  X,
  Activity,
  Flame,
  Settings
} from 'lucide-react';


const PG_BOX_SIZE = 200;
const isPGItem = (name: string) => name?.toUpperCase() === 'PG';

interface ConsumeRecord {
  id: string;
  date: string;
  quantity: number;
  operation_type: string;
  unit: string;
}

interface UsageRecord {
  id: string;
  dispatched_to: string;
  quantity: number;
  unit: string;
  date: string;
  price: number;
}

interface StorageItem {
  id: string;
  item_name: string;
  unit: string;
  total_quantity: number;
  consumed_quantity: number;
  remaining_quantity: number;
  total_value: number;
  last_dispatch_date: string;
  usages: UsageRecord[];
  used_history: ConsumeRecord[];
}

export function QuarryStorage() {
  const [fetching, setFetching] = useState(true);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);

  useEffect(() => {
    fetchQuarryStorage();
  }, []);

  const fetchQuarryStorage = async () => {
    setFetching(true);
    try {
      // 1. Fetch all dispatches to Quarry Operations
      const { data: dispatches, error } = await supabase
        .from('inventory_dispatch')
        .select('*')
        .eq('department', 'Quarry Operations');

      if (error) throw error;

      // 2. Fetch consumption data from operations
      const [drillingRes, loadingRes, blastingRes, transportDieselRes] = await Promise.all([
        supabase.from('drilling_records').select('id, date, diesel_consumed'),
        supabase.from('loading_records').select('id, date, quantity_loaded'),
        supabase.from('blasting_records').select('id, date, pg_nos, pg_unit, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos'),
        supabase.from('transport_diesel_records').select('id, date, diesel_liters, vehicle_number')
      ]);



      const usedHistoryMap = {
        diesel: [
          ...(drillingRes.data || []).filter(r => r.diesel_consumed > 0).map(r => ({ id: `drill-${r.id || Math.random()}`, date: r.date, quantity: Number(r.diesel_consumed), operation_type: 'Drilling Operation', unit: 'nos' })),
          ...(loadingRes.data || []).filter(r => r.quantity_loaded > 0).map(r => ({ id: `load-${r.id || Math.random()}`, date: r.date, quantity: Number(r.quantity_loaded), operation_type: 'Excavator/Loading', unit: 'nos' })),
          ...(transportDieselRes.data || []).filter(r => r.diesel_liters > 0).map(r => ({ id: `transport-${r.id || Math.random()}`, date: r.date, quantity: Number(r.diesel_liters), operation_type: `Transport (${r.vehicle_number})`, unit: 'nos' }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        pg: (blastingRes.data || []).filter(r => r.pg_nos > 0).map(r => ({ 
          id: `blast-${r.id || Math.random()}`, 
          date: r.date, 
          quantity: Number(r.pg_nos), 
          operation_type: 'Blasting',
          unit: r.pg_unit || 'nos'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        ed: (blastingRes.data || []).filter(r => r.ed_nos > 0).map(r => ({ id: `blast-${r.id || Math.random()}`, date: r.date, quantity: Number(r.ed_nos), operation_type: 'Blasting', unit: 'nos' })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        edet: (blastingRes.data || []).filter(r => r.edet_nos > 0).map(r => ({ id: `blast-${r.id || Math.random()}`, date: r.date, quantity: Number(r.edet_nos), operation_type: 'Blasting', unit: 'nos' })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        nonel_3m: (blastingRes.data || []).filter(r => r.nonel_3m_nos > 0).map(r => ({ id: `blast-${r.id || Math.random()}`, date: r.date, quantity: Number(r.nonel_3m_nos), operation_type: 'Blasting', unit: 'nos' })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        nonel_4m: (blastingRes.data || []).filter(r => r.nonel_4m_nos > 0).map(r => ({ id: `blast-${r.id || Math.random()}`, date: r.date, quantity: Number(r.nonel_4m_nos), operation_type: 'Blasting', unit: 'nos' })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };

      // Aggregate by item
      const aggregated = (dispatches || []).reduce((acc: Record<string, StorageItem>, curr) => {
        const key = curr.item_id || curr.item_name;
        if (!acc[key]) {
          acc[key] = {
            id: key,
            item_name: curr.item_name,
            unit: curr.unit,
            total_quantity: 0,
            consumed_quantity: 0,
            remaining_quantity: 0,
            total_value: 0,
            last_dispatch_date: curr.dispatch_date,
            usages: [],
            used_history: []
          };
        }
        
        const qty = parseFloat(curr.quantity_dispatched) || 0;
        const price = parseFloat(curr.given_price) || 0;
        const isNos = curr.unit?.toLowerCase() === 'nos';
        const isPG = isPGItem(curr.item_name);

        acc[key].total_quantity += qty;
        // If PG and stored in Nos, we assume price is per Box so we divide qty by 200
        acc[key].total_value += (isPG && isNos ? (qty / PG_BOX_SIZE) * price : qty * price);
        
        if (new Date(curr.dispatch_date) > new Date(acc[key].last_dispatch_date)) {
          acc[key].last_dispatch_date = curr.dispatch_date;
        }

        acc[key].usages.push({
          id: curr.id,
          dispatched_to: curr.dispatched_to,
          quantity: qty,
          unit: curr.unit || '',
          date: curr.dispatch_date,
          price: price
        });

        return acc;
      }, {});

      // Sort usages and calculate consumptions
      const values = Object.values(aggregated).map(item => {
        let used_history: ConsumeRecord[] = [];
        const name = item.item_name.toLowerCase();
        
        if (name.includes('diesel')) { used_history = usedHistoryMap.diesel; }
        else if (name === 'pg' || name.includes('powergel') || name.includes('power gel')) { used_history = usedHistoryMap.pg; }
        else if (name === 'ed' || name.includes('electric detonator')) { used_history = usedHistoryMap.ed; }
        else if (name === 'edet' || name.includes('electronic detonator')) { used_history = usedHistoryMap.edet; }
        else if (name.includes('nonel') && name.includes('3m')) { used_history = usedHistoryMap.nonel_3m; }
        else if (name.includes('nonel') && name.includes('4m')) { used_history = usedHistoryMap.nonel_4m; }

        let totalBoxes = item.usages.reduce((sum, u) => {
          const q = u.quantity;
          const isNos = u.unit?.toLowerCase() === 'nos';
          return sum + (isPGItem(item.item_name) && isNos ? q / PG_BOX_SIZE : q);
        }, 0);

        let consumedBoxes = used_history.reduce((sum, h) => {
          const q = h.quantity;
          const isNos = h.unit?.toLowerCase() === 'nos';
          return sum + (isPGItem(item.item_name) && isNos ? q / PG_BOX_SIZE : q);
        }, 0);

        return {
          ...item,
          total_quantity: totalBoxes,
          consumed_quantity: consumedBoxes,
          remaining_quantity: totalBoxes - consumedBoxes,
          usages: item.usages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          used_history
        };
      });

      setItems(values);
    } catch (error) {
      console.error('Error fetching Quarry storage:', error);
    } finally {
      setFetching(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700 pb-20 md:pb-0">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
              <Archive className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
              Quarry Storage Management
            </h3>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Tracking physical items currently held at Quarry Operations</p>
          </div>
          
          <div className="w-full lg:w-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="w-full lg:min-w-[320px] pl-11 pr-4 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-emerald-500/10 font-bold text-sm shadow-sm transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {fetching ? (
        <div className="bg-white rounded-[40px] border border-slate-100 p-20 flex flex-col items-center justify-center gap-4 shadow-sm">
          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Synchronizing Repository...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-[40px] border border-slate-100 p-20 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Box className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-slate-900 font-black text-xl">No stock found in Quarry</p>
          <p className="text-slate-400 font-medium mt-1">Dispatch items to 'Quarry Operations' using the Dispatch Form.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              onClick={() => setSelectedItem(item)}
              className="bg-white rounded-2xl md:rounded-[32px] border border-slate-100 p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:bg-emerald-600 transition-colors">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-lg leading-tight">{item.item_name}</h4>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 bg-emerald-50 px-2 py-0.5 rounded-md w-fit border border-emerald-100">Quarry Store</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl flex flex-col justify-between border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                       Total<br/>Received
                    </p>
                    <p className="text-sm font-black text-slate-900 tracking-tight mt-1 flex flex-col">
                      <span>{item.total_quantity.toFixed(1)} <span className="text-[8px] uppercase text-slate-400">{isPGItem(item.item_name) ? 'Box' : item.unit}</span></span>
                      {isPGItem(item.item_name) && <span className="text-[9px] font-bold text-slate-400">({(item.total_quantity * PG_BOX_SIZE).toFixed(0)} nos)</span>}
                    </p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-2xl flex flex-col justify-between border border-orange-100">
                    <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-tight">
                       Used<br/>(Ops)
                    </p>
                    <p className="text-sm font-black text-orange-700 tracking-tight mt-1 flex flex-col">
                      <span>{item.consumed_quantity.toFixed(1)} <span className="text-[8px] uppercase text-orange-400">{isPGItem(item.item_name) ? 'Box' : item.unit}</span></span>
                      {isPGItem(item.item_name) && <span className="text-[9px] font-bold text-orange-400/60">({(item.consumed_quantity * PG_BOX_SIZE).toFixed(0)} nos)</span>}
                    </p>
                </div>

                <div className={`p-3 rounded-2xl flex flex-col justify-between border ${item.remaining_quantity < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className={`text-[8px] font-black uppercase tracking-widest leading-tight ${item.remaining_quantity < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                       Remaining<br/>Balance
                    </p>
                    <p className={`text-lg font-black tracking-tight mt-0.5 flex flex-col ${item.remaining_quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      <span>{item.remaining_quantity.toFixed(1)} <span className={`text-[8px] uppercase ${item.remaining_quantity < 0 ? 'text-red-400' : 'text-emerald-500'}`}>{isPGItem(item.item_name) ? 'Box' : item.unit}</span></span>
                      {isPGItem(item.item_name) && <span className={`text-[10px] font-bold ${item.remaining_quantity < 0 ? 'text-red-400' : 'text-emerald-500/60'}`}>({(item.remaining_quantity * PG_BOX_SIZE).toFixed(0)} nos)</span>}
                    </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-2xl mb-4 flex items-center justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <DollarSign className="w-3 h-3 text-emerald-400" />
                     Total Value Dispatched
                  </p>
                  <p className="text-base font-black text-white tracking-tight truncate">
                    ₹{Math.round(item.total_value).toLocaleString()}
                  </p>
              </div>

              <div className="space-y-3 mb-4">
                <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <History className="h-3 w-3" />
                  Usage Details
                </h5>
                <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                  {item.usages.slice(0, 5).map(usage => (
                    <div key={usage.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          {usage.dispatched_to}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                          {new Date(usage.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-900">
                          {isPGItem(item.item_name) && usage.unit?.toLowerCase() === 'nos' ? (usage.quantity / PG_BOX_SIZE).toFixed(2) : usage.quantity} <span className="text-[8px] uppercase text-slate-400">{isPGItem(item.item_name) ? 'Box' : item.unit}</span>
                        </p>
                        {usage.price > 0 && <p className="text-[8px] font-bold text-emerald-600">@ ₹{usage.price}</p>}
                      </div>
                    </div>
                  ))}
                  {item.usages.length > 5 && (
                    <p className="text-[9px] font-bold text-slate-400 text-center py-1 bg-slate-50 rounded-xl">
                      + {item.usages.length - 5} older records
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Last Dispatched</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  {item.last_dispatch_date ? new Date(item.last_dispatch_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Item Detail Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 lg:p-8">
          <div 
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-500" 
            onClick={() => setSelectedItem(null)} 
          />
          
          <div className="relative z-10 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl lg:max-w-5xl bg-white md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-500">
            
            {/* Left Column: Visual & Recap */}
            <div className="w-full md:w-[35%] lg:w-[30%] bg-slate-900 p-6 md:p-8 lg:p-10 text-white flex flex-col flex-shrink-0">
              <div className="flex items-center justify-between md:block mb-6 md:mb-8">
                <div className="flex items-center md:block gap-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-[28px] bg-emerald-500 flex items-center justify-center mb-0 md:mb-6 shadow-2xl shadow-emerald-500/20">
                    <Package className="w-6 h-6 md:w-10 md:h-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-3xl font-black tracking-tight leading-tight">{selectedItem.item_name}</h2>
                    <div className="flex items-center gap-2 mt-1 md:mt-2">
                      <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-white/5">
                        Quarry Store
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Close Icon */}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/10"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="space-y-4 md:space-y-6 flex-grow">
                 <div className={`rounded-2xl md:rounded-3xl p-4 md:p-6 border ${selectedItem.remaining_quantity < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                    <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-2 ${selectedItem.remaining_quantity < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      <Layers className="w-3 h-3" /> Live Balance
                    </p>
                    <div className="flex flex-col items-baseline">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl md:text-4xl font-black ${selectedItem.remaining_quantity < 0 ? 'text-red-400' : 'text-white'}`}>
                          {selectedItem.remaining_quantity.toFixed(1)}
                        </span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isPGItem(selectedItem.item_name) ? 'Box' : selectedItem.unit}</span>
                      </div>
                      {isPGItem(selectedItem.item_name) && (
                        <span className={`text-sm font-black ${selectedItem.remaining_quantity < 0 ? 'text-red-400/60' : 'text-emerald-400/60'}`}>
                          ({(selectedItem.remaining_quantity * PG_BOX_SIZE).toFixed(0)} nos)
                        </span>
                      )}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 flex flex-col">
                      <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Rcvd</p>
                      <p className="text-base md:text-lg font-black text-white">
                        {selectedItem.total_quantity.toFixed(1)} <span className="text-[8px] text-slate-500">{isPGItem(selectedItem.item_name) ? 'Box' : selectedItem.unit}</span>
                      </p>
                      {isPGItem(selectedItem.item_name) && <span className="text-[10px] font-bold text-slate-500">({(selectedItem.total_quantity * PG_BOX_SIZE).toFixed(0)} nos)</span>}
                    </div>
                    <div className="p-3 md:p-4 bg-orange-500/10 rounded-xl md:rounded-2xl border border-orange-500/20 flex flex-col">
                      <p className="text-[8px] md:text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Used Ops</p>
                      <p className="text-base md:text-lg font-black text-orange-300">
                        {selectedItem.consumed_quantity.toFixed(1)} <span className="text-[8px] text-orange-500/50">{isPGItem(selectedItem.item_name) ? 'Box' : selectedItem.unit}</span>
                      </p>
                      {isPGItem(selectedItem.item_name) && <span className="text-[10px] font-bold text-orange-500/40">({(selectedItem.consumed_quantity * PG_BOX_SIZE).toFixed(0)} nos)</span>}
                    </div>
                 </div>
              </div>

              <button 
                onClick={() => setSelectedItem(null)}
                className="hidden md:block mt-8 py-4 bg-white/10 hover:bg-white text-slate-400 hover:text-slate-900 rounded-2xl font-black text-xs transition-all uppercase tracking-widest border border-white/5"
              >
                Close Insights
              </button>
            </div>

            {/* Right Column: Dispatch History log */}
            <div className="flex-grow p-5 md:p-8 lg:p-12 overflow-y-auto bg-slate-50">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <History className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                    Full Dispatch History
                  </h3>
                  <div className="w-fit px-3 py-1.5 md:px-4 md:py-2 bg-emerald-50 rounded-xl flex items-center gap-2">
                     <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500" />
                     <span className="text-[8px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest">Quarry Log</span>
                  </div>
               </div>

                <div className="p-5 md:p-8 bg-slate-900 rounded-3xl md:rounded-[32px] text-white flex items-center justify-between relative overflow-hidden group mb-6 md:mb-8">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-1000" />
                   <div className="relative z-10">
                      <p className="text-[8px] md:text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1 md:mb-2">Total Dispatched Value</p>
                      <h4 className="text-2xl md:text-4xl font-black tracking-tight">
                        ₹{Math.round(selectedItem.total_value).toLocaleString()} <span className="text-[10px] md:text-xs text-slate-500 font-bold">INR</span>
                      </h4>
                   </div>
                   <div className="h-12 w-12 md:h-16 md:w-16 bg-emerald-500/20 rounded-xl md:rounded-2xl flex items-center justify-center relative z-10 backdrop-blur-md border border-emerald-500/20 shadow-lg">
                      <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
                   </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                   {/* Ledger of Receipts section */}
                   <div className="space-y-4">
                     <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                           <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600" />
                        </div>
                        <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Ledger of Receipts</h4>
                     </div>

                     {selectedItem.usages.length > 0 ? (
                       <div className="grid grid-cols-1 gap-2.5 md:gap-3 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                          {selectedItem.usages.map((usage) => (
                             <div key={usage.id} className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                <div className="flex items-center gap-3 md:gap-4">
                                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                      <User className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-emerald-500" />
                                   </div>
                                   <div>
                                      <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Received By</p>
                                      <p className="text-xs md:text-sm font-black text-slate-900">{usage.dispatched_to || 'Unknown'}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className="flex items-center justify-end gap-1 mb-0.5 md:mb-1">
                                      <span className="text-xs md:text-sm font-black text-emerald-600">
                                         +{isPGItem(selectedItem.item_name) && usage.unit?.toLowerCase() === 'nos' ? (usage.quantity / PG_BOX_SIZE).toFixed(2) : usage.quantity}
                                      </span>
                                      <span className="text-[8px] md:text-[10px] font-bold text-emerald-400 uppercase">{isPGItem(selectedItem.item_name) ? 'Box' : selectedItem.unit}</span>
                                   </div>
                                   <p className="text-[8px] md:text-[9px] font-bold text-slate-400">
                                      {new Date(usage.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                   </p>
                                </div>
                             </div>
                          ))}
                       </div>
                     ) : (
                       <div className="p-8 md:p-10 bg-white rounded-2xl md:rounded-[32px] border border-dashed border-slate-200 text-center">
                          <History className="w-6 h-6 md:w-8 md:h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">No detailed receipt history</p>
                       </div>
                     )}
                   </div>

                   {/* Operation Usage section */}
                   {selectedItem.used_history.length > 0 && (
                     <div className="space-y-4 pt-4 md:pt-6 border-t border-slate-200">
                       <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                             <Flame className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                          </div>
                          <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Operation Usage Log</h4>
                       </div>

                       <div className="grid grid-cols-1 gap-2.5 md:gap-3 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                          {selectedItem.used_history.map((record) => (
                             <div key={record.id} className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-orange-500/30 transition-all">
                                <div className="flex items-center gap-3 md:gap-4">
                                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                                      <Settings className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-orange-500" />
                                   </div>
                                   <div>
                                      <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Process</p>
                                      <p className="text-xs md:text-sm font-black text-slate-900">{record.operation_type}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className="flex items-center justify-end gap-1 mb-0.5 md:mb-1">
                                      <span className="text-xs md:text-sm font-black text-orange-600">
                                         -{isPGItem(selectedItem.item_name) && record.unit?.toLowerCase() === 'nos' ? (record.quantity / PG_BOX_SIZE).toFixed(2) : record.quantity.toFixed(1)}
                                      </span>
                                      <span className="text-[8px] md:text-[10px] font-bold text-orange-400 uppercase">{isPGItem(selectedItem.item_name) ? 'Box' : selectedItem.unit}</span>
                                   </div>
                                   <p className="text-[8px] md:text-[9px] font-bold text-slate-400">
                                      {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                   </p>
                                </div>
                             </div>
                          ))}
                       </div>
                     </div>
                   )}
                </div>
            </div>

            {/* Desktop Close Icon */}
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-6 right-6 hidden md:flex h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-white/10 backdrop-blur-md text-white items-center justify-center hover:bg-white hover:text-slate-900 transition-all z-[110]"
            >
              <X className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
