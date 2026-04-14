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
  DollarSign
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

export function StorageForm() {
  const [fetching, setFetching] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');

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
              <Box className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-900 font-black text-xl">No items found</p>
            <p className="text-slate-400 font-medium">Try adjusting your filters or adding new items via Procurement</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group"
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
    </div>
  );
}

function Box(props: any) {
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
