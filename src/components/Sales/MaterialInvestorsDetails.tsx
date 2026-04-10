import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User, Phone, Calendar, Mail, FileText, AlertCircle, TrendingUp, Filter, Pencil, Trash2, Weight, Sliders, Plus, Settings, Check } from 'lucide-react';
import { format } from 'date-fns';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'closed'>('all');

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('material_investors')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
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
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove this record?`)) return;

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
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm border-b border-slate-100 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-800">Items</h1>
          <div className="flex items-center gap-4">
            <Search className="w-6 h-6 text-indigo-800" />
            <Settings className="w-6 h-6 text-indigo-800" />
          </div>
        </div>
        
        {/* Search Bar (Optional but nice for mobile ERP feel) */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-600 transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-black whitespace-nowrap">Low Stock</button>
          <div className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-black whitespace-nowrap flex items-center gap-1">
            Select Category <ChevronDown className="w-3 h-3" />
          </div>
          <div className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-black whitespace-nowrap flex items-center gap-1">
            Filter By <Filter className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main Content (Card List) */}
      <div className="flex-1 p-4 pb-32 space-y-3 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-bold text-sm tracking-widest">Loading...</p>
          </div>
        ) : investors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">No records found</p>
          </div>
        ) : (
          investors.map((investor) => (
            <div
              key={investor.id}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative group active:scale-[0.98] transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  {/* Avatar/Initial Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xl shadow-inner border border-slate-50">
                    {investor.product_type?.charAt(0).toUpperCase() || '?'}
                  </div>
                  
                  {/* Name and Prices */}
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-tight mb-3 capitalize">
                      {investor.product_type || 'Untitled Product'}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sales Price</p>
                        <p className="text-sm font-black text-indigo-900">₹ {investor.sales_price?.toLocaleString('en-IN') || '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Purchase Price</p>
                        <p className="text-sm font-black text-indigo-900">₹ {investor.rate_per_mt?.toLocaleString('en-IN') || '0'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Info (Top Right) */}
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 leading-none">
                    {investor.quantity_mt?.toFixed(1) || '0.0'}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">MTON</p>
                </div>
              </div>

              {/* Action Icons (Bottom Right) */}
              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                <button 
                  onClick={() => onEdit?.(investor)}
                  className="p-2 text-indigo-400 hover:text-indigo-600 border border-slate-50 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(investor.id, investor.product_type)}
                  className="p-2 text-slate-300 hover:text-red-500 border border-slate-50 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="p-2 text-indigo-800">
                  <Sliders className="w-6 h-6" />
                </div>
              </div>

              {/* Status Indicator Pill */}
              <div className={`absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${
                investor.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}>
                {investor.status}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 w-full flex justify-center px-6 gap-4 z-40">
        <button
          onClick={onAddNew}
          className="flex-1 max-w-sm flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white font-black text-sm uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-indigo-200 active:scale-95 transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          Create New Item
        </button>
        
        <button className="flex-0 p-4 bg-slate-800 text-white rounded-[1.5rem] shadow-xl flex items-center gap-2">
          <FileText className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">Bulk Action</span>
        </button>
      </div>
    </div>
  );
}

function ChevronDown(props: any) {
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
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}
