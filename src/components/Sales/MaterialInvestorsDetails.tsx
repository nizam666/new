import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, FileText, Filter, Pencil, Trash2, Sliders, Plus, Settings, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

interface Investor {
  id: string;
  investor_name: string;
  contact_number: string;
  email: string | null;
  quantity_mt: number;
  rate_per_mt: number;
  sales_price: number;
  gst_amount: number;
  total_amount_with_gst: number;
  product_type: string;
  quality_grade: string;
  investment_date: string;
  status: 'active' | 'inactive' | 'closed';
  notes: string | null;
  created_at: string;
}

interface MaterialInvestorsDetailsProps {
  onEdit?: (investor: Investor) => void;
  onAddNew?: () => void;
}

export function MaterialInvestorsDetails({ onEdit, onAddNew }: MaterialInvestorsDetailsProps) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_investors')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      let filtered = data || [];
      if (searchTerm) {
        filtered = filtered.filter(inv => 
          inv.product_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.investor_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      setInvestors(filtered);
    } catch (error) {
      console.error('Error fetching investors:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this record?')) return;

    try {
      const { error } = await supabase
        .from('material_investors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Record removed');
      fetchInvestors();
    } catch (error) {
      toast.error('Error removing record');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative animate-in fade-in duration-500">
      {/* Header Container - Max Width for Desktop */}
      <div className="bg-white p-6 shadow-sm border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-indigo-950 tracking-tight">Material Inventory</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Manage stocks and partners</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative group flex-1 md:w-80">
                <input
                  type="text"
                  placeholder="Search products or partners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 focus:bg-white transition-all outline-none"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <button className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-lg shadow-indigo-100/50">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Sub-Header / Filters - Wide Spacing */}
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-50 pt-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Filters:</span>
            <button className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all">Low Stock</button>
            <div className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-100 group transition-all">
              Category <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
            </div>
            <div className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-200 active:scale-95 transition-all">
              Filter By <Filter className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content (Responsive Card Grid) */}
      <div className="max-w-7xl mx-auto w-full p-8 lg:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">Syncing Database...</p>
          </div>
        ) : investors.length === 0 ? (
          <div className="text-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Inventory is Empty</h3>
            <p className="text-sm text-slate-400 font-medium">Start by adding your first product or investment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
            {investors.map((investor) => (
              <div
                key={investor.id}
                className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-xl shadow-slate-200/40 relative group hover:shadow-2xl hover:shadow-indigo-900/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-8">
                    {/* Visual Icon */}
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center font-black text-indigo-400 text-3xl shadow-inner border border-white transition-transform group-hover:rotate-6">
                      {investor.product_type?.charAt(0).toUpperCase() || '?'}
                    </div>
                    
                    {/* Status Pill */}
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                      investor.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {investor.status}
                    </span>
                  </div>
                  
                  {/* Name and Partner */}
                  <div className="mb-8">
                    <h3 className="text-xl font-black text-indigo-950 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                      {investor.product_type || 'Untitled Item'}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                      <Plus className="w-3 h-3" />
                      {investor.investor_name || 'No Partner'}
                    </div>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Stock Level</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-800">{investor.quantity_mt?.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-indigo-400 uppercase">MT</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Sales Rate</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-slate-400 italic">₹</span>
                        <span className="text-xl font-black text-slate-800">{investor.sales_price?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Overlay (Visible on Hover Laptop) */}
                  <div className="absolute top-8 right-8 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit?.(investor); }}
                      className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(investor.id); }}
                      className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all">
                      <Sliders className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responsive Floating Action Button (FAB) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-7xl flex justify-center px-8 gap-4 z-40">
        <button
          onClick={onAddNew}
          className="flex-1 md:flex-none md:px-12 flex items-center justify-center gap-4 py-5 bg-indigo-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-[2.5rem] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:rotate-180">
            <Plus className="w-5 h-5" />
          </div>
          Create New Item
        </button>
        
        <button className="hidden md:flex p-5 bg-indigo-950 text-white rounded-[2.5rem] shadow-xl hover:bg-black transition-all items-center gap-3">
          <FileText className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Bulk Actions</span>
        </button>
      </div>
    </div>
  );
}
