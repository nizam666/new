import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingDown,
  User,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowRight,
  Zap,
  Wrench,
  Users,
  Fuel,
  Package,
  Building2,
  CheckCircle2,
  Clock,
  Banknote,
  Smartphone,
  BookOpen,
  Receipt
} from 'lucide-react';
import { toast } from 'react-toastify';

interface AccountsFormProps {
  onSuccess: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'fuel',    label: 'Fuel',        icon: Fuel,      color: 'bg-orange-500',  ring: 'ring-orange-400', text: 'text-orange-600', light: 'bg-orange-50 border-orange-200' },
  { id: 'parts',   label: 'Spare Parts', icon: Wrench,    color: 'bg-slate-700',   ring: 'ring-slate-500',  text: 'text-slate-700',  light: 'bg-slate-50  border-slate-200'  },
  { id: 'salary',  label: 'Salaries',    icon: Users,     color: 'bg-emerald-600', ring: 'ring-emerald-400',text: 'text-emerald-700',light: 'bg-emerald-50 border-emerald-200'},
  { id: 'repair',  label: 'Maintenance', icon: Wrench,    color: 'bg-blue-600',    ring: 'ring-blue-400',   text: 'text-blue-700',   light: 'bg-blue-50 border-blue-200'     },
  { id: 'utility', label: 'Utilities',   icon: Zap,       color: 'bg-amber-500',   ring: 'ring-amber-400',  text: 'text-amber-700',  light: 'bg-amber-50 border-amber-200'   },
  { id: 'rent',    label: 'Rent/Lease',  icon: Building2, color: 'bg-indigo-600',  ring: 'ring-indigo-400', text: 'text-indigo-700', light: 'bg-indigo-50 border-indigo-200' },
  { id: 'misc',    label: 'Misc',        icon: Package,   color: 'bg-slate-400',   ring: 'ring-slate-300',  text: 'text-slate-500',  light: 'bg-slate-50  border-slate-200'  },
];

const PAYMENT_METHODS = [
  { id: 'cash',          label: 'Cash',          icon: Banknote   },
  { id: 'bank_transfer', label: 'Bank Transfer',  icon: CreditCard },
  { id: 'online',        label: 'UPI / Online',   icon: Smartphone },
  { id: 'cheque',        label: 'Cheque',         icon: BookOpen   },
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

  const update = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  const totalAmount = parseFloat(formData.amount) || 0;
  const amountPaid = parseFloat(formData.amount_paid) || 0;
  const balance = totalAmount - amountPaid;
  const paymentStatus = amountPaid >= totalAmount && totalAmount > 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';
  const selectedCategory = EXPENSE_CATEGORIES.find(c => c.id === formData.category)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('accounts').insert([{
        transaction_type: 'expense',
        category: formData.category,
        customer_name: formData.vendor_payee,
        amount: totalAmount,
        amount_given: amountPaid,
        reason: formData.reason,
        transaction_date: formData.transaction_date,
        payment_method: formData.payment_method,
        status: paymentStatus,
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
        notes: ''
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero Header ── */}
      <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 text-white overflow-hidden mb-6 shadow-2xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shadow-lg">
              <TrendingDown className="w-7 h-7 text-rose-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">Accounts Module</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-none">Expense Entry</h2>
            </div>
          </div>

          {/* Live Amount Preview */}
          {totalAmount > 0 && (
            <div className="flex items-center gap-4 animate-in fade-in duration-300">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Outflow</p>
                <p className="text-3xl font-black text-rose-400 leading-none">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className={`w-2 h-12 rounded-full ${paymentStatus === 'paid' ? 'bg-emerald-400' : paymentStatus === 'partial' ? 'bg-amber-400' : 'bg-rose-500'} transition-colors duration-500`} />
            </div>
          )}
        </div>

        {/* Category Pill Row */}
        <div className="relative z-10 mt-8 flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = formData.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => update('category', cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 border ${
                  active
                    ? `${cat.color} border-transparent text-white shadow-lg scale-105`
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Form Body ── */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Row 1: Vendor + Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Vendor */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / Payee *</label>
            </div>
            <input
              type="text"
              required
              list="vendor-list"
              value={formData.vendor_payee}
              onChange={e => update('vendor_payee', e.target.value)}
              placeholder="Who are we paying?"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white transition-all outline-none text-sm"
            />
            <datalist id="vendor-list">
              {vendors.map((v, i) => <option key={i} value={v} />)}
            </datalist>
          </div>

          {/* Date + Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</label>
              </div>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={formData.transaction_date}
                onChange={e => update('transaction_date', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Reason */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose / Reason *</label>
          </div>
          <textarea
            required
            rows={3}
            value={formData.reason}
            onChange={e => update('reason', e.target.value)}
            placeholder="Describe what this expense is for..."
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none text-sm"
          />
        </div>

        {/* Row 3: Financials + Payment Method */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Amount & Paid */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Details</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Total Amount */}
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Amount *</p>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-400 transition-all">
                  <span className="px-3 py-3 text-sm font-black text-slate-400 bg-slate-100 border-r border-slate-200">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.amount}
                    onChange={e => update('amount', e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-3 font-black text-lg text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Amount Paid */}
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Amount Paid</p>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-400 transition-all">
                  <span className="px-3 py-3 text-sm font-black text-emerald-500 bg-emerald-50 border-r border-slate-200">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount_paid}
                    onChange={e => update('amount_paid', e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-3 font-black text-lg text-slate-900 outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Balance Display */}
            {totalAmount > 0 && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 ${
                paymentStatus === 'paid'
                  ? 'bg-emerald-50 border-emerald-200'
                  : paymentStatus === 'partial'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {paymentStatus === 'paid'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : paymentStatus === 'partial'
                    ? <Clock className="w-4 h-4 text-amber-500" />
                    : <AlertCircle className="w-4 h-4 text-rose-500" />
                  }
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    paymentStatus === 'paid' ? 'text-emerald-600' : paymentStatus === 'partial' ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Pending Payment'}
                  </span>
                </div>
                {balance > 0 && (
                  <span className="font-black text-sm text-rose-600">Balance: ₹{balance.toLocaleString('en-IN')}</span>
                )}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {PAYMENT_METHODS.map(method => {
                const Icon = method.icon;
                const active = formData.payment_method === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => update('payment_method', method.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      active
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Optional notes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (Optional)</p>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Any additional reference or remarks..."
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none text-sm"
          />
        </div>

        {/* ── Submit Row ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 text-slate-400">
            <div className={`w-2.5 h-2.5 rounded-full ${selectedCategory.color}`} />
            <p className="text-xs font-bold">
              <span className="text-slate-600">{selectedCategory.label}</span>
              {formData.vendor_payee && <span className="text-slate-400"> · {formData.vendor_payee}</span>}
              {totalAmount > 0 && <span className="text-rose-500 font-black"> · ₹{totalAmount.toLocaleString('en-IN')}</span>}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none group"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                Commit Expense
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
