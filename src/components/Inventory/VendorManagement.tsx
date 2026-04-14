import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  Truck,
  Plus,
  Search,
  Wallet,
  TrendingUp,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Building2,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  DollarSign,
  FileText,
  CreditCard,
  Receipt,
  UploadCloud,
  Paperclip,
  Eye,
  ArrowRightLeft
} from 'lucide-react';
import { toast } from 'react-toastify';

interface Vendor {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  gst: string;
  address: string;
  status: 'Active' | 'Inactive';
  outstanding_balance: number;
}

interface VendorStats {
  totalVendors: number;
  outstandingBalance: number;
  monthlyPayout: number;
  activeOrders: number;
}


export function VendorManagement({ initialShowBillForm = false }: { initialShowBillForm?: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(initialShowBillForm);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const [billData, setBillData] = useState({
    vendor_name: '',
    amount: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const generateBillReference = (vendorName: string) => {
    const prefix = vendorName.substring(0, 3).toUpperCase();
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INT-${prefix}-${date}-${random}`;
  };

  const [stats, setStats] = useState<VendorStats>({
    totalVendors: 0,
    outstandingBalance: 0,
    monthlyPayout: 0,
    activeOrders: 0
  });

  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    gst: '',
    address: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [viewingLedgerVendor, setViewingLedgerVendor] = useState<Vendor | null>(null);
  const [ledgerRecords, setLedgerRecords] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchVendorLedger = async (vendorName: string) => {
    try {
      setLedgerLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('customer_name', vendorName)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setLedgerRecords(data || []);
    } catch (err) {
      console.error('Error fetching ledger:', err);
      toast.error('Failed to load financial ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch definitions from vendors table
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .order('company_name', { ascending: true });

      if (vendorsError) throw vendorsError;

      // 2. Fetch financial records from accounts for balance calculation
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('customer_name, amount, amount_given, status, transaction_date');

      if (accountsError) throw accountsError;

      // 3. Map balances to vendors
      const balanceMap = (accountsData || []).reduce((acc: Record<string, number>, record) => {
        const name = record.customer_name;
        const diff = (record.amount || 0) - (record.amount_given || 0);
        acc[name] = (acc[name] || 0) + diff;
        return acc;
      }, {});

      // Calculate overall stats
      let totalOutstanding = 0;
      let monthlyPayout = 0;
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      (accountsData || []).forEach(record => {
        const transDate = new Date(record.transaction_date);
        const diff = (record.amount || 0) - (record.amount_given || 0);
        totalOutstanding += (record.status !== 'paid' ? diff : 0);

        if (transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear) {
          monthlyPayout += (record.amount_given || 0);
        }
      });

      const enrichedVendors = (vendorsData || []).map(v => ({
        ...v,
        outstanding_balance: balanceMap[v.company_name] || 0
      }));

      setVendors(enrichedVendors);

      setStats({
        totalVendors: enrichedVendors.length,
        outstandingBalance: totalOutstanding,
        monthlyPayout: monthlyPayout,
        activeOrders: (accountsData || []).filter(r => r.status === 'pending').length
      });

    } catch (err) {
      console.error('Error fetching vendor data:', err);
      toast.error('Failed to sync vendor directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('Vendor Registration: Entry');
    toast.info('Registering vendor...');
    setSaving(true);

    if (!user) {
      console.warn('Vendor Registration: User is null, proceeding anyway');
    }

    try {
      const { error } = await supabase
        .from('vendors')
        .insert([{
          company_name: formData.company_name,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          gst: formData.gst,
          address: formData.address,
          status: 'Active'
        }]);

      if (error) throw error;
      toast.success('Vendor registered in official directory!');
      setFormData({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        gst: '',
        address: '',
      });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to register vendor: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedVendor) return;
    setSaving(true);

    try {
      if (new Date(paymentData.date) > new Date()) {
        toast.error('Future dates are not allowed for payments');
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from('accounts')
        .insert([{
          customer_name: selectedVendor.company_name,
          transaction_type: 'payment',
          amount: 0,
          amount_given: parseFloat(paymentData.amount) || 0,
          reason: `Vendor Payment: ${selectedVendor.company_name}`,
          payment_method: paymentData.payment_method,
          invoice_number: paymentData.reference || null,
          transaction_date: paymentData.date,
          status: 'paid',
          notes: `[VENDOR_PAYMENT]: ${paymentData.notes}`.trim(),
          created_by: user.id
        }]);

      if (error) throw error;
      toast.success('Payment recorded successfully!');
      setPaymentData({
        amount: '',
        payment_method: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setShowPaymentForm(false);
      setSelectedVendor(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to record payment: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const [billFile, setBillFile] = useState<File | null>(null);

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billData.vendor_name || !billData.amount) {
      toast.warning('Please select a vendor and enter an amount');
      return;
    }

    setSaving(true);
    toast.info('Recording bill in ledger...');

    try {
      if (new Date(billData.date) > new Date()) {
        toast.error('Future dates are not allowed for bill entries');
        setSaving(false);
        return;
      }
      let billUrl = null;

      // 1. Handle File Upload if present
      if (billFile) {
        // Validation: 5MB limit
        if (billFile.size > 5 * 1024 * 1024) {
          throw new Error('File size too large. Please upload a file smaller than 5MB.');
        }

        const fileExt = billFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `bills/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('bill-copies')
          .upload(filePath, billFile);

        if (uploadError) {
          if (uploadError.message?.toLowerCase().includes('bucket not found')) {
            throw new Error("Storage bucket 'bill-copies' not found. Please run the provided SQL in your Supabase dashboard to create it.");
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('bill-copies')
          .getPublicUrl(filePath);
        
        billUrl = publicUrl;
      }

      // 2. Insert record into accounts
      const { error } = await supabase
        .from('accounts')
        .insert([{
          customer_name: billData.vendor_name,
          transaction_type: 'expense',
          amount: parseFloat(billData.amount),
          amount_given: 0,
          reason: `Bill Entry: ${billData.vendor_name}`,
          invoice_number: billData.reference,
          transaction_date: billData.date,
          status: 'pending',
          bill_soft_copy: billUrl,
          notes: `[BILL_ENTRY]: ${billData.notes}`.trim(),
          created_by: user?.id
        }]);

      if (error) throw error;

      toast.success('Bill recorded successfully!');
      setShowBillForm(false);
      setBillFile(null);
      setBillData({
        vendor_name: '',
        amount: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Bill Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to record bill');
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.contact_person.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 text-teal-400 animate-spin" />
        <p className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Syncing Vendor Directory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 pb-20 animate-in fade-in duration-700">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Vendor Management
            <div className="flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
              <CheckCircle2 className="h-3 w-3" /> Relationships Verified
            </div>
          </h2>
          <p className="text-slate-500 font-medium mt-1">Manage supplier contracts, payments, and master registry</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBillData(prev => ({ ...prev, reference: '' }));
              setShowBillForm(true);
            }}
            className="px-8 py-4 bg-emerald-100 text-emerald-700 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-200 transition-all active:scale-95 flex items-center gap-2 border border-emerald-200"
          >
            <Receipt className="h-5 w-5" /> NEW BILL ENTRY
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" /> ADD NEW VENDOR
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl border border-slate-100 group transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="h-24 w-24 text-slate-900" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Vendors</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.totalVendors} <span className="text-sm font-bold text-teal-500">active</span></h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-teal-500 bg-teal-50 w-fit px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3" /> +12% this month
          </div>
        </div>

        <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-xl border border-white/5 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className="h-24 w-24 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Outstanding Balance</p>
          <div className="flex flex-col gap-1">
            <h3 className="text-4xl font-black text-white">₹{stats.outstandingBalance.toLocaleString()}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stats.activeOrders} Pending Invoices</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-teal-400 bg-white/10 w-fit px-2 py-1 rounded-lg">
            <Clock className="h-3 w-3" /> Tracking real-time
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-400 to-teal-600 p-6 shadow-xl border border-white/20 transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <TrendingUp className="h-24 w-24 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">Monthly Payout</p>
          <h3 className="text-4xl font-black text-white">₹{stats.monthlyPayout.toLocaleString()}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-white bg-white/20 w-fit px-2 py-1 rounded-lg">
            <CreditCard className="h-3 w-3" /> Growth trend
          </div>
        </div>
      </div>

      {/* ── Search & Filter ── */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
        <input
          type="text"
          placeholder="Search by vendor name, contact person, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-16 pr-6 py-5 rounded-[28px] bg-white border border-slate-100 focus:border-transparent focus:ring-4 focus:ring-teal-500/10 shadow-lg transition-all text-slate-900 font-semibold"
        />
      </div>

      {/* ── Vendor Table ── */}
      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-50 overflow-hidden relative">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h4 className="text-xl font-black text-slate-900 tracking-tight">Active Suppliers Directory</h4>
            <p className="text-sm font-medium text-slate-400">Manage payment status and contact registry</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl font-black text-[10px] tracking-widest border border-slate-200 shadow-sm uppercase"><FileText className="h-4 w-4" /> Export Data</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Company Details</th>
                <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Balance</th>
                <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-slate-900 text-teal-400 flex items-center justify-center font-black text-xl shadow-lg group-hover:scale-110 transition-all duration-500">
                        {vendor.company_name.charAt(0)}
                      </div>
                      <div>
                        <button 
                          onClick={() => {
                            setViewingLedgerVendor(vendor);
                            fetchVendorLedger(vendor.company_name);
                          }}
                          className="text-base font-black text-slate-900 tracking-tight hover:text-teal-600 transition-colors cursor-pointer text-left"
                        >
                          {vendor.company_name}
                        </button>
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" /> Verified Supplier
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-sm font-semibold text-slate-500">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2"><Phone className="h-3 w-3" /> {vendor.phone}</span>
                      <span className="flex items-center gap-2 text-slate-400"><Mail className="h-3 w-3" /> {vendor.email}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col gap-1">
                      <span className={`text-lg font-black ${
                        vendor.outstanding_balance > 0 ? 'text-red-500' : 
                        vendor.outstanding_balance < 0 ? 'text-indigo-600' : 
                        'text-emerald-500'
                      }`}>
                        ₹{Math.abs(vendor.outstanding_balance).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {vendor.outstanding_balance > 0 ? 'Due for Payment' : 
                         vendor.outstanding_balance < 0 ? 'Advance Payment' : 
                         'Settled'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setShowPaymentForm(true);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-teal-600 shadow-md transition-all active:scale-95"
                      >
                        Pay
                      </button>
                      <button className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl transition-colors"><MoreHorizontal className="h-5 w-5" /></button>
                    </div>
                    <div className="group-hover:hidden">
                      <ChevronRight className="h-6 w-6 text-slate-200 ml-auto" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVendors.length === 0 && (
            <div className="p-32 text-center">
              <div className="inline-flex h-[120px] w-[120px] items-center justify-center rounded-[40px] bg-slate-50 text-slate-100 mb-6 group">
                <Truck className="h-16 w-16 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">No vendors matching your search</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Register Vendor Modal ── */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowAddForm(false)} />
          <div
            className="relative z-10 w-full max-w-4xl bg-white rounded-[48px] shadow-2xl p-12 border border-white/20 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto overflow-x-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-10 pb-10 border-b border-slate-50">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Register Master Vendor</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">Define standard supplier contact and financial terms</p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="h-14 w-14 flex items-center justify-center rounded-[20px] bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Vendor / Company Name *</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" name="company_name" value={formData.company_name} onChange={handleInputChange} required placeholder="e.g., DynaPower Explosives..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-black tracking-tight" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Primary Contact Person</label>
                  <div className="relative group">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange} placeholder="e.g., Alex Thompson" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">GST</label>
                  <div className="relative group">
                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" name="gst" value={formData.gst} onChange={handleInputChange} placeholder="27AAAC..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold uppercase" />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="info@company.com" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold" />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Phone / WhatsApp</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+91" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Business Address</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Factory / Office Street..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-5 pt-8">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-10 py-5 bg-slate-50 text-slate-500 rounded-3xl font-black text-[11px] hover:bg-slate-100 transition-all uppercase tracking-widest"
                >
                  Cancel Registration
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-20 py-5 bg-slate-900 text-white rounded-3xl font-black text-[11px] tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin text-teal-400" /> : <CheckCircle2 className="h-4 w-4 text-teal-400" />}
                  {saving ? 'REGISTERING...' : 'SAVE TO DIRECTORY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {showPaymentForm && selectedVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowPaymentForm(false)} />
          <div
            className="relative z-10 w-full max-w-xl bg-white rounded-[48px] shadow-2xl p-12 border border-white/20 animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Record Payment</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">Paying <span className="text-teal-600 font-black">{selectedVendor.company_name}</span></p>
              </div>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              <div className="p-6 bg-teal-50/50 rounded-3xl border border-teal-100/50">
                <label className="block text-[11px] font-black uppercase tracking-widest text-teal-800 mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Amount to Pay *
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full px-6 py-5 rounded-2xl bg-white border-none shadow-inner-lg focus:ring-4 focus:ring-teal-500/20 text-teal-900 font-black text-3xl"
                  placeholder="0.00"
                  required
                />
                <p className="text-[10px] font-bold text-teal-600/60 mt-4 uppercase tracking-[0.1em]">Outstanding: ₹{selectedVendor.outstanding_balance.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Method *</label>
                  <select
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                    required
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold appearance-none"
                  >
                    <option value="">Select Method</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="DD">DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Date *</label>
                  <input
                    type="date"
                    value={paymentData.date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                    required
                    className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Reference / Receipt #</label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  placeholder="TXN ID, Receipt No..."
                  className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-teal-500/10 text-slate-900 font-bold"
                />
              </div>

              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-8 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin text-teal-400" /> : <CreditCard className="h-4 w-4 text-teal-400" />}
                  {saving ? 'RECORDING...' : 'CONFIRM PAYMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bill Entry Modal ── */}
      {showBillForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowBillForm(false)} />
          <div
            className="relative z-10 w-full max-w-xl bg-white rounded-[48px] shadow-2xl p-12 border border-white/20 animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Bill Entry</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">Record an incoming invoice from a vendor</p>
              </div>
              <button
                onClick={() => setShowBillForm(false)}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleBillSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Vendor *</label>
                <select
                  required
                  value={billData.vendor_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBillData(prev => ({
                      ...prev,
                      vendor_name: name,
                      reference: name ? generateBillReference(name) : ''
                    }));
                  }}
                  className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold appearance-none"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.company_name}>{v.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Bill Amount *</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <input
                      type="number"
                      required
                      value={billData.amount}
                      onChange={(e) => setBillData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-black"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={billData.date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBillData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Generated Reference</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <input
                    type="text"
                    value={billData.reference}
                    onChange={(e) => setBillData(prev => ({ ...prev, reference: e.target.value }))}
                    className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-bold uppercase"
                    placeholder="Ref #"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">Automatically generated, but you can edit if needed.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notes</label>
                <textarea
                  value={billData.notes}
                  onChange={(e) => setBillData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-emerald-500/10 text-slate-900 font-medium resize-none"
                  rows={2}
                  placeholder="Items purchased, invoice terms, etc."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bill Soft Copy (PDF / Images Only)</label>
                {!billFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-[32px] cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group overflow-hidden relative">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform mb-2">
                        <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center px-4">Click to upload PDF or Image</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
                          if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
                            toast.error('Please upload only PDF or Image files (JPG, PNG, WEBP)');
                            return;
                          }
                          setBillFile(file);
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Paperclip className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 truncate max-w-[200px]">{billFile.name}</span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">{(billFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setBillFile(null)}
                      className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-all font-black text-[10px]"
                    >
                      REMOVE
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBillForm(false)}
                  className="px-6 py-4 text-slate-500 font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  {saving ? 'SAVING BILL...' : 'CONFIRM BILL ENTRY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Vendor Ledger Modal ── */}
      {viewingLedgerVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setViewingLedgerVendor(null)} />
          <div
            className="relative z-10 w-full max-w-5xl bg-white rounded-[40px] shadow-2xl border border-white/20 animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-6">
                  <div className="h-16 w-16 rounded-[24px] bg-slate-900 text-teal-400 flex items-center justify-center font-black text-2xl shadow-xl">
                    {viewingLedgerVendor.company_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{viewingLedgerVendor.company_name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                         <MapPin className="h-3 w-3" /> {viewingLedgerVendor.address}
                       </span>
                       <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded-md">
                         GST: {viewingLedgerVendor.gst}
                       </span>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                 <button
                   onClick={() => {
                     setSelectedVendor(viewingLedgerVendor);
                     setViewingLedgerVendor(null);
                     setShowPaymentForm(true);
                   }}
                   className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-teal-600 shadow-lg transition-all flex items-center gap-2 active:scale-95 border border-white/10"
                 >
                   <DollarSign className="h-4 w-4" /> Pay Vendor
                 </button>
                 <button
                   onClick={() => setViewingLedgerVendor(null)}
                   className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-all active:scale-95"
                 >
                   <X className="h-6 h-6" />
                 </button>
               </div>
            </div>

            {/* Modal Content */}
            <div className="flex-grow overflow-y-auto p-10">
               {ledgerLoading ? (
                 <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reconstructing Ledger History...</p>
                 </div>
               ) : (
                 <div className="space-y-8">
                    {/* Balanced Stats Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className={`p-6 rounded-3xl border shadow-sm ${
                         viewingLedgerVendor.outstanding_balance < 0 
                         ? 'bg-indigo-50 border-indigo-100' 
                         : 'bg-slate-50 border-slate-100'
                       }`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                            viewingLedgerVendor.outstanding_balance < 0 ? 'text-indigo-400' : 'text-slate-400'
                          }`}>
                            {viewingLedgerVendor.outstanding_balance < 0 ? 'Advance Credit Balance' : 'Current Ledger Exposure'}
                          </p>
                          <h4 className={`text-2xl font-black ${
                            viewingLedgerVendor.outstanding_balance > 0 ? 'text-red-500' : 
                            viewingLedgerVendor.outstanding_balance < 0 ? 'text-indigo-600' : 
                            'text-emerald-500'
                          }`}>
                             ₹{Math.abs(viewingLedgerVendor.outstanding_balance).toLocaleString()}
                          </h4>
                       </div>
                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
                            <h4 className="text-2xl font-black text-slate-900">{ledgerRecords.length} Transactions</h4>
                          </div>
                          <ArrowRightLeft className="h-8 w-8 text-teal-500/20" />
                       </div>
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">Financial Entries</h4>
                       
                       {ledgerRecords.length > 0 ? (
                         <div className="border border-slate-100 rounded-[32px] overflow-hidden">
                            <table className="w-full border-collapse bg-white">
                               <thead>
                                  <tr className="bg-slate-50/50">
                                     <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Date</th>
                                     <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Description / Reference</th>
                                     <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Debit (Bill)</th>
                                     <th className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Credit (Pay)</th>
                                     <th className="px-6 py-4 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Digital Doc</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {ledgerRecords.map((record) => (
                                     <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5 text-xs font-bold text-slate-500">
                                           {new Date(record.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-5">
                                           <p className="text-sm font-black text-slate-900 leading-tight">{record.reason || 'General Transaction'}</p>
                                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 italic">Ref: {record.invoice_number || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-slate-900">
                                           {record.amount > 0 ? `₹${record.amount.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-emerald-600">
                                           {record.amount_given > 0 ? `₹${record.amount_given.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                           {record.bill_soft_copy ? (
                                             <a 
                                               href={record.bill_soft_copy} 
                                               target="_blank" 
                                               rel="noopener noreferrer"
                                               className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all shadow-sm active:scale-95"
                                             >
                                               <Eye className="h-3.5 w-3.5" /> View Bill
                                             </a>
                                           ) : (
                                             <span className="text-[9px] font-bold text-slate-300 uppercase italic">No Doc Attached</span>
                                           )}
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                       ) : (
                         <div className="p-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                            <Receipt className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No transaction history found for this vendor</p>
                         </div>
                       )}
                    </div>
                 </div>
               )}
            </div>

            <div className="px-10 py-6 border-t border-slate-50 bg-slate-50/30 flex justify-end shrink-0">
               <button 
                 onClick={() => setViewingLedgerVendor(null)}
                 className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
               >
                 Close Ledger
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
