import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, User, Building, Phone, Mail, MapPin, Edit, Plus, ArrowUpRight, ArrowDownRight, Wallet, X, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { CustomerForm } from './CustomerForm';
import { CustomerPricing } from './CustomerPricing';

interface Payment {
  id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  notes?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  payment_history?: any;
}

interface Customer {
  id: string;
  company?: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  billing_address?: string;
  delivery_address?: string;
  is_gst_registered?: boolean;
  tax_id: string;
  gst_number?: string;
  created_at: string;
  updated_at: string;
  balance?: number;
}

export function CustomerDetails() {
  // Initialize auth context (user is not used yet but kept for future use)
  useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [directoryStats, setDirectoryStats] = useState({ totalPending: 0, totalAdvance: 0, customerCount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalBilled, setTotalBilled] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<'statement' | 'invoices' | 'payments' | 'pricing'>('statement');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // 1. Fetch Customers
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .order('company', { ascending: true });

      if (customerError) throw customerError;
      const fetchedCustomers = customerData || [];

      // 2. Fetch All Invoices to calculate balances
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('customer_id, customer_name, total_amount, amount_paid, payment_history');

      if (invoiceError) throw invoiceError;
      
      // 3. Aggregate balances by customer
      // We calculate from payment_history JSON for 100% accuracy as established in our deep fix
      const updatedCustomers = fetchedCustomers.map(cust => {
        const custInvoices = (invoiceData || []).filter(inv => 
          inv.customer_id === cust.id || 
          inv.customer_name === (cust.company || cust.name)
        );

        let billed = 0;
        let paid = 0;

        custInvoices.forEach(inv => {
          billed += inv.total_amount || 0;
          
          // Sum payments from history for accuracy
          let invPaid = 0;
          try {
            const history = typeof inv.payment_history === 'string' 
              ? JSON.parse(inv.payment_history) 
              : inv.payment_history;

            if (Array.isArray(history)) {
              invPaid = history.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            } else {
              invPaid = inv.amount_paid || 0;
            }
          } catch (e) {
            invPaid = inv.amount_paid || 0;
          }
          paid += invPaid;
        });

        return {
          ...cust,
          balance: billed - paid
        };
      });

      setCustomers(updatedCustomers);

      // Simple Stats calculation
      let pending = 0;
      let advance = 0;
      updatedCustomers.forEach(c => {
        if (c.balance > 0) pending += c.balance;
        else if (c.balance < 0) advance += Math.abs(c.balance);
      });
      setDirectoryStats({
        totalPending: pending,
        totalAdvance: advance,
        customerCount: updatedCustomers.length
      });
    } catch (error) {
      console.error('Error fetching customers:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);



  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleCustomerClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingInvoices(true);
    setActiveTab('statement');

    try {
      // Fetch ALL invoices for the selected customer
      // Use both ID and Name for backwards compatibility with older records
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .or(`customer_id.eq.${customer.id},customer_name.eq."${customer.company || customer.name}"`)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      const allInvoices = invoicesData || [];
      const extractedPayments: Payment[] = [];
      let billedTotal = 0;
      let calculatedPaidTotal = 0;

      const processedInvoices = allInvoices.map(inv => {
        billedTotal += inv.total_amount;
        
        let invoicePaid = 0;
        const history = typeof inv.payment_history === 'string' 
          ? JSON.parse(inv.payment_history || '[]') 
          : (inv.payment_history || []);
        
        if (Array.isArray(history)) {
          history.forEach(p => {
            const amount = parseFloat(p.amount?.toString() || '0');
            if (amount > 0) {
              invoicePaid += amount;
              extractedPayments.push({
                id: p.id || crypto.randomUUID(),
                invoice_id: inv.id,
                invoice_number: inv.invoice_number,
                amount: amount,
                payment_mode: p.payment_mode || 'cash',
                payment_date: p.payment_date || inv.invoice_date,
                notes: p.notes
              });
            }
          });
        }

        calculatedPaidTotal += invoicePaid;

        // Recalculate status based on history sum
        let currentStatus = inv.status;
        if (invoicePaid >= inv.total_amount && inv.total_amount > 0) {
          currentStatus = 'paid';
        } else if (invoicePaid > 0) {
          currentStatus = 'partial';
        }

        return {
          ...inv,
          paid_amount: invoicePaid,
          status: currentStatus
        };
      });

      // Sort payments by date descending
      extractedPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

      setInvoices(processedInvoices);
      setPayments(extractedPayments);
      setTotalBilled(billedTotal);
      setTotalPaid(calculatedPaidTotal);
      setTotalBalance(billedTotal - calculatedPaidTotal);
    } catch (error) {
      console.error('Error fetching customer ledger:', error);
      // Fallback for missing table gracefully
      setInvoices([]);
      setPayments([]);
      setTotalBilled(0);
      setTotalPaid(0);
      setTotalBalance(0);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    setIsSavingPayment(true);
    try {
      const amount = parseFloat(paymentAmount);
      const newPaidAmount = (selectedInvoice.paid_amount || 0) + amount;
      
      // Calculate new status
      let newStatus: Invoice['status'] = 'partial';
      if (newPaidAmount >= selectedInvoice.total_amount) {
        newStatus = 'paid';
      }

      // Prepare updated payment history
      const currentHistory = typeof selectedInvoice.payment_history === 'string'
        ? JSON.parse(selectedInvoice.payment_history || '[]')
        : (selectedInvoice.payment_history || []);
      
      const newPayment = {
        id: crypto.randomUUID(),
        amount: amount,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        notes: paymentNotes,
        recorded_at: new Date().toISOString()
      };

      const updatedHistory = [...currentHistory, newPayment];

      const { error } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          payment_history: updatedHistory // Pass array directly for JSONB
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      // Reset and reload
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      if (selectedCustomer) {
        setInvoices([]); // Force clear for deep refresh
        await handleCustomerClick(selectedCustomer);
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Failed to save payment. Please try again.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCloseCustomerView = () => {
    setSelectedCustomer(null);
    setInvoices([]);
    setTotalBalance(0);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingCustomer(null);
    fetchCustomers();
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    (customer.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchTerm))
  );

  // Get current customers for pagination
  const indexOfLastCustomer = currentPage * itemsPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (showForm) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          className="flex items-center text-sm text-cyan-600 hover:text-cyan-700 mb-4"
        >
          ← Back to customers
        </button>
        <CustomerForm
          onSuccess={handleFormSuccess}
          initialData={editingCustomer || undefined}
        />
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <button
            onClick={handleCloseCustomerView}
            className="flex items-center text-sm text-cyan-600 hover:text-cyan-700 mb-4"
          >
            ← Back to customers
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 pb-32">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
            <div className="w-full">
              <h2 className="text-2xl font-black text-slate-900">{selectedCustomer.company || 'Untitled Company'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedCustomer.is_gst_registered !== false ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                   {selectedCustomer.is_gst_registered !== false ? 'GST Registered' : 'URP (Unregistered)'}
                </span>
                {selectedCustomer.is_gst_registered !== false && (
                   <span className="text-sm font-bold text-slate-500">{selectedCustomer.tax_id || selectedCustomer.gst_number}</span>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-slate-700">
                  <User className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.name}
                </div>
                <div className="flex items-center text-slate-700">
                  <Phone className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.phone || 'N/A'}
                </div>
                <div className="flex items-center text-slate-700">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.email || 'N/A'}
                </div>
                <div className="flex items-start text-slate-700 pt-2 border-t border-slate-100">
                  <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-slate-400" />
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Billing Address</span>
                      <span className="text-sm font-medium">{selectedCustomer.billing_address || selectedCustomer.address || 'N/A'}</span>
                    </div>
                    {selectedCustomer.delivery_address && selectedCustomer.delivery_address !== selectedCustomer.billing_address && (
                      <div>
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest block mb-0.5">Delivery Site</span>
                        <span className="text-sm font-medium">{selectedCustomer.delivery_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto bg-slate-50 p-4 sm:p-6 rounded-2xl min-w-[320px] border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-cyan-500" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Financial Summary</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-500">Total Billed</span>
                  <span className="text-sm font-black text-slate-900">₹{totalBilled.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-500">Total Received</span>
                  <span className="text-sm font-black text-green-600">₹{totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2">
                  <div className={`p-4 rounded-xl border-2 ${totalBalance > 0 ? 'bg-orange-50 border-orange-200' : totalBalance < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest block mb-1">
                      {totalBalance > 0 ? 'Outstanding Balance' : totalBalance < 0 ? 'Advance Payment' : 'Account Settled'}
                    </span>
                    <div className={`text-2xl font-black ${totalBalance > 0 ? 'text-orange-700' : totalBalance < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      ₹{Math.abs(totalBalance).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(selectedCustomer);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 hover:border-cyan-500 hover:text-cyan-700 transition-all shadow-sm"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Customer Profile
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Section */}
          <div className="mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 border-b border-slate-100 sm:border-0 pb-2 sm:pb-0">
                <button
                  onClick={() => setActiveTab('statement')}
                  className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
                    activeTab === 'statement' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Full Statement
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
                    activeTab === 'invoices' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  All Invoices
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
                    activeTab === 'payments' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Payment History
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
                    activeTab === 'pricing' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Custom Pricing
                </button>
              </div>
            </div>

            {loadingInvoices ? (
              <div className="flex justify-center items-center h-48 py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
              </div>
            ) : activeTab === 'statement' ? (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                  <table className="min-w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Transaction Details</th>
                        <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">Debit (Bill)</th>
                        <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">Credit (Paid)</th>
                        <th className="px-6 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {[
                        ...invoices.map(inv => ({ type: 'bill' as const, date: inv.invoice_date, amount: inv.total_amount, label: `Invoice #${inv.invoice_number}`, ref: inv.id, status: inv.status })),
                        ...payments.map(p => ({ type: 'payment' as const, date: p.payment_date, amount: p.amount, label: `Payment for #${p.invoice_number}`, ref: p.id, mode: p.payment_mode }))
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((item, i) => (
                        <tr key={`${item.type}-${item.ref}-${i}`} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-700">
                            {format(new Date(item.date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {item.type === 'bill' ? <ArrowUpRight className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-green-500" />}
                              <span className="text-sm font-black text-slate-800 tracking-tight">{item.label}</span>
                            </div>
                            {item.type === 'payment' && (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-6 mt-0.5">{item.mode}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {item.type === 'bill' ? <span className="text-sm font-black text-slate-900">₹{item.amount.toLocaleString('en-IN')}</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {item.type === 'payment' ? <span className="text-sm font-black text-green-600">₹{item.amount.toLocaleString('en-IN')}</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {item.type === 'bill' && (
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {item.status}
                                </span>
                              )}
                              {item.type === 'bill' && item.status !== 'paid' && (
                                <button
                                  onClick={() => {
                                    // Use the ID from ref to find the full invoice object
                                    const targetInvoice = invoices.find(inv => inv.id === item.ref);
                                    if (targetInvoice) {
                                      setSelectedInvoice(targetInvoice);
                                      setShowPaymentModal(true);
                                    }
                                  }}
                                  className="text-[10px] font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-widest mt-1"
                                >
                                  Pay Now
                                </button>
                              )}
                            </div>
                            {item.type === 'payment' && <span className="text-[10px] font-black text-slate-400 uppercase">Received</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'invoices' ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Total</th>
                      <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Paid</th>
                      <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Balance</th>
                      <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-cyan-600">{inv.invoice_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                           {format(new Date(inv.invoice_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-900">₹{inv.total_amount.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-green-600">₹{(inv.paid_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-orange-600">₹{(inv.total_amount - (inv.paid_amount || 0)).toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                               inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {inv.status}
                            </span>
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setShowPaymentModal(true);
                                }}
                                className="text-[10px] font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-widest mt-1"
                              >
                                Pay Now
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Mode</th>
                      <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                           {format(new Date(p.payment_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-800">Payment for {p.invoice_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded">{p.payment_mode}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-green-600">₹{p.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'pricing' && (
              <CustomerPricing
                customerId={selectedCustomer.id}
                customerName={selectedCustomer.company || selectedCustomer.name}
              />
            )}
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">Accept Payment</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice #{selectedInvoice?.invoice_number}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  disabled={isSavingPayment}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Amount to Receive (₹)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        autoFocus
                        disabled={isSavingPayment}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={`Max ₹${selectedInvoice ? (selectedInvoice.total_amount - (selectedInvoice.paid_amount || 0)).toLocaleString('en-IN') : '0'}`}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-black text-lg text-slate-800 placeholder:text-slate-300 placeholder:font-bold"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">INR</div>
                    </div>
                  </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
                  <input 
                    type="date" 
                    required
                    disabled={isSavingPayment}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-bold text-sm text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mode</label>
                  <div className="relative">
                    <select
                      disabled={isSavingPayment}
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-bold text-sm text-slate-700 appearance-none"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI / GPay</option>
                    </select>
                    <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Notes (Optional)</label>
                  <textarea 
                    rows={2}
                    disabled={isSavingPayment}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Reference number, check no, or remarks..."
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingPayment || !paymentAmount}
                  className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase tracking-wider text-sm shadow-xl shadow-cyan-200 hover:bg-cyan-700 hover:shadow-cyan-300 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isSavingPayment ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm & Record Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Customer Directory</h3>
        <div className="mt-4 md:mt-0">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Customer
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search customers by name, company or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Directory Stats Summary */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-orange-50 bg-opacity-50 border border-orange-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shadow-inner">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-[11px] text-orange-600 font-black uppercase tracking-widest leading-none mb-1">Customer Outstanding</p>
                <p className="text-xs text-orange-400 font-medium">Total Pending from Customers</p>
              </div>
            </div>
            <p className="text-4xl font-black text-orange-700 leading-none tracking-tight">
              ₹{directoryStats.totalPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-emerald-50 bg-opacity-50 border border-emerald-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shadow-inner">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-emerald-600 font-black uppercase tracking-widest leading-none mb-1">Total Advance</p>
                <p className="text-xs text-emerald-400 font-medium">Excess Payments Received</p>
              </div>
            </div>
            <p className="text-4xl font-black text-emerald-700 leading-none tracking-tight">
              ₹{directoryStats.totalAdvance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Building className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No customers found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? 'Try a different search term' : 'Get started by adding a new customer'}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              New Customer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-slate-200">
              {currentCustomers.map((selectedCustomerList) => (
                <li key={selectedCustomerList.id} className="px-4 py-4 sm:px-5 sm:py-5 hover:bg-cyan-50/50 cursor-pointer transition-colors border-b border-slate-100 last:border-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 min-w-0 w-full" onClick={() => handleCustomerClick(selectedCustomerList)}>
                      <div className="flex items-center">
                        <User className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="font-bold text-slate-800">{selectedCustomerList.company || selectedCustomerList.name}</span>
                        {selectedCustomerList.is_gst_registered === false && (
                          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-wider rounded border border-slate-200 scale-90">URP</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center text-sm text-slate-500 font-medium">
                          <User className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-slate-400" />
                          {selectedCustomerList.name}
                        </div>
                        <div className="flex items-center text-sm text-slate-500 font-medium">
                          <Phone className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-slate-400" />
                          {selectedCustomerList.phone || 'N/A'}
                        </div>
                      </div>
                      <div className="mt-2 flex items-start text-xs text-slate-500 max-w-lg truncate">
                        <MapPin className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-slate-300 mt-0.5" />
                        <span className="truncate">{selectedCustomerList.billing_address || selectedCustomerList.address || 'No billing address provided'}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center justify-end w-full sm:w-auto pt-2 sm:pt-0 sm:ml-4 space-x-4 border-t border-slate-100 sm:border-0">
                      {/* Balance Indicator */}
                      <div className="text-right pr-2">
                        {selectedCustomerList.balance !== undefined && (
                          <div className={`flex flex-col items-end`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              selectedCustomerList.balance > 0 ? 'text-orange-500' : selectedCustomerList.balance < 0 ? 'text-emerald-500' : 'text-slate-400'
                            }`}>
                              {selectedCustomerList.balance > 0 ? 'Outstanding' : selectedCustomerList.balance < 0 ? 'Advance' : 'Settled'}
                            </span>
                            <div className={`text-sm font-black ${
                              selectedCustomerList.balance > 0 ? 'text-orange-600' : selectedCustomerList.balance < 0 ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {selectedCustomerList.balance === 0 ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                  <span>₹0.00</span>
                                </div>
                              ) : (
                                `₹${Math.abs(selectedCustomerList.balance).toLocaleString('en-IN')}`
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(selectedCustomerList);
                        }}
                        className="p-2 rounded-lg text-cyan-600 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 bg-slate-50 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-b-lg">
              <div className="hidden sm:block">
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{indexOfFirstCustomer + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastCustomer, filteredCustomers.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredCustomers.length}</span> results
                </p>
              </div>
              <div className="flex-1 flex justify-between sm:justify-end space-x-2">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg ${currentPage === 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg ${currentPage === totalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
