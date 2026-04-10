import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User, IndianRupee, Phone, Calendar, Mail, FileText, AlertCircle, TrendingUp, Filter, Pencil, Trash2, Weight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

interface Investor {
  id: string;
  investor_name: string;
  contact_number: string;
  email: string | null;
  quantity_mt: number;
  rate_per_mt: number;
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
}

export function MaterialInvestorsDetails({ onEdit }: MaterialInvestorsDetailsProps) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'closed'>('all');
  const [totals, setTotals] = useState({
    investment: 0,
    tonnage: 0,
    activeCount: 0
  });

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

      if (searchTerm) {
        query = query.or(`investor_name.ilike.%${searchTerm}%,product_type.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvestors(data || []);

      const calculated = (data || []).reduce((acc, inv) => {
        acc.investment += (inv.total_amount_with_gst || 0);
        acc.tonnage += (inv.quantity_mt || 0);
        if (inv.status === 'active') acc.activeCount++;
        return acc;
      }, { investment: 0, tonnage: 0, activeCount: 0 });

      setTotals(calculated);
    } catch (error) {
      console.error('Error fetching investors:', error);
      toast.error('Failed to load investors');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove investor "${name}"? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('material_investors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Investor removed successfully');
      fetchInvestors();
    } catch (error) {
      toast.error('Error removing investor');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'closed': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Investment (Incl. GST)</p>
            <p className="text-xl font-black text-slate-900">₹{totals.investment.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Weight className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total MT Invested</p>
            <p className="text-xl font-black text-slate-900">{totals.tonnage.toLocaleString()} MT</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Partners</p>
            <p className="text-xl font-black text-slate-900">{totals.activeCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search investors, products, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-slate-50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border-2 border-slate-50 bg-white rounded-xl px-4 py-2 font-medium focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed / Settled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Investor</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Product & Grade</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (MT)</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate & Tax</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Investment</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th scope="col" className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-bold text-slate-400">Loading inventory data...</p>
                    </div>
                  </td>
                </tr>
              ) : investors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-bold">No records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                investors.map((investor) => (
                  <tr key={investor.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-sm">
                          {investor.investor_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{investor.investor_name}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Phone className="w-3 h-3" />{investor.contact_number}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{investor.product_type}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{investor.quality_grade}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-slate-900">{investor.quantity_mt.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MT</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold text-slate-400">₹</span>
                          <span className="text-sm font-bold text-slate-700">{investor.rate_per_mt.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] font-black text-slate-400 tracking-tighter">/ MT</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-500">GST: ₹{investor.gst_amount?.toLocaleString('en-IN')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-slate-400">₹</span>
                        <span className="text-sm font-black text-slate-900">{(investor.total_amount_with_gst || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${getStatusColor(investor.status)}`}>
                        {investor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit?.(investor)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(investor.id, investor.investor_name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="flex items-center gap-2 px-6 py-4 bg-blue-50 rounded-2xl border border-blue-100">
        <AlertCircle className="w-4 h-4 text-blue-500" />
        <p className="text-xs font-bold text-blue-700 tracking-tight">
          Calculations are based on a standard 5% GST rate as per investor inventory guidelines.
        </p>
      </div>
    </div>
  );
}
