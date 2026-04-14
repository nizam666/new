import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Receipt, 
  DollarSign, 
  Calendar, 
  User, 
  CreditCard, 
  Tag, 
  FileText,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  Plus
} from 'lucide-react';
import { toast } from 'react-toastify';

interface AccountsFormProps {
  onSuccess: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'fuel', label: 'Fuel & Lubricants', icon: '⛽', color: 'bg-orange-500' },
  { id: 'parts', label: 'Spare Parts', icon: '⚙️', color: 'bg-slate-700' },
  { id: 'salary', label: 'Staff Salaries', icon: '👥', color: 'bg-emerald-600' },
  { id: 'repair', label: 'Maintenance', icon: '🔧', color: 'bg-blue-600' },
  { id: 'utility', label: 'Utilities', icon: '⚡', color: 'bg-amber-500' },
  { id: 'rent', label: 'Rent/Lease', icon: '🏢', color: 'bg-indigo-600' },
  { id: 'misc', label: 'Miscellaneous', icon: '📦', color: 'bg-slate-400' },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: <ArrowRight className="w-4 h-4" /> },
  { id: 'online', label: 'Online / UPI', icon: <Plus className="w-4 h-4" /> },
  { id: 'cheque', label: 'Cheque', icon: <FileText className="w-4 h-4" /> },
];

export function AccountsForm({ onSuccess }: AccountsFormProps) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    category: 'misc',
    vendor_payee: '',
    amount: '',
    amount_paid: '',
    reason: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    status: 'paid',
    notes: ''
  });

  useState(() => {
    const fetchVendors = async () => {
      try {
        const { data } = await supabase.from('vendors').select('name');
        if (data) setVendors(data.map(v => v.name));
      } catch (err) {
        console.error('Error fetching vendors:', err);
      }
    };
    fetchVendors();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const amount = parseFloat(formData.amount);
      const paid = parseFloat(formData.amount_paid) || 0;

      const { error } = await supabase
        .from('accounts')
        .insert([{
          transaction_type: 'expense',
          category: formData.category,
          customer_name: formData.vendor_payee,
          amount: amount,
          amount_given: paid,
          reason: formData.reason,
          transaction_date: formData.transaction_date,
          payment_method: formData.payment_method,
          status: paid >= amount ? 'paid' : (paid > 0 ? 'partial' : 'pending'),
          notes: formData.notes || null,
          created_by: user.id
        }]);

      if (error) throw error;

      toast.success('Expense recorded successfully!');
      setFormData({
        category: 'misc',
        vendor_payee: '',
        amount: '',
        amount_paid: '',
        reason: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        status: 'paid',
        notes: ''
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const balance = (parseFloat(formData.amount) || 0) - (parseFloat(formData.amount_paid) || 0);

  return (
    <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500 max-w-4xl mx-auto mb-10">
      {/* Premium Header */}
      <div className="bg-slate-900 p-6 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ml-24 -mb-24" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[22px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
              <TrendingDown className="w-6 h-6 md:w-8 md:h-8 text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl md:text-3xl font-black tracking-tight leading-none uppercase">Expense Portal</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px] md:text-[10px] mt-1 md:mt-2">Daily Expenditure Logging</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 md:px-5 md:py-3 bg-white/5 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 text-center flex-1 md:flex-none">
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Summary</p>
                <p className="text-lg md:text-xl font-black text-rose-400">₹{(parseFloat(formData.amount) || 0).toLocaleString()}</p>
             </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-12 space-y-8 md:space-y-10">
        {/* Category Selection - Optimized for Mobile Scrolling */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Tag className="w-3 h-3" /> Select Expenditure Category
          </label>
          <div className="flex overflow-x-auto pb-4 md:pb-0 md:flex-wrap gap-3 no-scrollbar scroll-smooth -mx-6 px-6 md:mx-0 md:px-0">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.id })}
                className={`flex-shrink-0 flex items-center gap-3 px-5 py-4 md:px-6 md:py-4 rounded-2xl border-2 transition-all duration-300 group ${
                  formData.category === cat.id
                    ? `${cat.color} border-transparent text-white shadow-xl scale-105`
                    : 'border-slate-50 bg-slate-50/50 text-slate-500 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <span className="text-lg md:text-xl group-hover:scale-125 transition-transform">{cat.icon}</span>
                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Details */}
          <div className="space-y-8">
            <div className="relative group">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute -top-2 left-6 bg-white px-2 z-10 transition-colors group-focus-within:text-emerald-500 flex items-center gap-2">
                Vendor / Payee Name *
                {vendors.length > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded tracking-normal normal-case">Linked</span>}
              </label>
              <div className="relative">
                <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  required
                  list="vendor-list"
                  value={formData.vendor_payee}
                  onChange={(e) => setFormData({ ...formData, vendor_payee: e.target.value })}
                  placeholder="Who are we paying?"
                  className="w-full pl-16 pr-8 py-4 md:py-5 bg-slate-50/50 border-2 border-slate-50 rounded-3xl font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                />
                <datalist id="vendor-list">
                  {vendors.map((v, i) => (
                    <option key={i} value={v} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute -top-2 left-6 bg-white px-2 z-10">
                  Transaction Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    className="w-full pl-16 pr-4 py-4 md:py-5 bg-slate-50/50 border-2 border-slate-50 rounded-3xl font-bold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="relative group">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute -top-2 left-6 bg-white px-2 z-10">
                  Payment Method
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full pl-16 pr-4 py-4 md:py-5 bg-slate-50/50 border-2 border-slate-50 rounded-3xl font-bold text-slate-700 appearance-none focus:bg-white focus:border-emerald-500 transition-all outline-none"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="relative group">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute -top-2 left-6 bg-white px-2 z-10">
                Detailed Purpose / Reason *
              </label>
              <div className="relative">
                <FileText className="absolute left-6 top-6 w-5 h-5 text-slate-300" />
                <textarea
                  required
                  rows={4}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Describe what this expense is for..."
                  className="w-full pl-16 pr-8 py-4 md:py-5 bg-slate-50/50 border-2 border-slate-50 rounded-3xl font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Money Section - High Visual Hierarchy */}
          <div className="bg-slate-50 rounded-[32px] p-6 md:p-8 space-y-6 md:space-y-8 flex flex-col justify-center border border-slate-100 shadow-inner">
            <div className="text-center space-y-2">
               <Receipt className="w-8 h-8 md:w-10 md:h-10 text-rose-400 mx-auto mb-2" />
               <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-none">Financing Details</h3>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Numerical Input Only</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-2">Total Amount</p>
                <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-1 flex items-center transition-all focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">₹</div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="flex-1 px-4 py-2 md:py-3 font-black text-xl md:text-2xl text-slate-900 outline-none bg-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="relative">
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-2">Amount Paid</p>
                <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-1 flex items-center transition-all focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">₹</div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount_paid}
                    onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                    className="flex-1 px-4 py-2 md:py-3 font-black text-xl md:text-2xl text-slate-900 outline-none bg-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {balance > 0 && (
                <div className="p-4 md:p-5 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Outstanding</p>
                      <p className="text-base md:text-lg font-black text-rose-600 leading-none">₹{balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 md:pt-10 border-t border-slate-100">
          <div className="flex items-center gap-4 text-slate-400">
             <TrendingDown className="w-5 h-5 hidden sm:block" />
             <p className="text-[10px] md:text-xs font-bold leading-relaxed max-w-xs text-center md:text-left">
               Securely recording this entry will update the management ledger and vendor account instantly.
             </p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-8 md:px-10 py-4 md:py-5 bg-slate-900 text-white rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-emerald-600 transition-all shadow-2xl active:scale-95 disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-3 group"
          >
            {loading ? 'Processing...' : (
              <>
                Commit Entry <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
