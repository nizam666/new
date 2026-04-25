import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { 
  FileText,
  Search, 
  Download
} from 'lucide-react';

interface Account {
  id: string;
  transaction_type: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  amount_given: number;
  balance: number;
  reason: string;
  transaction_date: string;
  payment_method: string;
  status: string;
  category: string;
  notes: string;
  created_at: string;
}

export function AccountsDetails() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseNotes = (notes: string) => {
    if (!notes) return { company: '—', remarks: '—', payedBy: '', projectItem: '' };
    
    const parts = notes.split(' | ');
    let company = '—';
    let remarks = '—';
    let payedBy = '';
    let projectItem = '';
    
    parts.forEach(part => {
      if (part.startsWith('Company: ')) company = part.replace('Company: ', '');
      else if (part.startsWith('Payed By: ')) payedBy = part.replace('Payed By: ', '');
      else if (part.startsWith('Item: ')) projectItem = part.replace('Item: ', '');
      else if (!part.startsWith('Dept: ')) remarks = part; 
    });
    
    return { company, remarks, payedBy, projectItem };
  };

  const exportToExcel = () => {
    const dataToExport = filteredAccounts.map(account => {
      const { company, remarks, payedBy } = parseNotes(account.notes);
      const isAdvance = (() => {
        if (account.notes) {
          const parts = account.notes.split(' | ');
          const itemPart = parts.find((p: string) => p.startsWith('Item: '));
          if (itemPart) {
            const itemValue = itemPart.replace('Item: ', '').toLowerCase();
            if (itemValue.includes('payment')) return false;
            if (itemValue.includes('advance')) return true;
          }
        }
        return account.reason?.toLowerCase().includes('advance') || 
               account.notes?.toLowerCase().includes('advance');
      })();
      return {
        'Date': new Date(account.transaction_date).toLocaleDateString(),
        'Transaction': account.transaction_type.toUpperCase(),
        'Type': isAdvance ? 'ADVANCE' : 'PAYMENT',
        'Details': account.reason,
        'Company': company,
        'Pay Towards': account.customer_name || '—',
        'Amount': account.amount_given,
        'Payed From': account.payment_method?.replace(/_/g, ' ').toUpperCase() + (payedBy ? ` (BY: ${payedBy})` : ''),
        'Remarks': remarks
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Ledger');
    
    // Auto-size columns
    const wscols = [
      {wch: 12}, // Date
      {wch: 12}, // Transaction
      {wch: 40}, // Details
      {wch: 10}, // Company
      {wch: 25}, // Pay Towards
      {wch: 15}, // Amount
      {wch: 30}, // Payed From
      {wch: 40}  // Remarks
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Financial_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredAccounts = accounts
    .filter(account => {
      if (filter === 'all') return true;
      return account.status === filter;
    })
    .filter(account => {
      if (typeFilter === 'all') return true;
      return account.transaction_type === typeFilter;
    })
    .filter(account => {
      if (!searchTerm) return true;
      return (
        account.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[32px] border border-slate-100">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Hydrating Ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ── Filter Bar ── */}
      <div className="bg-white p-4 md:p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search ledger records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-400 text-sm"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 lg:w-40 px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all font-black text-[10px] uppercase tracking-widest text-slate-600 outline-none"
          >
            <option value="all">All Types</option>
            <option value="income">Inflow</option>
            <option value="expense">Outflow</option>
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 lg:w-40 px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all font-black text-[10px] uppercase tracking-widest text-slate-600 outline-none"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
          
          <button 
            onClick={exportToExcel}
            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200 active:scale-95 group relative"
            title="Download Excel Ledger"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Ledger Table ── */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Transaction</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Type</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Company</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Pay Towards</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Amount</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Payed From</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAccounts.map((account) => {
                const { company, remarks, payedBy } = parseNotes(account.notes);
                return (
                  <tr key={account.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-6 whitespace-nowrap">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(account.transaction_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-6">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                        account.transaction_type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                      }`}>
                        {account.transaction_type === 'income' ? 'Inflow' : 'Outflow'}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      {(() => {
                        const isAdvance = (() => {
                          if (account.notes) {
                            const parts = account.notes.split(' | ');
                            const itemPart = parts.find((p: string) => p.startsWith('Item: '));
                            if (itemPart) {
                              const itemValue = itemPart.replace('Item: ', '').toLowerCase();
                              if (itemValue.includes('payment')) return false;
                              if (itemValue.includes('advance')) return true;
                            }
                          }
                          return account.reason?.toLowerCase().includes('advance') || 
                                 account.notes?.toLowerCase().includes('advance');
                        })();
                        return (
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${
                            isAdvance ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                          }`}>
                            {isAdvance ? 'Advance' : 'Payment'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-6 min-w-[200px]">
                      <p className="text-xs font-bold text-slate-600 leading-relaxed">{account.reason}</p>
                    </td>
                    <td className="px-6 py-6">
                      <p className="text-xs font-black text-slate-900 tracking-tighter">{company}</p>
                    </td>
                    <td className="px-6 py-6">
                      <p className="text-sm font-black text-slate-900">{account.customer_name || '—'}</p>
                    </td>
                    <td className="px-6 py-6 text-right whitespace-nowrap">
                      <p className={`text-sm font-black ${account.transaction_type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {account.transaction_type === 'income' ? '+' : '-'} ₹{account.amount_given.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          {account.payment_method?.replace(/_/g, ' ') || '—'}
                        </span>
                        {payedBy && (
                          <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">
                            By: {payedBy}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 min-w-[150px]">
                      <p className="text-xs text-slate-400 font-medium italic">{remarks}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredAccounts.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-900 font-black text-lg">No records found</p>
              <p className="text-slate-400 text-sm font-bold mt-1">Try adjusting your filters or search term</p>
            </div>
          )}
        </div>
        
        {/* ── Footer / Pagination Sim ── */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Showing {filteredAccounts.length} of {accounts.length} transactions
          </p>
          <div className="flex items-center gap-2">
             <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-not-allowed">Previous</button>
             <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-300 transition-all">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
