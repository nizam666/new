import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Search, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  ArrowLeft,
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface Contractor {
  id: string;
  employee_id?: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  salary?: number;
}

export function CrusherContractorReport() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load contractors (only Crusher related ones)
  useEffect(() => {
    const loadContractors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .or('role.eq.contractor,employee_id.ilike.CON-%')
          .order('full_name');
        
        if (error) throw error;
        
        // Filter ONLY for Crusher contractors (CON-CRU-)
        const crusherContractors = (data || []).filter(c => 
          c.employee_id?.startsWith('CON-CRU-')
        );
        
        console.log('Found crusher contractors:', crusherContractors.length);
        setContractors(crusherContractors);
      } catch (err) {
        console.error('Error loading contractors:', err);
      } finally {
        setLoading(false);
      }
    };
    loadContractors();
  }, []);

  const fetchHistory = useCallback(async (contractor: Contractor) => {
    setLoadingTransactions(true);
    setSelectedMonth('all');
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('customer_name', contractor.full_name)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedContractor) {
      fetchHistory(selectedContractor);
    }
  }, [selectedContractor, fetchHistory]);

  const availableMonths = Array.from(new Set(
    transactions
      .filter(t => t.transaction_type === 'expense' || t.transaction_type === 'contractor_bill')
      .map(t => new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }))
  )).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

  const totals = (() => {
    let advance = 0;
    let payment = 0;
    let bill = 0;
    
    transactions.forEach(t => {
      const m = new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      if (selectedMonth !== 'all' && m !== selectedMonth) return;
      
      if (t.transaction_type === 'contractor_bill') {
        bill += (t.amount || 0);
      } else if (t.transaction_type === 'expense') {
        const isAdvance = (() => {
          if (t.notes) {
            const parts = t.notes.split(' | ');
            const itemPart = parts.find((p: string) => p.startsWith('Item: '));
            if (itemPart) {
              const itemValue = itemPart.replace('Item: ', '').toLowerCase();
              if (itemValue.includes('payment')) return false;
              if (itemValue.includes('advance')) return true;
            }
          }
          return t.reason?.toLowerCase().includes('advance') || 
                 t.notes?.toLowerCase().includes('advance');
        })();
        
        const amount = t.amount_given || t.amount || 0;
        if (isAdvance) advance += amount;
        else payment += amount;
      }
    });
    
    return { advance, payment, bill };
  })();

  const filteredContractors = contractors.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.employee_id && c.employee_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-8 border-2 border-slate-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <TrendingUp className="w-32 h-32 text-indigo-600" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Crusher Contractor Report</h2>
              </div>
              <p className="text-slate-500 font-medium">Consolidated payment history and balance tracking</p>
            </div>
            
            {selectedContractor && (
              <button
                onClick={() => setSelectedContractor(null)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                Switch Contractor
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedContractor ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Search and Filters */}
          <div className="col-span-full bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search crusher contractors..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-2 border-slate-100 rounded-2xl text-base font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none bg-slate-50/50"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest">
              <Users className="w-4 h-4" />
              {filteredContractors.length} Contractors
            </div>
          </div>

          {filteredContractors.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedContractor(c)}
              className="group bg-white p-6 rounded-[32px] border-2 border-slate-100 hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-600/10 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform opacity-0 group-hover:opacity-100">
                <ArrowUpRight className="w-8 h-8 text-indigo-600" />
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                  {c.full_name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight">{c.full_name}</h4>
                  <p className="text-xs font-bold text-slate-400 font-mono mt-1">{c.employee_id || 'GENERAL'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-400">Fixed Pay</p>
                  <p className="text-sm font-black text-slate-900">₹{c.salary?.toLocaleString('en-IN') || '0'}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-400">Function</p>
                  <p className="text-sm font-black text-slate-900">
                    {c.employee_id?.startsWith('CON-CRU-') ? 'Crusher' : 
                     c.employee_id?.startsWith('CON-QRY-') ? 'Quarry' :
                     c.employee_id?.startsWith('CON-ELE-') ? 'Electrical' :
                     c.employee_id?.startsWith('CON-MAN-') ? 'Manpower' : 'General'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Report Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-[32px] border-2 border-slate-100 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Period</p>
                </div>
              </div>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none focus:border-indigo-600 transition-all cursor-pointer"
              >
                <option value="all">All Time</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Fixed/Target Pay</p>
              </div>
              <p className="text-2xl font-black">
                ₹{(selectedContractor.salary || 0).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-emerald-600 p-6 rounded-[32px] text-white shadow-xl shadow-emerald-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Actual Bill (Net)</p>
              </div>
              <p className="text-2xl font-black">₹{totals.bill.toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-amber-500 p-6 rounded-[32px] text-white shadow-xl shadow-amber-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <MinusCircle className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Advance Taken</p>
              </div>
              <p className="text-2xl font-black">₹{totals.advance.toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-blue-600 p-6 rounded-[32px] text-white shadow-xl shadow-blue-600/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Current Balance</p>
              </div>
              <p className="text-2xl font-black">
                ₹{(totals.bill - totals.advance).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b-2 border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Ledger / History</h4>
              </div>
              {selectedMonth !== 'all' && (
                <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest">
                  Showing {selectedMonth}
                </div>
              )}
            </div>

            {loadingTransactions ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="font-bold">Fetching ledger records...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-20 text-center">
                <DollarSign className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">No financial records found for this contractor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Category</th>
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Reference / Purpose</th>
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Debit (Adv/Pay)</th>
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Credit (Bill)</th>
                      <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions
                      .filter(t => {
                        if (selectedMonth === 'all') return true;
                        const m = new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                        return m === selectedMonth;
                      })
                      .map(t => {
                        const isBill = t.transaction_type === 'contractor_bill';
                        const amount = t.amount_given || t.amount || 0;
                        const isAdvance = !isBill && (() => {
                          if (t.notes) {
                            const parts = t.notes.split(' | ');
                            const itemPart = parts.find((p: string) => p.startsWith('Item: '));
                            if (itemPart) return itemPart.replace('Item: ', '').toLowerCase().includes('advance');
                          }
                          return t.reason?.toLowerCase().includes('advance') || t.notes?.toLowerCase().includes('advance');
                        })();

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-6 text-sm font-black text-slate-900 font-mono">
                              {new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="p-6">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                                isBill ? 'bg-indigo-100 text-indigo-700' : 
                                isAdvance ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isBill ? 'Monthly Bill' : isAdvance ? 'Advance' : 'Payment'}
                              </span>
                            </td>
                            <td className="p-6 text-sm font-bold text-slate-600">
                              {t.reason || t.notes || '—'}
                            </td>
                            <td className="p-6 text-sm font-black text-red-600 text-right">
                              {!isBill ? `₹${amount.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="p-6 text-sm font-black text-emerald-600 text-right">
                              {isBill ? `₹${amount.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="p-6">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {t.payment_method?.replace(/_/g, ' ') || '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper icons
function MinusCircle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
    </svg>
  );
}
