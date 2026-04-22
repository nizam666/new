import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Calendar, DollarSign, AlertCircle, CheckCircle, Printer, CreditCard, X, Receipt, Eye, Pencil } from 'lucide-react';
import { printThermalInvoice, printThermalInvoice58mm } from '../../utils/thermalPrinter';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  delivery_location: string;
  vehicle_no: string;
  invoice_date: string;
  due_date: string;
  items: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  amount_paid: number;
  payment_mode: string;
  payment_date: string;
  payment_history: string;
  empty_weight: number;
  gross_weight: number;
  net_weight: number;
  notes: string;
  terms_conditions: string;
  created_at: string;
}

interface InvoiceDetailsProps {
  onEdit?: (invoice: any) => void;
  onView?: (invoice: any) => void;
}

export function InvoiceDetails({ onEdit, onView }: InvoiceDetailsProps) {
  const { user } = useAuth();
  const userRole = user?.role;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState<string | null>(null);
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_mode: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [userRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPrintMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.print-menu-container')) {
          setShowPrintMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPrintMenu]);

  const fetchInvoices = async () => {
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (userRole !== 'director') {
        query = query.gt('tax_rate', 0);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-amber-100 text-amber-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'unpaid':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const filteredInvoices = invoices
    .filter(invoice => {
      if (filter === 'all') return true;
      return invoice.status === filter;
    })
    .filter(invoice => {
      if (!searchTerm) return true;
      return (
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.vehicle_no && invoice.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });

  const calculateStats = () => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    
    // Detailed payment breakdown
    const breakdown: Record<string, number> = { cash: 0, upi: 0, netbanking: 0, card: 0, cheque: 0, other: 0 };
    invoices.forEach(inv => {
      try {
        const history = typeof inv.payment_history === 'string' 
          ? JSON.parse(inv.payment_history) 
          : inv.payment_history;
          
        if (Array.isArray(history)) {
          history.forEach((p: any) => {
            let mode = p.payment_mode?.toLowerCase() || 'other';
            if (mode === 'bank_transfer') mode = 'netbanking';
            breakdown[mode] = (breakdown[mode] || 0) + (p.amount || 0);
          });
        } else if (inv.amount_paid > 0) {
          let mode = inv.payment_mode?.toLowerCase() || 'other';
          if (mode === 'bank_transfer') mode = 'netbanking';
          breakdown[mode] = (breakdown[mode] || 0) + (inv.amount_paid || 0);
        }
      } catch (e) {
        if (inv.amount_paid > 0) {
          let mode = inv.payment_mode?.toLowerCase() || 'other';
          if (mode === 'bank_transfer') mode = 'netbanking';
          breakdown[mode] = (breakdown[mode] || 0) + (inv.amount_paid || 0);
        }
      }
    });

    const totalPaid = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const totalPending = totalAmount - totalPaid;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    const unpaidCount = invoices.filter(inv => inv.status === 'unpaid').length;

    return { totalInvoices, totalAmount, totalPaid, totalPending, paidCount, unpaidCount, breakdown };
  };

  const stats = calculateStats();

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const remainingBalance = invoice.total_amount - invoice.amount_paid;
    setPaymentData({
      amount: remainingBalance.toFixed(2),
      payment_mode: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!selectedInvoice) return;

    try {
      const paymentAmount = parseFloat(paymentData.amount);
      const newAmountPaid = selectedInvoice.amount_paid + paymentAmount;
      const remainingBalance = selectedInvoice.total_amount - newAmountPaid;

      let newStatus = 'unpaid';
      if (remainingBalance <= 0) {
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partial';
      }

      const paymentHistory = selectedInvoice.payment_history
        ? JSON.parse(selectedInvoice.payment_history)
        : [];

      paymentHistory.push({
        amount: paymentAmount,
        payment_mode: paymentData.payment_mode,
        payment_date: paymentData.payment_date,
        notes: paymentData.notes,
        recorded_at: new Date().toISOString()
      });

      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          payment_mode: paymentData.payment_mode,
          payment_date: paymentData.payment_date,
          payment_history: JSON.stringify(paymentHistory)
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      alert('Payment recorded successfully!');
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) {
      alert('Error recording payment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const printInvoice = (invoice: Invoice, includeCompanyName: boolean = true) => {
    const items = JSON.parse(invoice.items);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; }
            .invoice-info { margin-bottom: 30px; }
            .customer-info { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .totals { text-align: right; margin-top: 20px; }
            .totals table { width: 300px; margin-left: auto; }
            .total-row { font-weight: bold; font-size: 16px; }
            .notes { margin-top: 30px; padding: 15px; background-color: #f9f9f9; }
            .terms { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            ${includeCompanyName ? '<div class="company-name">SRI BABA BLUE MATELS PVT LTD</div>' : ''}
            <div>Invoice</div>
          </div>

          <div class="invoice-info">
            <table style="width: 100%; border: none;">
              <tr>
                <td style="border: none;"><strong>Invoice Number:</strong> ${invoice.invoice_number}</td>
                <td style="border: none; text-align: right;"><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="border: none;"><strong>Customer:</strong> ${invoice.customer_name}</td>
                <td style="border: none; text-align: right;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>

          <table>
            <thead>
              <tr>
                <th>Material/Description</th>
                <th style="text-align: right;">Quantity (Net)</th>
                <th style="text-align: right;">Weights (G/E)</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: { material: string; quantity: number; rate: number; amount: number; gross_weight?: number; empty_weight?: number }) => `
                <tr>
                  <td>${item.material}</td>
                  <td style="text-align: right;">${item.quantity.toFixed(3)}</td>
                  <td style="text-align: right;">
                    ${item.gross_weight !== undefined ? `${item.gross_weight.toFixed(3)} / ${item.empty_weight?.toFixed(3)}` : '-'}
                  </td>
                  <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
                  <td style="text-align: right;">₹${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">₹${invoice.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Tax (${invoice.tax_rate}%):</td>
                <td style="text-align: right;">₹${invoice.tax_amount.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Total:</td>
                <td style="text-align: right;">₹${invoice.total_amount.toFixed(2)}</td>
              </tr>
              ${invoice.amount_paid > 0 ? `
              <tr>
                <td>Paid:</td>
                <td style="text-align: right; color: green;">₹${invoice.amount_paid.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Balance Due:</td>
                <td style="text-align: right; color: red;">₹${(invoice.total_amount - invoice.amount_paid).toFixed(2)}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${invoice.notes ? `
          <div class="notes">
            <strong>Notes:</strong><br/>
            ${invoice.notes}
          </div>
          ` : ''}

          ${invoice.terms_conditions ? `
          <div class="terms">
            <strong>Terms & Conditions:</strong><br/>
            ${invoice.terms_conditions.replace(/\n/g, '<br/>')}
          </div>
          ` : ''}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading invoices...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* Total Invoices */}
        <div className="bg-blue-50 bg-opacity-50 rounded-xl p-5 border border-blue-100 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shadow-inner">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Total Invoices</p>
          </div>
          <p className="text-3xl font-black text-blue-900 leading-none">{stats.totalInvoices}</p>
        </div>

        {/* Total Sales Amount */}
        <div className="bg-emerald-50 bg-opacity-50 rounded-xl p-5 border border-emerald-100 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shadow-inner">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Total Sales Amount</p>
          </div>
          <p className="text-3xl font-black text-emerald-900 leading-none">₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Total Received (Paid) */}
        <div className="bg-emerald-50 bg-opacity-50 rounded-xl p-5 border border-emerald-200 flex flex-col shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shadow-inner">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Total Received</p>
            </div>
          </div>
          
          <p className="text-3xl font-black text-emerald-900 mb-4 leading-none">₹{stats.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          
          <div className="space-y-1.5 pt-3 border-t border-emerald-100">
            {Object.entries(stats.breakdown).map(([mode, amount]) => amount > 0 && (
              <div key={mode} className="flex justify-between items-center text-[10px]">
                <span className="text-emerald-600 font-bold uppercase tracking-wider">{mode === 'netbanking' ? 'Bank' : mode}</span>
                <span className="font-black text-emerald-800">₹{amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending / Advance */}
        <div className={`${stats.totalPending >= 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'} bg-opacity-50 rounded-xl p-5 border flex flex-col justify-between shadow-sm transition-all hover:shadow-md`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${stats.totalPending >= 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'} rounded-xl flex items-center justify-center shadow-inner`}>
              {stats.totalPending >= 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <p className={`text-[10px] ${stats.totalPending >= 0 ? 'text-orange-600' : 'text-green-600'} font-black uppercase tracking-widest`}>
              {stats.totalPending >= 0 ? 'Total Pending' : 'Advance Balance'}
            </p>
          </div>
          <p className={`text-3xl font-black ${stats.totalPending >= 0 ? 'text-orange-700' : 'text-green-700'} leading-none`}>
            ₹{Math.abs(stats.totalPending).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by invoice number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onView?.(invoice)}
                        className="text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all text-left"
                      >
                        {invoice.invoice_number}
                      </button>
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{invoice.customer_name}</p>
                    {invoice.delivery_location && (
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Dest: {invoice.delivery_location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
                  <button
                    onClick={() => onView?.(invoice)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Ticket"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onEdit?.(invoice)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Ticket"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />
                  
                  {invoice.status !== 'paid' && (
                    <button
                      onClick={() => handleRecordPayment(invoice)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 text-sm font-bold whitespace-nowrap"
                    >
                      <CreditCard className="w-4 h-4" />
                      Record Payment
                    </button>
                  )}
                  <div className="relative print-menu-container flex-1 sm:flex-none">
                    <button
                      onClick={() => setShowPrintMenu(showPrintMenu === invoice.id ? null : invoice.id)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-bold"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    {showPrintMenu === invoice.id && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                        <div className="px-4 py-3 border-b border-slate-200">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showCompanyName}
                              onChange={(e) => setShowCompanyName(e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Show Company Name</span>
                          </label>
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => {
                              printInvoice(invoice, showCompanyName);
                              setShowPrintMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            <Printer className="w-4 h-4" />
                            <div>
                              <div className="font-medium">Standard Print</div>
                              <div className="text-xs text-slate-500">A4 Size</div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              printThermalInvoice(invoice, showCompanyName);
                              setShowPrintMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            <Receipt className="w-4 h-4" />
                            <div>
                              <div className="font-medium">Thermal 80mm</div>
                              <div className="text-xs text-slate-500">Standard thermal</div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              printThermalInvoice58mm(invoice, showCompanyName);
                              setShowPrintMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            <Receipt className="w-4 h-4" />
                            <div>
                              <div className="font-medium">Thermal 58mm</div>
                              <div className="text-xs text-slate-500">Compact thermal</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Invoice Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Due Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-bold text-slate-900">₹{invoice.total_amount.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Balance Due</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-bold text-red-600">
                      ₹{(invoice.total_amount - invoice.amount_paid).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {invoice.amount_paid > 0 && (
                <div className="pt-4 border-t border-slate-200 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Amount Paid</p>
                      <p className="text-sm font-bold text-green-600">₹{invoice.amount_paid.toFixed(2)}</p>
                    </div>
                    {invoice.payment_mode && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Payment Mode</p>
                        <p className="text-sm font-medium text-slate-900 capitalize">{invoice.payment_mode}</p>
                      </div>
                    )}
                    {invoice.payment_date && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Payment Date</p>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(invoice.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {invoice.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{invoice.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Invoice Number:</span>
                  <span className="text-sm font-semibold text-slate-900">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Customer:</span>
                  <span className="text-sm font-semibold text-slate-900">{selectedInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Total Amount:</span>
                  <span className="text-sm font-semibold text-slate-900">₹{selectedInvoice.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Already Paid:</span>
                  <span className="text-sm font-semibold text-green-600">₹{selectedInvoice.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-300">
                  <span className="text-sm font-semibold text-slate-600">Balance Due:</span>
                  <span className="text-base font-bold text-red-600">
                    ₹{(selectedInvoice.total_amount - selectedInvoice.amount_paid).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Mode *
                </label>
                <select
                  required
                  value={paymentData.payment_mode}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Payment reference or notes..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
