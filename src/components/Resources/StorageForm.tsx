import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Package, 
  MapPin, 
  Search, 
  Filter, 
  ChevronRight,
  Layers,
  Archive,
  DollarSign,
  X,
  Calendar,
  User,
  CreditCard,
  FileText,
  Activity,
  HardDrive,
  Info,
  Truck,
  ArrowUpRight
} from 'lucide-react';

interface InventoryItem {
  id: string;
  item_name: string;
  item_code: string;
  category: string;
  quantity: number;
  average_price: number;
  unit: string;
  location: string;
  last_restock_date: string;
}

interface DispatchRecord {
  id: string;
  dispatch_ref: string;
  dispatched_to: string;
  quantity_dispatched: number;
  unit: string;
  dispatch_date: string;
}

interface PurchaseDetail {
  vendorName: string;
  purchaseDate: string;
  invoiceNumber: string;
  ratePerUnit: string;
  billTotal: number;
  loading: boolean;
  recentDispatches: DispatchRecord[];
}

function BoxIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function StorageForm() {
  const [fetching, setFetching] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  
  // Detail Modal States
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetail | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setFetching(false);
    }
  };

  const fetchItemDetails = async (item: InventoryItem) => {
    setSelectedItem(item);
    setPurchaseDetail({
      vendorName: 'Searching...',
      purchaseDate: item.last_restock_date || 'N/A',
      invoiceNumber: 'Fetching...',
      ratePerUnit: 'N/A',
      billTotal: 0,
      loading: true,
      recentDispatches: []
    });

    try {
      const { data: trans, error: tError } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('item_id', item.id)
        .eq('transaction_type', 'in')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tError) throw tError;

      if (trans) {
        const invoiceRef = trans.purpose?.replace('Purchase Ref: ', '') || 'N/A';
        const rateMatch = trans.notes?.match(/Rate: ([\d.]+)/);
        const rate = rateMatch ? `₹${rateMatch[1]}` : 'N/A';

        const { data: account, error: aError } = await supabase
          .from('accounts')
          .select('*')
          .eq('invoice_number', invoiceRef)
          .maybeSingle();

        if (aError) console.error('Account fetch error:', aError);

        setPurchaseDetail({
          vendorName: account?.customer_name || 'Direct Procurement',
          purchaseDate: account?.transaction_date || trans.date || item.last_restock_date || '',
          invoiceNumber: invoiceRef,
          ratePerUnit: rate,
          billTotal: account?.amount || 0,
          loading: false,
          recentDispatches: []
        });
      } else {
        setPurchaseDetail({
          vendorName: 'Direct Entry',
          purchaseDate: item.last_restock_date || 'N/A',
          invoiceNumber: 'Manual Record',
          ratePerUnit: 'N/A',
          billTotal: 0,
          loading: false,
          recentDispatches: []
        });
      }

      // Fetch Recent Dispatches
      const { data: dispatches, error: dError } = await supabase
        .from('inventory_dispatch')
        .select('id, dispatch_ref, dispatched_to, quantity_dispatched, unit, dispatch_date')
        .eq('item_id', item.id)
        .order('dispatch_date', { ascending: false })
        .limit(5);

      if (!dError && dispatches) {
        setPurchaseDetail(prev => prev ? { ...prev, recentDispatches: dispatches } : null);
      }
    } catch (err) {
      console.error('Error fetching deep details:', err);
      setPurchaseDetail(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.item_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
    return matchesSearch && matchesLocation;
  });

  const locations = Array.from(new Set(inventoryItems.map(item => item.location).filter(Boolean)));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <Archive className="w-6 h-6 text-emerald-600" />
              Stored Inventory Items
            </h3>
            <p className="text-slate-500 font-medium">Tracking physical items across storage locations</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 font-bold text-sm min-w-[280px] shadow-sm transition-all"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 font-bold text-sm appearance-none cursor-pointer shadow-sm transition-all"
              >
                <option value="all">All Locations</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
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
              <BoxIcon className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-900 font-black text-xl">No items found</p>
            <p className="text-slate-400 font-medium">Try adjusting your filters or adding new items via Procurement</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => fetchItemDetails(item)}
                className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group cursor-pointer active:scale-95"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:bg-emerald-600 transition-colors">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight">{item.item_name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.item_code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Layers className="w-3 h-3" />
                       Quantity
                    </p>
                    <p className="text-xl font-black text-slate-900 tracking-tight">
                      {item.quantity} <span className="text-[10px] uppercase text-slate-400">{item.unit}</span>
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50/50 rounded-2xl space-y-1 border border-blue-50">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                       <DollarSign className="w-3 h-3" />
                       Avg Price
                    </p>
                    <p className="text-lg font-black text-blue-900 tracking-tight">
                      ₹{Math.round(item.average_price || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-4 bg-emerald-50/50 rounded-2xl space-y-1 border border-emerald-50">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                       <MapPin className="w-3 h-3" />
                       Location
                    </p>
                    <p className="text-lg font-black text-teal-900 tracking-tight truncate">
                      {item.location || 'Unassigned'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">In Stock</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300">
                    Last arrival: {item.last_restock_date ? new Date(item.last_restock_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Item Detail Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" 
            onClick={() => setSelectedItem(null)} 
          />
          
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-[48px] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-500 max-h-[90vh]">
            
            {/* Left Column: Visual & Stock Recap */}
            <div className="md:w-1/3 bg-slate-950 p-8 text-white flex flex-col overflow-y-auto">
              <div className="mb-8">
                <div className="w-20 h-20 rounded-[28px] bg-emerald-500 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20">
                  <Package className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black tracking-tight leading-tight">{selectedItem.item_name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-white/5">
                    {selectedItem.category}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{selectedItem.item_code}</span>
                </div>
              </div>

              <div className="space-y-6 flex-grow">
                 <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <HardDrive className="w-3 h-3" /> Current Stock
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-white">{selectedItem.quantity}</span>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{selectedItem.unit}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Storage Location</p>
                        <p className="text-sm font-bold text-white uppercase">{selectedItem.location || 'Not Set'}</p>
                      </div>
                    </div>
                 </div>
              </div>

              <button 
                onClick={() => setSelectedItem(null)}
                className="mt-8 py-4 bg-white/10 hover:bg-white text-slate-400 hover:text-slate-900 rounded-2xl font-black text-xs transition-all uppercase tracking-widest border border-white/5"
              >
                Close Insights
              </button>
            </div>

            {/* Right Column: Procurement History & Details */}
            <div className="flex-grow p-8 md:p-12 overflow-y-auto bg-slate-50">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Activity className="w-6 h-6 text-emerald-600" />
                    Procurement Insights
                  </h3>
                  <div className="px-4 py-2 bg-emerald-50 rounded-xl flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Active Stock Item</span>
                  </div>
               </div>

               {purchaseDetail?.loading ? (
                 <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Linking Procurement History...</p>
                 </div>
               ) : (
                 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                             <User className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preferred Vendor</p>
                             <p className="text-lg font-black text-slate-900 leading-tight">{purchaseDetail?.vendorName}</p>
                          </div>
                       </div>

                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                             <Calendar className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date of Purchase</p>
                             <p className="text-lg font-black text-slate-900">
                               {purchaseDetail?.purchaseDate ? new Date(purchaseDetail.purchaseDate).toLocaleDateString('en-IN', {
                                 day: 'numeric',
                                 month: 'long',
                                 year: 'numeric'
                               }) : 'N/A'}
                             </p>
                          </div>
                       </div>

                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                             <FileText className="w-5 h-5 text-cyan-500" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bill Reference Number</p>
                             <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{purchaseDetail?.invoiceNumber}</p>
                          </div>
                       </div>

                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                             <DollarSign className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate per Unit</p>
                             <p className="text-lg font-black text-emerald-600 font-mono">{purchaseDetail?.ratePerUnit}</p>
                          </div>
                       </div>
                    </div>

                    <div className="p-8 bg-slate-900 rounded-[32px] text-white flex items-center justify-between relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-1000" />
                       <div className="relative z-10">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">Total Purchase Value</p>
                          <h4 className="text-4xl font-black tracking-tight">
                            ₹{(purchaseDetail?.billTotal || 0).toLocaleString()} <span className="text-xs text-slate-500 font-bold">INR</span>
                          </h4>
                       </div>
                       <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center relative z-10 backdrop-blur-md border border-white/10 shadow-lg">
                          <CreditCard className="w-8 h-8 text-emerald-400" />
                       </div>
                    </div>

                    {/* Recent Dispatch History Section */}
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                             <Truck className="w-4 h-4 text-emerald-600" />
                          </div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Dispatch History</h4>
                       </div>

                       {purchaseDetail?.recentDispatches && purchaseDetail.recentDispatches.length > 0 ? (
                         <div className="grid grid-cols-1 gap-3">
                            {purchaseDetail.recentDispatches.map((dispatch) => (
                               <div key={dispatch.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                        <User className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                                     </div>
                                     <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Issued To</p>
                                        <p className="text-sm font-black text-slate-900">{dispatch.dispatched_to}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                           Ref: {dispatch.dispatch_ref}
                                        </p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Quantity</p>
                                     <div className="flex items-center justify-end gap-1">
                                        <span className="text-sm font-black text-slate-900">{dispatch.quantity_dispatched}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{dispatch.unit}</span>
                                     </div>
                                     <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                        {new Date(dispatch.dispatch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                     </p>
                                  </div>
                               </div>
                            ))}
                         </div>
                       ) : (
                         <div className="p-10 bg-slate-50 rounded-[32px] border border-dashed border-slate-200 text-center">
                            <ArrowUpRight className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Recent Dispatches</p>
                         </div>
                       )}
                    </div>

                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                       <div className="shrink-0">
                        <Info className="w-6 h-6 text-amber-500" />
                       </div>
                       <p className="text-xs font-medium text-amber-800 leading-relaxed">
                         These details represent the <strong>latest acquisition</strong> and <strong>usage patterns</strong> for this item.
                       </p>
                    </div>
                 </div>
               )}
            </div>

            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white hover:text-slate-900 transition-all z-[110] md:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
