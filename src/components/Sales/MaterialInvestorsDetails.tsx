import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, FileText, Filter, Pencil, Trash2, Plus, Settings, ChevronDown } from 'lucide-react';
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
  material_type?: string; // Legacy column
  quality_grade: string;
  hsn?: string; // Standard column
  investment_amount?: number; // Legacy column
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
          (inv.product_type || inv.material_type || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="bg-white p-4 md:p-6 shadow-sm border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-4 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tight">Price Master</h1>
              <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Manage rates and material standards</p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative group flex-1 md:w-80">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 focus:bg-white transition-all outline-none"
                />
                <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              
              <button 
                onClick={onAddNew}
                className="hidden md:flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add New Product
              </button>

              <button className="p-2.5 md:p-3.5 bg-slate-50 text-slate-400 rounded-xl md:rounded-2xl border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95">
                <Settings className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>
          
          {/* Sub-Header / Filters - Wide Spacing */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4 md:pt-6">
            <span className="hidden sm:inline text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters:</span>
            <button className="px-3 md:px-5 py-2 md:py-2.5 bg-slate-50 text-slate-500 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all">Latest</button>
            <div className="px-3 md:px-5 py-2 md:py-2.5 bg-slate-50 text-slate-500 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest border border-slate-100 flex items-center gap-2 cursor-pointer hover:bg-slate-100 group transition-all">
              Tax <ChevronDown className="w-3 md:w-4 h-3 md:h-4 text-slate-300 group-hover:text-indigo-600" />
            </div>
            <div className="px-3 md:px-5 py-2 md:py-2.5 bg-indigo-600 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-200 active:scale-95 transition-all ml-auto md:ml-0">
              Filter <Filter className="w-3 md:w-4 h-3 md:h-4" />
            </div>

            {/* Mobile Add Button */}
            <button 
              onClick={onAddNew}
              className="md:hidden flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Main Content (Responsive Card Grid) */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8 lg:p-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 md:py-40 gap-6">
            <div className="w-10 md:w-12 h-10 md:h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-black text-[10px] md:text-xs uppercase tracking-[0.3em]">Syncing Database...</p>
          </div>
        ) : investors.length === 0 ? (
          <div className="text-center py-20 md:py-40 bg-white rounded-3xl md:rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
            <div className="w-16 md:w-24 h-16 md:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 md:w-10 h-8 md:h-10 text-slate-200" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-2">No Products</h3>
            <p className="text-xs md:text-sm text-slate-400 font-medium">Start by adding your first material rate</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 pb-12">
            {investors.map((investor) => (
              <div
                key={investor.id}
                className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 border border-slate-50 shadow-xl shadow-slate-200/40 relative group hover:shadow-2xl hover:shadow-indigo-900/10 md:hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4 md:mb-8">
                    {/* Visual Icon */}
                    <div className="w-16 md:w-20 h-16 md:h-20 rounded-2xl md:rounded-3xl bg-indigo-50 flex items-center justify-center font-black text-indigo-400 text-2xl md:text-3xl shadow-inner border border-white transition-transform group-hover:rotate-6">
                      {(investor.product_type || investor.material_type || '').charAt(0).toUpperCase() || '?'}
                    </div>
                    
                    {/* Status Pill */}
                    <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                      investor.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {investor.status}
                    </span>
                  </div>
                  
                  {/* Name and HSN */}
                  <div className="mb-4 md:mb-8">
                    <h3 className="text-lg md:text-xl font-black text-indigo-950 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                      {investor.product_type || investor.material_type || 'Untitled Item'}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                      HSN: {investor.hsn || investor.quality_grade || '2517 (Std)'}
                    </div>
                  </div>

                  {/* Pricing Row */}
                  <div className="mt-auto pt-4 md:pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Unit</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">MT</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Rate (Ex-Tax)</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs md:text-sm font-black text-indigo-600 italic">₹</span>
                        <span className="text-xl md:text-2xl font-black text-slate-800">{(investor.sales_price || investor.investment_amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Overlay (Always visible on mobile, Hover on desktop) */}
                  <div className="absolute top-4 md:top-8 right-4 md:right-8 flex flex-col gap-2 md:opacity-0 group-hover:opacity-100 transition-all md:translate-x-4 md:group-hover:translate-x-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit?.(investor); }}
                      className="w-8 h-8 md:w-10 md:h-10 bg-white shadow-xl rounded-lg md:rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border border-indigo-50"
                    >
                      <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(investor.id); }}
                      className="w-8 h-8 md:w-10 md:h-10 bg-white shadow-xl rounded-lg md:rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
