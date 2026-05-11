import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingDown,
  User,
  Calendar,
  CreditCard,
  FileText,
  ArrowRight,
  Receipt,
  Building2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { FUND_SOURCES } from './FundAccounts';

interface AccountsFormProps {
  onSuccess: () => void;
}

const DEPARTMENTS = [
  'Quarry', 'Crusher', 'JCB', 'Sales', 'Weighbridge', 'Other'
];

const PROJECT_ITEMS = [
  'Explosive', 'Fuels', 'VSI', 'Jaw-Crusher', 'Salary', 'Advance', 'Payment', 
  'Contractor Payment', 'Contractor Advance', 'Opening Balance', 'Miscellaneous', 'Other'
];

export function AccountsForm({ onSuccess }: AccountsFormProps) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);
  const [vendorBalance, setVendorBalance] = useState<number | null>(null);
  const [fundBalances, setFundBalances] = useState<Record<string, number>>({});
  const [paymentSplits, setPaymentSplits] = useState<Record<string, string>>({});
  
  const [outflowType, setOutflowType] = useState<'overheads' | 'contractors' | 'suppliers'>('suppliers');
  const [contractorsList, setContractorsList] = useState<any[]>([]);
  const [overheadList, setOverheadList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    transaction_type: 'expense',
    towards_company: 'KVSS',
    department: 'Quarry',
    project_item: 'Miscellaneous',
    custom_item: '',
    category: 'misc',
    vendor_payee: '',
    amount_paid: '',
    reason: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'sbbm_sales',
    sbbm_type: 'Cash',
    other_name: '',
    is_payment_only: false,
    notes: ''
  });

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data } = await supabase
          .from('vendors')
          .select('company_name')
          .eq('status', 'Active')
          .order('company_name');
        if (data) setVendors(data.map(v => v.company_name));
      } catch (err) {
        console.error('Error fetching vendors:', err);
      }
    };

    const fetchFundBalances = async () => {
      try {
        const { data } = await supabase
          .from('fund_transactions')
          .select('source_id, type, amount');
          
        const { data: salesData } = await supabase
          .from('invoices')
          .select('amount_paid, payment_mode')
          .gt('amount_paid', 0);

        const totals: Record<string, number> = {};
        
        if (data) {
          data.forEach(row => {
            if (!totals[row.source_id]) totals[row.source_id] = 0;
            totals[row.source_id] += row.type === 'deposit' ? row.amount : -row.amount;
          });
        }

        if (salesData) {
          salesData.forEach(sale => {
            const mode = (sale.payment_mode || 'cash').toLowerCase();
            let sourceId = 'sbbm_cash';
            if (mode.includes('upi')) sourceId = 'sbbm_upi';
            if (mode.includes('net') || mode.includes('bank')) sourceId = 'sbbm_netbank';
            
            if (!totals[sourceId]) totals[sourceId] = 0;
            totals[sourceId] += (sale.amount_paid || 0);
          });
        }

        setFundBalances(totals);
      } catch (err) {
        console.error('Error fetching fund balances:', err);
      }
    };

    const fetchContractors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, employee_id')
          .or('role.eq.contractor,employee_id.ilike.CON-%')
          .eq('is_active', true)
          .order('full_name');
        
        if (error) throw error;
        setContractorsList(data || []);
      } catch (err) {
        console.error('Error loading contractors:', err);
      }
    };

    const fetchOverhead = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, employee_id, role, salary, salary_department')
          .eq('is_overhead', true)
          .eq('is_active', true)
          .order('full_name');
        
        if (error) throw error;
        
        if (data) {
          const mapped = data.map(u => ({
            ...u,
            amount: u.salary || 0,
            department: u.salary_department || 'Quarry'
          }));
          setOverheadList(mapped);
        }
      } catch (err) {
        console.error('Error loading overhead:', err);
      }
    };

    fetchVendors();
    fetchFundBalances();
    fetchContractors();
    fetchOverhead();
  }, []);

  // Fetch balance for selected vendor
  useEffect(() => {
    const fetchBalance = async () => {
      if (!formData.vendor_payee) {
        setVendorBalance(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('amount, amount_given')
          .eq('customer_name', formData.vendor_payee);

        if (error) throw error;

        const balance = (data || []).reduce((acc, rec) => acc + ((rec.amount || 0) - (rec.amount_given || 0)), 0);
        setVendorBalance(balance);
      } catch (err) {
        console.error('Error fetching vendor balance:', err);
      }
    };

    fetchBalance();
  }, [formData.vendor_payee]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const update = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filteredVendors = vendors.filter(v =>
    v.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const selectVendor = (name: string) => {
    update('vendor_payee', name);
    setVendorSearch(name);
    setShowVendorDropdown(false);
  };

  const amountPaid = parseFloat(formData.amount_paid) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedSources = Object.keys(paymentSplits);
      
      if (selectedSources.length === 0) {
        toast.warning('Please select at least one payment method.');
        setLoading(false);
        return;
      }

      const splitTotal = selectedSources.reduce((sum, src) => sum + (parseFloat(paymentSplits[src]) || 0), 0);
      
      if (Math.abs(splitTotal - amountPaid) > 0.01) {
        toast.warning(`Total split amount (₹${splitTotal}) must equal Amount to Record (₹${amountPaid}).`);
        setLoading(false);
        return;
      }

      if (formData.transaction_type === 'expense') {
        for (const src of selectedSources) {
          const splitAmount = parseFloat(paymentSplits[src]) || 0;
          const availableBalance = fundBalances[src] || 0;
          if (splitAmount > availableBalance) {
            toast.warning(`Insufficient balance in ${FUND_SOURCES.find(s => s.id === src)?.label || 'selected account'}. Available: ₹${availableBalance.toLocaleString('en-IN')}`);
            setLoading(false);
            return;
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Logic: If it's a Payment, Advance, or user checked 'Settling Outstanding', the bill amount (amount) should be 0
      // so that it reduces the outstanding balance (balance = amount - amount_given)
      const isPaymentOnly = 
        formData.project_item === 'Payment' || 
        formData.project_item === 'Advance' || 
        formData.project_item === 'Contractor Payment' || 
        formData.project_item === 'Contractor Advance' || 
        formData.is_payment_only;
      const recordAmount = isPaymentOnly ? 0 : amountPaid;

      const { error } = await supabase.from('accounts').insert([{
        transaction_type: formData.transaction_type,
        category: formData.category,
        customer_name: formData.vendor_payee,
        amount: recordAmount,
        amount_given: amountPaid,
        reason: formData.reason,
        transaction_date: formData.transaction_date,
        payment_method: selectedSources.join(', '),
        status: 'paid',
        notes: `Company: ${formData.towards_company} | Dept: ${formData.department} | Item: ${formData.project_item === 'Other' ? formData.custom_item : formData.project_item}${formData.other_name ? ' | Payed By: ' + formData.other_name : ''}${formData.notes ? ' | ' + formData.notes : ''}`,
        created_by: user.id
      }]);

      if (error) throw error;

      // Update fund balances for each split
      const fundInsertions = selectedSources.map(src => ({
        source_id: src,
        type: formData.transaction_type === 'expense' ? 'withdrawal' : 'deposit',
        amount: parseFloat(paymentSplits[src]) || 0,
        note: `${formData.transaction_type === 'expense' ? 'Outflow' : 'Inflow'} for ${formData.vendor_payee} (${formData.project_item})`,
        transaction_date: formData.transaction_date,
        created_by: user.id
      }));

      const { error: fundError } = await supabase.from('fund_transactions').insert(fundInsertions);

      if (fundError) {
        console.error('Failed to update fund balance:', fundError);
        // We don't throw here to avoid failing the whole process if the main account record succeeded,
        // but ideally we'd use a postgres function for a transaction.
      }

      toast.success(`${formData.transaction_type === 'income' ? 'Inflow' : 'Outflow'} recorded successfully!`);
      setFormData({
        transaction_type: 'expense',
        towards_company: 'KVSS',
        department: 'Quarry',
        project_item: 'Miscellaneous',
        custom_item: '',
        category: 'misc',
        vendor_payee: '',
        amount_paid: '',
        reason: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'sbbm_sales',
        sbbm_type: 'Cash',
        other_name: '',
        is_payment_only: false,
        notes: ''
      });
      setPaymentSplits({});
      setVendorSearch('');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero Header ── */}
      <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 text-white overflow-hidden mb-6 shadow-2xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${
              formData.transaction_type === 'income' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30'
            }`}>
              {formData.transaction_type === 'income' ? (
                <Receipt className="w-7 h-7 text-emerald-400" />
              ) : (
                <TrendingDown className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">Accounts Module</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-none">
                {formData.transaction_type === 'income' ? 'Inflow Entry' : 'Outflow Entry'}
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
               <button 
                 onClick={() => update('transaction_type', 'income')}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                   formData.transaction_type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                 }`}
               >
                 Inflow
               </button>
               <button 
                 onClick={() => update('transaction_type', 'expense')}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                   formData.transaction_type === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                 }`}
               >
                 Outflow
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Form Body ── */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Step 1: Date */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
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

        {/* Step 2 & 3: Outflow Redesign (Only for Outflow) */}
        {formData.transaction_type === 'expense' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Outflow Type */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outflow Category *</label>
              </div>
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 w-full">
                <button 
                  type="button"
                  onClick={() => {
                    setOutflowType('overheads');
                    update('vendor_payee', '');
                    update('project_item', 'Salary');
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    outflowType === 'overheads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Overheads
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setOutflowType('contractors');
                    update('vendor_payee', '');
                    update('project_item', 'Contractor Payment');
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    outflowType === 'contractors' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Contractors
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setOutflowType('suppliers');
                    update('vendor_payee', '');
                    update('project_item', 'Payment');
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    outflowType === 'suppliers' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Suppliers
                </button>
              </div>
            </div>

            {/* Selection based on Outflow Type */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3" ref={vendorRef}>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {outflowType === 'overheads' ? 'Select Employee' : outflowType === 'contractors' ? 'Select Contractor' : 'Material Supplier *'}
                </label>
              </div>

              {outflowType === 'overheads' && (
                <select
                  required
                  value={formData.vendor_payee}
                  onChange={e => {
                    update('vendor_payee', e.target.value);
                    const selected = overheadList.find(o => o.full_name === e.target.value);
                    if (selected) {
                      update('amount_paid', selected.amount.toString());
                      update('department', selected.department || 'Quarry');
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- Choose Employee --</option>
                  {overheadList.map(o => (
                    <option key={o.id} value={o.full_name}>
                      {o.full_name} (₹{o.amount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              )}

              {outflowType === 'contractors' && (
                <select
                  required
                  value={formData.vendor_payee}
                  onChange={e => {
                    update('vendor_payee', e.target.value);
                    const selected = contractorsList.find(c => c.full_name === e.target.value);
                    if (selected) {
                      // Auto-fetch department from contractor function prefix
                      const ref = selected.employee_id || '';
                      let dept = 'Quarry';
                      if (ref.startsWith('CON-CRU-')) dept = 'Crusher';
                      else if (ref.startsWith('CON-ELE-') || ref.startsWith('CON-MAN-')) dept = 'Other';
                      update('department', dept);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- Choose Contractor --</option>
                  {contractorsList.map(c => (
                    <option key={c.id} value={c.full_name}>
                      {c.full_name} ({c.employee_id})
                    </option>
                  ))}
                </select>
              )}

              {outflowType === 'suppliers' && (
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={vendorSearch}
                    onChange={e => {
                      setVendorSearch(e.target.value);
                      update('vendor_payee', e.target.value);
                      setShowVendorDropdown(true);
                    }}
                    onFocus={() => setShowVendorDropdown(true)}
                    placeholder="Search supplier…"
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white transition-all outline-none text-sm"
                  />
                  {showVendorDropdown && filteredVendors.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                      {filteredVendors.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={() => selectVendor(v)}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2 border-b border-slate-50 last:border-0"
                        >
                          <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generic Payee for Inflow (Only for Inflow) */}
        {formData.transaction_type === 'income' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3" ref={vendorRef}>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer / Payee *</label>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={vendorSearch}
                onChange={e => {
                  setVendorSearch(e.target.value);
                  update('vendor_payee', e.target.value);
                  setShowVendorDropdown(true);
                }}
                onFocus={() => setShowVendorDropdown(true)}
                placeholder="Search or type name…"
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white transition-all outline-none text-sm"
              />
              {showVendorDropdown && filteredVendors.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredVendors.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => selectVendor(v)}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2 border-b border-slate-50 last:border-0"
                    >
                      <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row 2: Department + Purpose + Project/Item */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Department */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</label>
            </div>
            <select
              required
              value={formData.department}
              onChange={e => update('department', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm appearance-none cursor-pointer"
            >
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Purpose of Payment */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose of Payment *</label>
            </div>
            <input
              type="text"
              required
              value={formData.reason}
              onChange={e => update('reason', e.target.value)}
              placeholder="e.g. Fuel, advance, etc."
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
            />
          </div>

          {/* Project/Item */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project / Item *</label>
            </div>
            <div className="space-y-3">
              <select
                required
                value={formData.project_item}
                onChange={e => update('project_item', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm appearance-none cursor-pointer"
              >
                {PROJECT_ITEMS.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              {formData.project_item === 'Other' && (
                <input
                  type="text"
                  required
                  value={formData.custom_item}
                  onChange={e => update('custom_item', e.target.value)}
                  placeholder="Type custom item name…"
                  className="w-full px-4 py-3 bg-indigo-50/30 rounded-xl border border-indigo-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm animate-in slide-in-from-top-2 duration-300"
                />
              )}
            </div>
          </div>
        </div>

        {/* Company Selection */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Company</label>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 w-full sm:w-fit">
            <button 
              type="button"
              onClick={() => update('towards_company', 'KVSS')}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                formData.towards_company === 'KVSS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
              }`}
            >
              KVSS
            </button>
            <button 
              type="button"
              onClick={() => update('towards_company', 'SBBM')}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                formData.towards_company === 'SBBM' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
              }`}
            >
              SBBM
            </button>
          </div>
        </div>



        {/* Row 3: Financials + Payed From */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

          {/* Amount & Paid */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Details</p>
              </div>
            </div>

            {/* Account Standing Badge */}
            {vendorBalance !== null && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-500 animate-in fade-in zoom-in-95 ${
                vendorBalance > 0 ? 'bg-rose-50 border-rose-100 text-rose-900' : 
                vendorBalance < 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 
                'bg-emerald-50 border-emerald-100 text-emerald-900'
              }`}>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] opacity-60">Vendor Account Standing</span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    {vendorBalance > 0 ? 'Payment Outstanding' : 
                     vendorBalance < 0 ? 'Advance Credit' : 
                     'Account Settled'}
                  </span>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="text-xl font-black">₹{Math.abs(vendorBalance).toLocaleString('en-IN')}</p>
                  {vendorBalance > 0 && formData.transaction_type === 'expense' && (
                    <button
                      type="button"
                      onClick={() => update('is_payment_only', !formData.is_payment_only)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                        formData.is_payment_only 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                        : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200'
                      }`}
                    >
                      {formData.is_payment_only ? '✓ Settling Outstanding' : 'Settling Previous Balance?'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Amount Paid */}
              <div className="space-y-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Amount to Record *</p>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all shadow-inner">
                  <span className="px-5 py-4 text-xl font-black text-emerald-500 bg-emerald-50/50 border-r border-slate-200">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.amount_paid}
                    onChange={e => update('amount_paid', e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-6 py-5 font-black text-3xl text-slate-900 outline-none bg-transparent placeholder:text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payed From (Payment Sources) */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payed From</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {FUND_SOURCES.map(src => {
                const Icon = src.icon;
                const active = paymentSplits.hasOwnProperty(src.id);
                const bal = fundBalances[src.id] ?? 0;
                return (
                  <div
                    key={src.id}
                    className={`flex flex-col gap-2 p-3 rounded-xl transition-all border ${
                      active
                        ? `${src.bg} border-transparent ring-2 ring-inset ring-current ${src.color} shadow-sm`
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const newSplits = { ...paymentSplits };
                        if (active) {
                          delete newSplits[src.id];
                        } else {
                          const currentTotal = Object.values(newSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                          const remaining = Math.max(0, parseFloat(formData.amount_paid || '0') - currentTotal);
                          newSplits[src.id] = remaining > 0 ? String(remaining) : '';
                        }
                        setPaymentSplits(newSplits);
                      }}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <Icon className={`w-4 h-4 ${active ? src.color : ''}`} />
                      <span className={`text-[11px] font-black uppercase ${active ? src.color : ''}`}>{src.label}</span>
                    </button>
                    
                    <div className="flex justify-between items-center w-full mt-1">
                      <span className={`text-[10px] font-bold ${
                        bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-500' : 'text-slate-300'
                      }`}>
                        Bal: ₹{Math.abs(bal).toLocaleString('en-IN')}
                      </span>
                      {active && (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={paymentSplits[src.id]}
                            onChange={(e) => setPaymentSplits({ ...paymentSplits, [src.id]: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Amount"
                            className="w-24 pl-5 pr-2 py-1.5 text-xs font-black rounded-lg border-none focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 bg-white/60 shadow-inner"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conditional Other Name Field */}
            {Object.keys(paymentSplits).some(key => key.startsWith('other_')) && (
              <div className="mt-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Specify Name / Holder *</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={formData.other_name}
                    onChange={e => update('other_name', e.target.value)}
                    placeholder="Enter name (e.g. Mani, Appa...)"
                    className="w-full pl-11 pr-4 py-3 bg-indigo-50/30 rounded-xl border border-indigo-100 font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Remarks (Notes) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks (Optional)</p>
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
            <p className="text-xs font-bold">
              <span className="text-indigo-600 uppercase tracking-tighter text-[10px] font-black">{formData.towards_company}</span>
              <span className="mx-2 text-slate-300">|</span>
              {formData.vendor_payee && <span className="text-slate-600">{formData.vendor_payee}</span>}
              {amountPaid > 0 && <span className={`${formData.transaction_type === 'income' ? 'text-emerald-500' : 'text-rose-500'} font-black`}> {formData.vendor_payee ? '· ' : ''}₹{amountPaid.toLocaleString('en-IN')}</span>}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 ${
              formData.transaction_type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-slate-900 hover:bg-indigo-600 shadow-indigo-200'
            } text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none group`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                Commit {formData.transaction_type === 'income' ? 'Inflow' : 'Outflow'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
