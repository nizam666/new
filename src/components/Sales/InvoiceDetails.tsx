import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Calendar, DollarSign, AlertCircle, CheckCircle, Printer, CreditCard, X, Receipt, Eye, Pencil } from 'lucide-react';
import { printThermalInvoice, printThermalInvoice58mm } from '../../utils/thermalPrinter';

const t = (text: string): string => text;

function escapeHtml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function g(n: number): string {
    if (n < 20) return a.slice(n, n + 1)[0] || '';
    const digit = n % 10;
    return (b.slice(Math.floor(n / 10), Math.floor(n / 10) + 1)[0] || '') + (digit ? ' ' + (a.slice(digit, digit + 1)[0] || '') : '');
  }

  function h(n: number): string {
    if (n < 100) return g(n);
    const remainder = n % 100;
    return (a.slice(Math.floor(n / 100), Math.floor(n / 100) + 1)[0] || '') + ' Hundred' + (remainder ? ' and ' + g(remainder) : '');
  }

  function c(n: number): string {
    if (n === 0) return 'Zero';
    let word = '';
    
    // Crore (1,00,00,000)
    if (Math.floor(n / 10000000) > 0) {
      word += c(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    
    // Lakh (1,00,000)
    if (Math.floor(n / 100000) > 0) {
      word += h(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    
    // Thousand (1,000)
    if (Math.floor(n / 1000) > 0) {
      word += h(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    
    // Hundreds
    if (n > 0) {
      word += h(n);
    }
    
    return word.trim();
  }

  // Handle decimals as Paise
  const parts = num.toFixed(2).split('.');
  const whole = parseInt(parts[0]);
  const decimal = parseInt(parts[1] || '0');

  let result = c(whole) + ' Rupees';
  if (decimal > 0) {
    result += ' and ' + c(decimal) + ' Paise';
  }
  return result + ' Only';
}

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

      // Filter out official GST invoices created by GstSalesModule
      const standardInvoices = (data || []).filter((inv) => {
        try {
          const parsed = JSON.parse(inv.notes || '{}');
          return !parsed || parsed.invoice_type !== 'gst_invoice';
        } catch {
          return true; // Non-JSON notes or plain text notes means it's standard
        }
      });

      setInvoices(standardInvoices);
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

  const printInvoice = async (invoice: Invoice, includeCompanyName: boolean = true) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print invoice');
      return;
    }

    // 1. Resolve Customer Details
    let billingAddress = '';
    let customerMobile = '';
    let customerGstin = '';
    let customerPan = '';

    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('name', invoice.customer_name)
        .maybeSingle();

      let finalCustData = custData;
      if (!finalCustData) {
        const { data: custData2 } = await supabase
          .from('customers')
          .select('*')
          .eq('company', invoice.customer_name)
          .maybeSingle();
        finalCustData = custData2;
      }

      if (finalCustData) {
        billingAddress = finalCustData.billing_address || finalCustData.address || '';
        customerMobile = finalCustData.phone || '';
        customerGstin = finalCustData.gst_number || '';
        if (customerGstin && customerGstin.length >= 12) {
          customerPan = customerGstin.substring(2, 12);
        }
      }
    } catch (error) {
      console.error('Error fetching customer details for printing standard invoice:', error);
    }

    const badgeText = 'ORIGINAL FOR RECIPIENT';
    const invoiceNo = invoice.invoice_number.split('-').pop() || invoice.invoice_number;
    const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString('en-GB');

    const companyHeader = includeCompanyName 
      ? '<div class="company-name">SRI BABA BLUE METALS PRIVATE LIMITED</div>' +
        '<div class="company-address">Halekundani Village , Krishnagiri Dt, Tamil Nadu, 635121</div>' +
        '<div class="company-contacts">' +
        '  <span><strong>GSTIN:</strong> 33AAKCS1538C1ZO</span>' +
        '  <span><strong>PAN Number:</strong> AAKCS1538C</span>' +
        '  <span><strong>Email:</strong> sribababluemetals@gmail.com</span>' +
        '</div>'
      : '<div style="height: 120px;"></div>';

    // Parse items
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    let itemsRowsHtml = '';
    let totalQty = 0;
    let totalTax = 0;

    if (Array.isArray(items)) {
      itemsRowsHtml = items.map((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        const amount = parseFloat(item.amount) || 0;
        const hsn = item.hsn || '25171010';
        
        totalQty += qty;

        const taxRatePct = invoice.tax_rate || 5;
        const baseTaxable = amount / (1 + taxRatePct / 100);
        const calculatedRate = baseTaxable / qty;
        const taxVal = amount - baseTaxable;
        totalTax += taxVal;

        return '<tr>' +
          '<td class="text-left">' + escapeHtml(item.material).toUpperCase() + '</td>' +
          '<td class="text-center">' + escapeHtml(hsn) + '</td>' +
          '<td class="text-center">' + qty + ' MTON</td>' +
          '<td class="text-center">' + calculatedRate.toFixed(2) + '</td>' +
          '<td class="text-center">' +
            taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
            '<div style="font-size: 8px; color: #475569; font-weight: normal; margin-top: 1px;">(' + taxRatePct + '%)</div>' +
          '</td>' +
          '<td class="text-right">₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
        '</tr>';
      }).join('');
    }

    const amountInWords = numberToWords(invoice.total_amount);

    const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + 
      encodeURIComponent('upi://pay?pa=paytm.s1jp618@pty&pn=' + encodeURIComponent('Sri Baba Blue Metals Pvt Ltd') + '&am=' + invoice.total_amount + '&cu=INR');

    const qrSectionHtml = 
      '<div class="qr-section">' +
      '  <img class="qr-code-img" src="' + escapeHtml(qrCodeUrl) + '" alt="Payment QR Code"/>' +
      '  <div class="qr-details">' +
      '    <div class="qr-title">PAYMENT QR CODE</div>' +
      '    <div class="qr-upi-id">UPI ID: paytm.s1jp618@pty</div>' +
      '    <div class="qr-logos">' +
      '      <span class="qr-logo-badge phonepe">PhonePe</span>' +
      '      <span class="qr-logo-badge gpay">GPay</span>' +
      '      <span class="qr-logo-badge paytm">Paytm</span>' +
      '      <span class="qr-logo-badge upi">UPI</span>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const signatureSvg = 
      '<svg width="120" height="50" viewBox="0 0 120 50">' +
      '  <path d="M 15 35 C 30 15, 35 10, 42 28 C 50 35, 65 35, 75 25 C 80 18, 92 10, 95 28 C 98 33, 108 30, 115 25" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    const billingAddressHtml = billingAddress ? escapeHtml(billingAddress).replace(/\n/g, '<br/>') : 'Address not specified';
    const customerMobileHtml = customerMobile ? 'Mobile: ' + escapeHtml(customerMobile) + '<br/>' : '';
    const customerGstinHtml = customerGstin ? 'GSTIN: ' + escapeHtml(customerGstin) + '<br/>' : '';
    const customerPanHtml = customerPan ? 'PAN Number: ' + escapeHtml(customerPan) + '<br/>' : '';

    const htmlTemplate = 
      '<!DOCTYPE html>' +
      '<html>' +
      '<head>' +
      '  <title>GST Invoice (' + badgeText + ') - ' + invoice.invoice_number + '</title>' +
      '  <style>' +
      '    @page {' +
      '      size: A4;' +
      '      margin: 10mm 15mm;' +
      '    }' +
      '    body {' +
      '      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;' +
      '      color: #000000;' +
      '      margin: 0;' +
      '      padding: 0;' +
      '      font-size: 11px;' +
      '      line-height: 1.35;' +
      '      -webkit-print-color-adjust: exact !important;' +
      '      print-color-adjust: exact !important;' +
      '    }' +
      '    .container {' +
      '      width: 100%;' +
      '      max-width: 210mm;' +
      '      margin: 0 auto;' +
      '    }' +
      '    .header-top {' +
      '      display: flex;' +
      '      justify-content: space-between;' +
      '      align-items: center;' +
      '      margin-bottom: 2px;' +
      '    }' +
      '    .tax-invoice-label {' +
      '      font-size: 14px;' +
      '      font-weight: 800;' +
      '      letter-spacing: 0.05em;' +
      '      color: #000;' +
      '    }' +
      '    .recipient-badge {' +
      '      border: 1.5px solid #000000;' +
      '      border-radius: 4px;' +
      '      padding: 3px 8px;' +
      '      font-size: 9px;' +
      '      color: #000000;' +
      '      font-weight: 800;' +
      '      letter-spacing: 0.02em;' +
      '    }' +
      '    .company-name {' +
      '      font-size: 26px;' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '      margin: 6px 0 2px 0;' +
      '      letter-spacing: -0.01em;' +
      '    }' +
      '    .company-address {' +
      '      font-size: 11px;' +
      '      color: #000;' +
      '      margin: 2px 0 4px 0;' +
      '      font-weight: 500;' +
      '    }' +
      '    .company-contacts {' +
      '      font-size: 11px;' +
      '      color: #000;' +
      '      margin: 4px 0 8px 0;' +
      '      font-weight: 500;' +
      '    }' +
      '    .company-contacts span {' +
      '      margin-right: 15px;' +
      '    }' +
      '    .thick-line {' +
      '      border-top: 4px solid #000;' +
      '      margin: 4px 0 8px 0;' +
      '    }' +
      '    .invoice-banner {' +
      '      background-color: #f1f5f9;' +
      '      padding: 10px 14px;' +
      '      border-radius: 4px;' +
      '      display: flex;' +
      '      justify-content: space-between;' +
      '      font-size: 12px;' +
      '      font-weight: 800;' +
      '      margin-bottom: 12px;' +
      '      border: 1px solid #cbd5e1;' +
      '    }' +
      '    .info-grid {' +
      '      display: grid;' +
      '      grid-template-columns: 1.2fr 1.2fr 1fr;' +
      '      gap: 20px;' +
      '      margin-bottom: 15px;' +
      '    }' +
      '    .info-col-title {' +
      '      font-size: 11px;' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '      margin-bottom: 6px;' +
      '      letter-spacing: 0.02em;' +
      '      border-bottom: 1px dashed #cbd5e1;' +
      '      padding-bottom: 2px;' +
      '    }' +
      '    .info-col-content {' +
      '      font-size: 11px;' +
      '      line-height: 1.4;' +
      '      color: #000;' +
      '    }' +
      '    .info-col-content strong {' +
      '      font-size: 11px;' +
      '      display: block;' +
      '      margin-bottom: 3px;' +
      '      color: #000;' +
      '    }' +
      '    .permit-row {' +
      '      display: flex;' +
      '      justify-content: space-between;' +
      '      margin-bottom: 5px;' +
      '      font-size: 11px;' +
      '    }' +
      '    .permit-label {' +
      '      font-weight: 800;' +
      '      color: #000;' +
      '      text-transform: uppercase;' +
      '    }' +
      '    .permit-value {' +
      '      font-weight: 700;' +
      '      text-align: right;' +
      '    }' +
      '    .items-table {' +
      '      width: 100%;' +
      '      border-collapse: collapse;' +
      '      margin-top: 15px;' +
      '      margin-bottom: 12px;' +
      '    }' +
      '    .items-table thead {' +
      '      border-top: 2.5px solid #000;' +
      '      border-bottom: 2.5px solid #000;' +
      '    }' +
      '    .items-table th {' +
      '      padding: 10px 4px;' +
      '      font-size: 11px;' +
      '      font-weight: 900;' +
      '      text-transform: uppercase;' +
      '      color: #000;' +
      '    }' +
      '    .items-table tbody td {' +
      '      padding: 12px 4px;' +
      '      font-size: 11px;' +
      '      font-weight: 700;' +
      '      vertical-align: middle;' +
      '      color: #000;' +
      '    }' +
      '    .items-table .text-left { text-align: left; }' +
      '    .items-table .text-center { text-align: center; }' +
      '    .items-table .text-right { text-align: right; }' +
      '    ' +
      '    .subtotal-row {' +
      '      border-top: 2.5px solid #000;' +
      '      border-bottom: 2.5px solid #000;' +
      '      font-weight: 900;' +
      '    }' +
      '    .subtotal-row td {' +
      '      padding: 10px 4px !important;' +
      '      font-size: 11px !important;' +
      '      text-transform: uppercase;' +
      '    }' +
      '    .bottom-section {' +
      '      display: grid;' +
      '      grid-template-columns: 1.3fr 1fr;' +
      '      gap: 30px;' +
      '      margin-top: 15px;' +
      '    }' +
      '    .bank-title {' +
      '      font-size: 11px;' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '      margin-bottom: 6px;' +
      '      text-transform: uppercase;' +
      '    }' +
      '    .bank-row {' +
      '      display: flex;' +
      '      margin-bottom: 4px;' +
      '      font-size: 10.5px;' +
      '    }' +
      '    .bank-label {' +
      '      width: 90px;' +
      '      font-weight: 700;' +
      '      color: #475569;' +
      '    }' +
      '    .bank-val {' +
      '      font-weight: 800;' +
      '      color: #000;' +
      '    }' +
      '    ' +
      '    .qr-section {' +
      '      margin-top: 15px;' +
      '      display: flex;' +
      '      align-items: flex-start;' +
      '      gap: 15px;' +
      '    }' +
      '    .qr-code-img {' +
      '      width: 90px;' +
      '      height: 90px;' +
      '      border: 1.5px solid #000;' +
      '      padding: 4px;' +
      '      border-radius: 4px;' +
      '      background: white;' +
      '    }' +
      '    .qr-details {' +
      '      display: flex;' +
      '      flex-direction: column;' +
      '      justify-content: center;' +
      '      height: 98px;' +
      '    }' +
      '    .qr-title {' +
      '      font-size: 10px;' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '      margin-bottom: 4px;' +
      '      text-transform: uppercase;' +
      '    }' +
      '    .qr-upi-id {' +
      '      font-size: 10.5px;' +
      '      font-weight: 800;' +
      '      color: #000;' +
      '      margin-bottom: 8px;' +
      '    }' +
      '    .qr-logos {' +
      '      display: flex;' +
      '      align-items: center;' +
      '      gap: 6px;' +
      '      margin-top: 2px;' +
      '    }' +
      '    .qr-logo-badge {' +
      '      font-size: 8px;' +
      '      font-weight: 900;' +
      '      padding: 2px 5px;' +
      '      border-radius: 3px;' +
      '      text-transform: uppercase;' +
      '    }' +
      '    .phonepe { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }' +
      '    .gpay { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }' +
      '    .paytm { background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }' +
      '    .upi { background-color: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-style: italic; }' +
      '    .breakdown-table {' +
      '      width: 100%;' +
      '      border-collapse: collapse;' +
      '    }' +
      '    .breakdown-table td {' +
      '      padding: 6px 0;' +
      '      font-size: 11px;' +
      '      font-weight: 700;' +
      '      color: #000;' +
      '    }' +
      '    .breakdown-table .val {' +
      '      text-align: right;' +
      '      font-weight: 800;' +
      '    }' +
      '    .breakdown-divider {' +
      '      border-top: 1px solid #94a3b8;' +
      '    }' +
      '    .breakdown-total {' +
      '      font-size: 12.5px !important;' +
      '      font-weight: 950 !important;' +
      '    }' +
      '    ' +
      '    .words-section {' +
      '      text-align: right;' +
      '      margin-top: 20px;' +
      '      font-size: 11px;' +
      '    }' +
      '    .words-label {' +
      '      font-weight: 800;' +
      '      color: #475569;' +
      '      margin-bottom: 3px;' +
      '    }' +
      '    .words-value {' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '    }' +
      '    ' +
      '    .signatory-section {' +
      '      display: flex;' +
      '      flex-direction: column;' +
      '      align-items: flex-end;' +
      '      margin-top: 35px;' +
      '      padding-right: 10px;' +
      '    }' +
      '    .signatory-title {' +
      '      font-size: 10px;' +
      '      font-weight: 900;' +
      '      color: #000;' +
      '      text-transform: uppercase;' +
      '      text-align: right;' +
      '      line-height: 1.4;' +
      '    }' +
      '    .signatory-space {' +
      '      height: 50px;' +
      '      display: flex;' +
      '      align-items: center;' +
      '      justify-content: flex-end;' +
      '    }' +
      '    ' +
      '    @media print {' +
      '      body {' +
      '        margin: 0;' +
      '        padding: 0;' +
      '      }' +
      '      .no-print {' +
      '        display: none;' +
      '      }' +
      '    }' +
      '  </style>' +
      '</head>' +
      '<body onload="window.print();">' +
      '  <div class="container">' +
      '    <div class="header-top">' +
      '      <div class="tax-invoice-label">TAX INVOICE</div>' +
      '      <div class="recipient-badge">' + badgeText + '</div>' +
      '    </div>' +
      '    ' +
      '    ' + companyHeader +
      '    ' +
      '    <div class="thick-line"></div>' +
      '    ' +
      '    <div class="invoice-banner">' +
      '      <div>Invoice No.: ' + escapeHtml(invoiceNo) + '</div>' +
      '      <div>Invoice Date: ' + escapeHtml(invoiceDate) + '</div>' +
      '    </div>' +
      '    ' +
      '    <div class="info-grid">' +
      '      <div>' +
      '        <div class="info-col-title">BILL TO</div>' +
      '        <div class="info-col-content">' +
      '          <strong>' + escapeHtml(invoice.customer_name.toUpperCase()) + '</strong>' +
      '          ' + billingAddressHtml + '<br/>' +
      '          ' + customerMobileHtml +
      '          ' + customerGstinHtml +
      '          ' + customerPanHtml +
      '          Place of Supply: Tamil Nadu' +
      '        </div>' +
      '      </div>' +
      '      ' +
      '      <div>' +
      '        <div class="info-col-title">SHIP TO</div>' +
      '        <div class="info-col-content">' +
      '          <strong>' + escapeHtml(invoice.customer_name.toUpperCase()) + '</strong>' +
      '          ' + billingAddressHtml + '<br/>' +
      '          ' + customerMobileHtml +
      '          ' + customerGstinHtml +
      '          Place of Supply: Tamil Nadu' +
      '        </div>' +
      '      </div>' +
      '      ' +
      '      <div>' +
      '        <div class="info-col-title">DETAILS</div>' +
      '        <div class="info-col-content" style="padding-top: 2px;">' +
      '          <div class="permit-row">' +
      '            <span class="permit-label">Security Paper no</span>' +
      '            <span class="permit-value">-</span>' +
      '          </div>' +
      '          <div class="permit-row">' +
      '            <span class="permit-label">VEHICLE NO</span>' +
      '            <span class="permit-value">' + escapeHtml(invoice.vehicle_no || '-') + '</span>' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    ' +
      '    <table class="items-table">' +
      '      <thead>' +
      '        <tr>' +
      '          <th class="text-left" style="width: 45%;">ITEMS</th>' +
      '          <th class="text-center" style="width: 12%;">HSN</th>' +
      '          <th class="text-center" style="width: 12%;">QTY.</th>' +
      '          <th class="text-center" style="width: 10%;">RATE</th>' +
      '          <th class="text-center" style="width: 11%;">TAX</th>' +
      '          <th class="text-right" style="width: 10%;">AMOUNT</th>' +
      '        </tr>' +
      '      </thead>' +
      '      <tbody>' +
      '        ' + itemsRowsHtml +
      '        ' +
      '        <tr class="subtotal-row">' +
      '          <td class="text-left">SUBTOTAL</td>' +
      '          <td></td>' +
      '          <td class="text-center">' + totalQty.toFixed(2) + ' MTON</td>' +
      '          <td></td>' +
      '          <td class="text-center">₹ ' + totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '          <td class="text-right">₹ ' + invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
      '        </tr>' +
      '      </tbody>' +
      '    </table>' +
      '    ' +
      '    <div class="bottom-section">' +
      '      <div>' +
      '        <div class="bank-title">BANK DETAILS</div>' +
      '        <div class="bank-row">' +
      '          <div class="bank-label">Name:</div>' +
      '          <div class="bank-val">Sri Baba Blue Metals Pvt Ltd</div>' +
      '        </div>' +
      '        <div class="bank-row">' +
      '          <div class="bank-label">IFSC Code:</div>' +
      '          <div class="bank-val">BARB0KRIDHA</div>' +
      '        </div>' +
      '        <div class="bank-row">' +
      '          <div class="bank-label">Account No:</div>' +
      '          <div class="bank-val">69910200000060</div>' +
      '        </div>' +
      '        <div class="bank-row">' +
      '          <div class="bank-label">Bank:</div>' +
      '          <div class="bank-val">Bank of Baroda, KRISHNAGIRI, T.N.</div>' +
      '        </div>' +
      '        ' +
      '        ' + qrSectionHtml +
      '      </div>' +
      '      ' +
      '      <div>' +
      '        <table class="breakdown-table">' +
      '          <tr>' +
      '            <td>Taxable Amount</td>' +
      '            <td class="val">₹ ' + (invoice.total_amount - invoice.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '          </tr>' +
      '          <tr>' +
      '            <td>CGST @' + ((invoice.tax_rate || 5) / 2) + '%</td>' +
      '            <td class="val">₹ ' + (invoice.tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '          </tr>' +
      '          <tr>' +
      '            <td>SGST @' + ((invoice.tax_rate || 5) / 2) + '%</td>' +
      '            <td class="val">₹ ' + (invoice.tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '          </tr>' +
      '          <tr class="breakdown-divider">' +
      '            <td class="breakdown-total" style="padding-top: 8px;">Total Amount</td>' +
      '            <td class="val breakdown-total" style="padding-top: 8px;">₹ ' + invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
      '          </tr>' +
      '          <tr class="breakdown-divider">' +
      '            <td style="padding-top: 6px; color: #475569;">Received Amount</td>' +
      '            <td class="val" style="padding-top: 6px; color: #000;">₹ ' + (invoice.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
      '          </tr>' +
      '        </table>' +
      '      </div>' +
      '    </div>' +
      '    ' +
      '    <div class="words-section">' +
      '      <div class="words-label">Total Amount (in words)</div>' +
      '      <div class="words-value">' + escapeHtml(amountInWords) + '</div>' +
      '    </div>' +
      '    ' +
      '    <div class="signatory-section">' +
      '      <div class="signatory-title"></div>' +
      '      <div class="signatory-space">' +
      '        ' + signatureSvg +
      '      </div>' +
      '      <div class="signatory-title">' +
      '        AUTHORISED SIGNATORY FOR<br/>SRI BABA BLUE METALS PRIVATE LIMITED' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</body>' +
      '</html>';

    printWindow.document.write(htmlTemplate);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">{t('Loading invoices...')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
        {/* Total Invoices */}
        <div className="bg-blue-50 bg-opacity-50 rounded-xl p-4 md:p-5 border border-blue-100 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <p className="text-[9px] md:text-[10px] text-blue-600 font-black uppercase tracking-widest">{t('Total Invoices')}</p>
          </div>
          <p className="text-2xl md:text-3xl font-black text-blue-900 leading-none">{stats.totalInvoices}</p>
        </div>

        {/* Total Sales Amount */}
        <div className="bg-emerald-50 bg-opacity-50 rounded-xl p-4 md:p-5 border border-emerald-100 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
            </div>
            <p className="text-[9px] md:text-[10px] text-emerald-600 font-black uppercase tracking-widest">{t('Total Sales')}</p>
          </div>
          <p className="text-2xl md:text-3xl font-black text-emerald-900 leading-none">₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Total Received (Paid) */}
        <div className="bg-emerald-50 bg-opacity-50 rounded-xl p-4 md:p-5 border border-emerald-200 flex flex-col shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
              </div>
              <p className="text-[9px] md:text-[10px] text-emerald-600 font-black uppercase tracking-widest">{t('Received')}</p>
            </div>
          </div>
          
          <p className="text-2xl md:text-3xl font-black text-emerald-900 mb-3 md:mb-4 leading-none">₹{stats.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          
          <div className="space-y-1 pt-2 md:pt-3 border-t border-emerald-100">
            {Object.entries(stats.breakdown).map(([mode, amount]) => amount > 0 && (
              <div key={mode} className="flex justify-between items-center text-[9px] md:text-[10px]">
                <span className="text-emerald-600 font-bold uppercase tracking-wider">{mode === 'netbanking' ? 'Bank' : mode}</span>
                <span className="font-black text-emerald-800">₹{amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending / Advance */}
        <div className={`${stats.totalPending >= 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'} bg-opacity-50 rounded-xl p-4 md:p-5 border flex flex-col justify-between shadow-sm transition-all hover:shadow-md`}>
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className={`w-8 h-8 md:w-10 md:h-10 ${stats.totalPending >= 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'} rounded-lg md:rounded-xl flex items-center justify-center shadow-inner`}>
              {stats.totalPending >= 0 ? <AlertCircle className="w-4 h-4 md:w-5 md:h-5" /> : <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />}
            </div>
            <p className={`text-[9px] md:text-[10px] ${stats.totalPending >= 0 ? 'text-orange-600' : 'text-green-600'} font-black uppercase tracking-widest`}>
              {stats.totalPending >= 0 ? t('Pending') : t('Advance')}
            </p>
          </div>
          <p className={`text-2xl md:text-3xl font-black ${stats.totalPending >= 0 ? 'text-orange-700' : 'text-green-700'} leading-none`}>
            ₹{Math.abs(stats.totalPending).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <input
            type="text"
            placeholder={t("Search invoice or customer...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
          >
            <option value="all">{t('All Status')}</option>
            <option value="unpaid">{t('Unpaid')}</option>
            <option value="partial">{t('Partially Paid')}</option>
            <option value="paid">{t('Paid')}</option>
          </select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">{t('No invoices found')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button
                        onClick={() => onView?.(invoice)}
                        className="text-base md:text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all text-left"
                      >
                        {invoice.invoice_number}
                      </button>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm font-bold text-slate-700">{invoice.customer_name}</p>
                    {invoice.delivery_location && (
                      <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t('Dest:')} {invoice.delivery_location}
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
                      {t('Record Payment')}
                    </button>
                  )}
                  <div className="relative print-menu-container flex-1 sm:flex-none">
                    <button
                      onClick={() => setShowPrintMenu(showPrintMenu === invoice.id ? null : invoice.id)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-bold"
                    >
                      <Printer className="w-4 h-4" />
                      {t('Print')}
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
                            <span className="text-sm font-medium text-slate-700">{t('Show Company Name')}</span>
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
                              <div className="font-medium">{t('Standard Print')}</div>
                              <div className="text-xs text-slate-500">{t('A4 Size')}</div>
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
                              <div className="font-medium">{t('Thermal 80mm')}</div>
                              <div className="text-xs text-slate-500">{t('Standard thermal')}</div>
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
                              <div className="font-medium">{t('Thermal 58mm')}</div>
                              <div className="text-xs text-slate-500">{t('Compact thermal')}</div>
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
                  <p className="text-xs text-slate-500 mb-1">{t('Invoice Date')}</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('Due Date')}</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('Total Amount')}</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-bold text-slate-900">₹{invoice.total_amount.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('Balance Due')}</p>
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
                      <p className="text-xs text-slate-500 mb-1">{t('Amount Paid')}</p>
                      <p className="text-sm font-bold text-green-600">₹{invoice.amount_paid.toFixed(2)}</p>
                    </div>
                    {invoice.payment_mode && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('Payment Mode')}</p>
                        <p className="text-sm font-medium text-slate-900 capitalize">{invoice.payment_mode}</p>
                      </div>
                    )}
                    {invoice.payment_date && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('Payment Date')}</p>
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
                  <p className="text-xs text-slate-500 mb-1">{t('Notes')}</p>
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
              <h3 className="text-lg font-semibold text-slate-900">{t('Record Payment')}</h3>
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
                  <span className="text-sm text-slate-600">{t('Invoice Number:')}</span>
                  <span className="text-sm font-semibold text-slate-900">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">{t('Customer:')}</span>
                  <span className="text-sm font-semibold text-slate-900">{selectedInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">{t('Total Amount:')}</span>
                  <span className="text-sm font-semibold text-slate-900">₹{selectedInvoice.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">{t('Already Paid:')}</span>
                  <span className="text-sm font-semibold text-green-600">₹{selectedInvoice.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-300">
                  <span className="text-sm font-semibold text-slate-600">{t('Balance Due:')}</span>
                  <span className="text-base font-bold text-red-600">
                    ₹{(selectedInvoice.total_amount - selectedInvoice.amount_paid).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('Payment Amount *')}
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
                  {t('Payment Mode *')}
                </label>
                <select
                  required
                  value={paymentData.payment_mode}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="cash">{t('Cash')}</option>
                  <option value="bank_transfer">{t('Bank Transfer')}</option>
                  <option value="cheque">{t('Cheque')}</option>
                  <option value="upi">{t('UPI')}</option>
                  <option value="card">{t('Card')}</option>
                  <option value="other">{t('Other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('Payment Date *')}
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
                  {t('Notes')}
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={t("Payment reference or notes...")}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={submitPayment}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('Record Payment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
