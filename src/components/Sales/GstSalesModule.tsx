import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Calendar, Search, Download, FileText, CheckCircle, TrendingUp,
  Calculator, ShieldAlert, Award, Plus, Trash2, Building2, ChevronDown,
  Receipt, LayoutList, RefreshCw, Printer, Pencil, Truck
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';

// ─── Company Master ───────────────────────────────────────────────────────────
const COMPANIES = {
  kvs: {
    id: 'kvs',
    name: 'K V S SUBRAHMANYAM',
    prefix: 'KVS',
    gstin: '33BZMPS0103A1Z0',
    address: '20/1A, Halekundani Village, Krishnagiri Tk and Dt, Krishnagiri, Tamil Nadu, 635121',
    mobile: '9241086865',
    email: 'kvssubrahmanyam80@gmail.com',
    pan: 'BZMPS0103A',
    bank_name: 'K V S SUBRAHMANYAM',
    bank_acc: '05490200000626',
    bank_ifsc: 'BARB0KRIDHA',
    bank_branch: 'Bank of Baroda ,KRISHNAGIRI, T.N.',
  },
  sbbm: {
    id: 'sbbm',
    name: 'SRI BABA BLUE METALS PRIVATE LIMITED',
    prefix: 'SBBM',
    gstin: '33AAKCS1538C1ZO',
    address: 'Halekundani Village , Krishnagiri Dt, Tamil Nadu, 635121',
    mobile: '',
    email: 'sribababluemetals@gmail.com',
    pan: 'AAKCS1538C',
    bank_name: 'Sri Baba Blue Metals Pvt Ltd',
    bank_acc: '69910200000060',
    bank_ifsc: 'BARB0KRIDHA',
    bank_branch: 'Bank of Baroda, KRISHNAGIRI, T.N.',
    upi_id: 'paytm.s1jp618@pty',
  },
} as const;

type CompanyId = keyof typeof COMPANIES;

const getCompanyDetails = (id?: string) => {
  if (id === 'kvs') return COMPANIES.kvs;
  return COMPANIES.sbbm;
};

function escapeHtml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const t = (text: string): string => text;

// ─── Indian Numbering System Word Converter ───────────────────────────────────
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd-MM-yyyy');
  } catch (e) {
    console.error('Error formatting date:', e);
    return dateStr;
  }
};

// ─── Dynamic GST Invoice PDF Printing ─────────────────────────────────────────
const GST_INVOICE_TEMPLATE = `
<!DOCTYPE html>
<html>
  <head>
    <title>GST Invoice (__BADGE_TEXT__) - __INVOICE_NUMBER__</title>
    <style>
      @page {
        size: A4;
        margin: 10mm 15mm;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #000000;
        margin: 0;
        padding: 0;
        font-size: 11px;
        line-height: 1.35;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .container {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
      }
      .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
      }
      .tax-invoice-label {
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.05em;
        color: #000;
      }
      .recipient-badge {
        border: 1.5px solid #000000;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 9px;
        color: #000000;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .company-name {
        font-size: 26px;
        font-weight: 900;
        color: #000;
        margin: 6px 0 2px 0;
        letter-spacing: -0.01em;
      }
      .company-address {
        font-size: 11px;
        color: #000;
        margin: 2px 0 4px 0;
        font-weight: 500;
      }
      .company-contacts {
        font-size: 11px;
        color: #000;
        margin: 4px 0 8px 0;
        font-weight: 500;
      }
      .company-contacts span {
        margin-right: 15px;
      }
      .thick-line {
        border-top: 4px solid #000;
        margin: 4px 0 8px 0;
      }
      .invoice-banner {
        background-color: #f1f5f9;
        padding: 10px 14px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 12px;
        border: 1px solid #cbd5e1;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1.2fr 1.2fr 1fr;
        gap: 20px;
        margin-bottom: 15px;
      }
      .info-col-title {
        font-size: 11px;
        font-weight: 900;
        color: #000;
        margin-bottom: 6px;
        letter-spacing: 0.02em;
        border-bottom: 1px dashed #cbd5e1;
        padding-bottom: 2px;
      }
      .info-col-content {
        font-size: 11px;
        line-height: 1.4;
        color: #000;
      }
      .info-col-content strong {
        font-size: 11px;
        display: block;
        margin-bottom: 3px;
        color: #000;
      }
      .permit-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 11px;
      }
      .permit-label {
        font-weight: 800;
        color: #000;
        text-transform: uppercase;
      }
      .permit-value {
        font-weight: 700;
        text-align: right;
      }
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        margin-bottom: 12px;
      }
      .items-table thead {
        border-top: 2.5px solid #000;
        border-bottom: 2.5px solid #000;
      }
      .items-table th {
        padding: 10px 4px;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        color: #000;
      }
      .items-table tbody td {
        padding: 12px 4px;
        font-size: 11px;
        font-weight: 700;
        vertical-align: middle;
        color: #000;
      }
      .items-table .text-left { text-align: left; }
      .items-table .text-center { text-align: center; }
      .items-table .text-right { text-align: right; }
      
      .subtotal-row {
        border-top: 2.5px solid #000;
        border-bottom: 2.5px solid #000;
        font-weight: 900;
      }
      .subtotal-row td {
        padding: 10px 4px !important;
        font-size: 11px !important;
        text-transform: uppercase;
      }
      .bottom-section {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 30px;
        margin-top: 15px;
      }
      .bank-title {
        font-size: 11px;
        font-weight: 900;
        color: #000;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .bank-row {
        display: flex;
        margin-bottom: 4px;
        font-size: 10.5px;
      }
      .bank-label {
        width: 90px;
        font-weight: 700;
        color: #475569;
      }
      .bank-val {
        font-weight: 800;
        color: #000;
      }
      
      .qr-section {
        margin-top: 15px;
        display: flex;
        align-items: flex-start;
        gap: 15px;
      }
      .qr-code-img {
        width: 90px;
        height: 90px;
        border: 1.5px solid #000;
        padding: 4px;
        border-radius: 4px;
        background: white;
      }
      .qr-details {
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 98px;
      }
      .qr-title {
        font-size: 10px;
        font-weight: 900;
        color: #000;
        margin-bottom: 4px;
        text-transform: uppercase;
      }
      .qr-upi-id {
        font-size: 10.5px;
        font-weight: 800;
        color: #000;
        margin-bottom: 8px;
      }
      .qr-logos {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .qr-logo-badge {
        font-size: 8px;
        font-weight: 900;
        padding: 2px 5px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .phonepe { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
      .gpay { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      .paytm { background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
      .upi { background-color: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-style: italic; }

      .breakdown-table {
        width: 100%;
        border-collapse: collapse;
      }
      .breakdown-table td {
        padding: 6px 0;
        font-size: 11px;
        font-weight: 700;
        color: #000;
      }
      .breakdown-table .val {
        text-align: right;
        font-weight: 800;
      }
      .breakdown-divider {
        border-top: 1px solid #94a3b8;
      }
      .breakdown-total {
        font-size: 12.5px !important;
        font-weight: 950 !important;
      }
      
      .words-section {
        text-align: right;
        margin-top: 20px;
        font-size: 11px;
      }
      .words-label {
        font-weight: 800;
        color: #475569;
        margin-bottom: 3px;
      }
      .words-value {
        font-weight: 900;
        color: #000;
      }
      
      .signatory-section {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-top: 35px;
        padding-right: 10px;
      }
      .signatory-title {
        font-size: 10px;
        font-weight: 900;
        color: #000;
        text-transform: uppercase;
        text-align: right;
        line-height: 1.4;
      }
      .signatory-space {
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
        .no-print {
          display: none;
        }
      }
    </style>
  </head>
  <body onload="window.print();">
    <div class="container">
      <!-- Header Top Labels -->
      <div class="header-top">
        <div class="tax-invoice-label">TAX INVOICE</div>
        <div class="recipient-badge">__BADGE_TEXT__</div>
      </div>
      
      <!-- Company Info Header -->
      <div class="company-name">__COMPANY_NAME__</div>
      <div class="company-address">__COMPANY_ADDRESS__</div>
      <div class="company-contacts">
        __COMPANY_CONTACTS__
      </div>
      
      <div class="thick-line"></div>
      
      <!-- Invoice Info Banner -->
      <div class="invoice-banner">
        <div>Invoice No.: __INVOICE_NO__</div>
        <div>Invoice Date: __INVOICE_DATE__</div>
      </div>
      
      <!-- Billing / Info Grid -->
      <div class="info-grid">
        <!-- Column 1: Bill To -->
        <div>
          <div class="info-col-title">BILL TO</div>
          <div class="info-col-content">
            <strong>__BILL_TO_NAME__</strong>
            __BILL_TO_ADDRESS__<br/>
            __BILL_TO_MOBILE__
            __BILL_TO_GSTIN__
            __BILL_TO_PAN__
            Place of Supply: Tamil Nadu
          </div>
        </div>
        
        <!-- Column 2: Ship To -->
        <div>
          <div class="info-col-title">SHIP TO</div>
          <div class="info-col-content">
            <strong>__SHIP_TO_NAME__</strong>
            __SHIP_TO_ADDRESS__<br/>
            __SHIP_TO_MOBILE__
            __SHIP_TO_GSTIN__
            Place of Supply: Tamil Nadu
          </div>
        </div>
        
        <!-- Column 3: Permit Details -->
        <div>
          <div class="info-col-title">DETAILS</div>
          <div class="info-col-content" style="padding-top: 2px;">
            <div class="permit-row">
              <span class="permit-label">Security Paper no</span>
              <span class="permit-value">__SECURITY_PAPER_NO__</span>
            </div>
            __BULK_PERMIT_ROW__
            <div class="permit-row">
              <span class="permit-label">VEHICLE NO</span>
              <span class="permit-value">__VEHICLE_NO__</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="text-left" style="width: 45%;">ITEMS</th>
            <th class="text-center" style="width: 12%;">HSN</th>
            <th class="text-center" style="width: 12%;">QTY.</th>
            <th class="text-center" style="width: 10%;">RATE</th>
            <th class="text-center" style="width: 11%;">TAX</th>
            <th class="text-right" style="width: 10%;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          __ITEMS_ROWS__
          
          <!-- Subtotal Row -->
          <tr class="subtotal-row">
            <td class="text-left">SUBTOTAL</td>
            <td></td>
            <td class="text-center">__TOTAL_QTY__</td>
            <td></td>
            <td class="text-center">₹ __TAX_SUBTOTAL__</td>
            <td class="text-right">₹ __GRAND_TOTAL__</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Bottom Section (Bank Details + QR & Breakdown) -->
      <div class="bottom-section">
        <!-- Bank details and QR code -->
        <div>
          <div class="bank-title">BANK DETAILS</div>
          <div class="bank-row">
            <div class="bank-label">Name:</div>
            <div class="bank-val">__BANK_NAME__</div>
          </div>
          <div class="bank-row">
            <div class="bank-label">IFSC Code:</div>
            <div class="bank-val">__BANK_IFSC__</div>
          </div>
          <div class="bank-row">
            <div class="bank-label">Account No:</div>
            <div class="bank-val">__BANK_ACC__</div>
          </div>
          <div class="bank-row">
            <div class="bank-label">Bank:</div>
            <div class="bank-val">__BANK_BRANCH__</div>
          </div>
          
          __QR_SECTION__
        </div>
        
        <!-- Financial breakdown -->
        <div>
          <table class="breakdown-table">
            <tr>
              <td>Taxable Amount</td>
              <td class="val">₹ __BREAKDOWN_SUBTOTAL__</td>
            </tr>
            <tr>
              <td>CGST @2.5%</td>
              <td class="val">₹ __BREAKDOWN_CGST__</td>
            </tr>
            <tr>
              <td>SGST @2.5%</td>
              <td class="val">₹ __BREAKDOWN_SGST__</td>
            </tr>
            <tr class="breakdown-divider">
              <td class="breakdown-total" style="padding-top: 8px;">Total Amount</td>
              <td class="val breakdown-total" style="padding-top: 8px;">₹ __BREAKDOWN_TOTAL__</td>
            </tr>
            <tr class="breakdown-divider">
              <td style="padding-top: 6px; color: #475569;">Received Amount</td>
              <td class="val" style="padding-top: 6px; color: #000;">₹ __BREAKDOWN_PAID__</td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Amount in words -->
      <div class="words-section">
        <div class="words-label">Total Amount (in words)</div>
        <div class="words-value">__AMOUNT_IN_WORDS__</div>
      </div>
      
      <!-- Authorised Signatory Block -->
      <div class="signatory-section">
        <div class="signatory-title">
          __SIGNATORY_CO__
        </div>
        <div class="signatory-space">
          __SIGNATORY_SVG__
        </div>
        <div class="signatory-title">
          __SIGNATORY_TEXT__
        </div>
      </div>
    </div>
  </body>
</html>
`;

const printGstInvoice = async (inv: Invoice, copyType: 'original' | 'duplicate' | 'triplicate' = 'original') => {
  const toastId = toast.info('Preparing invoice for print...', { autoClose: false });
  try {
    // 1. Resolve Company Details from prefix first, then override from notes if present
    let companyId: CompanyId = inv.invoice_number.startsWith('KVS') ? 'kvs' : 'sbbm';
    let securityPaperNo = '';
    let bulkPermitNo = '';
    let customerGstin = '';

    if (inv.notes) {
      try {
        const parsedNotes = JSON.parse(inv.notes);
        if (parsedNotes.company_id) {
          companyId = parsedNotes.company_id;
        }
        securityPaperNo = parsedNotes.security_paper_no || '';
        bulkPermitNo = parsedNotes.bulk_permit_no || '';
        customerGstin = parsedNotes.customer_gstin || '';
      } catch {
        // Ignore parsing error
      }
    }

    const company = getCompanyDetails(companyId);

    // 2. Fetch Customer Details for Billing address, PAN and Mobile
    let billingAddress = '';
    let customerMobile = '';
    let customerPan = '';

    if (inv.customer_id) {
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', inv.customer_id)
        .single();
      
      if (custData) {
        billingAddress = custData.billing_address || custData.address || '';
        customerMobile = custData.phone || '';
        customerGstin = custData.gst_number || customerGstin || '';
        if (customerGstin && customerGstin.length >= 12) {
          customerPan = customerGstin.substring(2, 12);
        }
      }
    }

    // Parse items
    let parsedItems: any[] = [];
    try {
      parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
    } catch (e) {
      console.error('Error parsing items:', e);
    }

    // Calculate totals
    const totalQty = parsedItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print invoice');
      toast.dismiss(toastId);
      return;
    }

    // UPI Details
    const showQrCode = companyId === 'sbbm';
    const qrCodeUrl = showQrCode 
      ? 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent('upi://pay?pa=' + (company as any).upi_id + '&pn=' + encodeURIComponent(company.name) + '&am=' + inv.total_amount + '&cu=INR')
      : '';

    // Generate Signature SVG
    const signatureSvg = 
      '<svg width="120" height="50" viewBox="0 0 120 50">' +
        '<path d="M 15 35 C 30 15, 35 10, 42 28 C 50 35, 65 35, 75 25 C 80 18, 92 10, 95 28 C 98 33, 108 30, 115 25" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    // Number to words
    const amountInWords = numberToWords(inv.total_amount);

    let badgeText = 'ORIGINAL FOR RECIPIENT';
    if (copyType === 'duplicate') {
      badgeText = 'DUPLICATE FOR TRANSPORTER';
    } else if (copyType === 'triplicate') {
      badgeText = 'TRIPLICATE FOR SUPPLIER';
    }

    const companyContactsHtml = 
      (company.mobile ? '<span><strong>Mobile:</strong> ' + escapeHtml(company.mobile) + '</span>' : '') +
      '<span><strong>GSTIN:</strong> ' + escapeHtml(company.gstin) + '</span>' +
      '<span><strong>PAN Number:</strong> ' + escapeHtml(company.pan) + '</span>' +
      '<span><strong>Email:</strong> ' + escapeHtml(company.email) + '</span>';

    const invoiceNoHtml = escapeHtml(inv.invoice_number.split('-').pop());
    const invoiceDateHtml = escapeHtml(formatDate(inv.invoice_date));

    const billingAddressHtml = billingAddress ? escapeHtml(billingAddress).replace(/\n/g, '<br/>') : 'Address not specified';
    const customerMobileHtml = customerMobile ? 'Mobile: ' + escapeHtml(customerMobile) + '<br/>' : '';
    const customerGstinHtml = customerGstin ? 'GSTIN: ' + escapeHtml(customerGstin) + '<br/>' : '';
    const customerPanHtml = customerPan ? 'PAN Number: ' + escapeHtml(customerPan) + '<br/>' : '';

    const bulkPermitRowHtml = bulkPermitNo 
      ? '<div class="permit-row"><span class="permit-label">BULK PERMIT NO</span><span class="permit-value">' + escapeHtml(bulkPermitNo) + '</span></div>'
      : '';

    const itemsRowsHtml = parsedItems.map((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const inclRate = parseFloat(item.price || item.rate) || 0;
      const discount = parseFloat(item.discount_rs || item.discount || 0);
      const baseTaxable = (qty * inclRate - discount) / 1.05;
      const calculatedRate = baseTaxable / qty;
      const taxVal = baseTaxable * 0.05;
      const lineTotal = qty * inclRate - discount;
      
      return '<tr>' +
        '<td class="text-left">' + escapeHtml(item.material || item.material_name) + '</td>' +
        '<td class="text-center">' + escapeHtml(item.hsn || '-') + '</td>' +
        '<td class="text-center">' + qty + ' MTON</td>' +
        '<td class="text-center">' + calculatedRate.toFixed(2) + '</td>' +
        '<td class="text-center">' +
          taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
          '<div style="font-size: 8px; color: #475569; font-weight: normal; margin-top: 1px;">(5%)</div>' +
        '</td>' +
        '<td class="text-right">' + lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</td>' +
      '</tr>';
    }).join('');

    const qrSectionHtml = showQrCode 
      ? '<div class="qr-section">' +
          '<img class="qr-code-img" src="' + escapeHtml(qrCodeUrl) + '" alt="Payment QR Code"/>' +
          '<div class="qr-details">' +
            '<div class="qr-title">PAYMENT QR CODE</div>' +
            '<div class="qr-upi-id">UPI ID: ' + escapeHtml((company as any).upi_id) + '</div>' +
            '<div class="qr-logos">' +
              '<span class="qr-logo-badge phonepe">PhonePe</span>' +
              '<span class="qr-logo-badge gpay">GPay</span>' +
              '<span class="qr-logo-badge paytm">Paytm</span>' +
              '<span class="qr-logo-badge upi">UPI</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '';

    const signatoryCoHtml = companyId === 'kvs' ? 'For KVS SUBRAHMANYAM' : '';
    const signatoryTextHtml = companyId === 'kvs' 
      ? 'AUTHORISED SIGNATORY.' 
      : 'AUTHORISED SIGNATORY FOR<br/>SRI BABA BLUE METALS PRIVATE LIMITED';

    const finalHtml = GST_INVOICE_TEMPLATE
      .replace(/__BADGE_TEXT__/g, escapeHtml(badgeText))
      .replace(/__INVOICE_NUMBER__/g, escapeHtml(inv.invoice_number))
      .replace(/__COMPANY_NAME__/g, escapeHtml(company.name))
      .replace(/__COMPANY_ADDRESS__/g, escapeHtml(company.address))
      .replace(/__COMPANY_CONTACTS__/g, companyContactsHtml)
      .replace(/__INVOICE_NO__/g, invoiceNoHtml)
      .replace(/__INVOICE_DATE__/g, invoiceDateHtml)
      .replace(/__BILL_TO_NAME__/g, escapeHtml(inv.customer_name.toUpperCase()))
      .replace(/__BILL_TO_ADDRESS__/g, billingAddressHtml)
      .replace(/__BILL_TO_MOBILE__/g, customerMobileHtml)
      .replace(/__BILL_TO_GSTIN__/g, customerGstinHtml)
      .replace(/__BILL_TO_PAN__/g, customerPanHtml)
      .replace(/__SHIP_TO_NAME__/g, escapeHtml(inv.customer_name.toUpperCase()))
      .replace(/__SHIP_TO_ADDRESS__/g, billingAddressHtml)
      .replace(/__SHIP_TO_MOBILE__/g, customerMobileHtml)
      .replace(/__SHIP_TO_GSTIN__/g, customerGstinHtml)
      .replace(/__SECURITY_PAPER_NO__/g, escapeHtml(securityPaperNo || '-'))
      .replace(/__BULK_PERMIT_ROW__/g, bulkPermitRowHtml)
      .replace(/__VEHICLE_NO__/g, escapeHtml(inv.vehicle_no || '-'))
      .replace(/__ITEMS_ROWS__/g, itemsRowsHtml)
      .replace(/__TOTAL_QTY__/g, String(totalQty))
      .replace(/__TAX_SUBTOTAL__/g, inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      .replace(/__GRAND_TOTAL__/g, inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }))
      .replace(/__BANK_NAME__/g, escapeHtml(company.bank_name))
      .replace(/__BANK_IFSC__/g, escapeHtml(company.bank_ifsc))
      .replace(/__BANK_ACC__/g, escapeHtml(company.bank_acc))
      .replace(/__BANK_BRANCH__/g, escapeHtml(company.bank_branch))
      .replace(/__QR_SECTION__/g, qrSectionHtml)
      .replace(/__BREAKDOWN_SUBTOTAL__/g, inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      .replace(/__BREAKDOWN_CGST__/g, (inv.tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      .replace(/__BREAKDOWN_SGST__/g, (inv.tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      .replace(/__BREAKDOWN_TOTAL__/g, inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }))
      .replace(/__BREAKDOWN_PAID__/g, (inv.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }))
      .replace(/__AMOUNT_IN_WORDS__/g, escapeHtml(amountInWords))
      .replace(/__SIGNATORY_CO__/g, signatoryCoHtml)
      .replace(/__SIGNATORY_SVG__/g, signatureSvg)
      .replace(/__SIGNATORY_TEXT__/g, signatoryTextHtml);

    printWindow.document.write(finalHtml);
    printWindow.document.close();
    toast.dismiss(toastId);
  } catch (err: any) {
    console.error('Error preparing print:', err);
    toast.error('Failed to prepare invoice print');
    toast.dismiss(toastId);
  }
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  company: string;
  gst_number: string;
  billing_address: string;
}

interface PriceMaster {
  id: string;
  product_type: string;
  sales_price: number;
  hsn: string;
  gst_rate: number;
  is_tax_inclusive?: boolean;
  inclusive_price?: number;
}

interface LineItem {
  id: string;
  material: string;
  hsn: string;
  quantity: string;
  price: string;
  discountRs: string;
  discountPct: string;
  taxRate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id?: string;
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
  created_at: string;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function GstSalesModule() {
  const [activeTab, setActiveTab] = useState<'create' | 'report'>('create');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  const handleEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingInvoice(null);
    setActiveTab('report');
  };

  const triggerPrint = (copy: 'original' | 'duplicate' | 'triplicate') => {
    if (invoiceToPrint) {
      printGstInvoice(invoiceToPrint, copy);
    }
  };

  const triggerPrintAll = async () => {
    if (invoiceToPrint) {
      // Print Original
      printGstInvoice(invoiceToPrint, 'original');
      // Print Duplicate
      setTimeout(() => {
        printGstInvoice(invoiceToPrint!, 'duplicate');
      }, 500);
      // Print Triplicate
      setTimeout(() => {
        printGstInvoice(invoiceToPrint!, 'triplicate');
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit shadow-inner">
        <button
          onClick={() => {
            setEditingInvoice(null);
            setActiveTab('create');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'create' && !editingInvoice
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          {t('Create Invoice')}
        </button>
        {editingInvoice && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-black text-xs uppercase tracking-widest shadow-sm">
            <Receipt className="w-3.5 h-3.5" />
            {t('Edit:')} {editingInvoice.invoice_number}
          </div>
        )}
        <button
          onClick={() => {
            setEditingInvoice(null);
            setActiveTab('report');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'report'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" />
          {t('GST Report')}
        </button>
      </div>

      {activeTab === 'create' ? (
        <GstInvoiceCreator
          initialData={editingInvoice || undefined}
          onSaved={() => {
            setEditingInvoice(null);
            setActiveTab('report');
          }}
          onCancel={editingInvoice ? handleCancelEdit : undefined}
          onPrintRequest={(inv) => setInvoiceToPrint(inv)}
        />
      ) : (
        <GstReportViewer onEdit={handleEdit} onPrintRequest={(inv) => setInvoiceToPrint(inv)} />
      )}

      {/* ── Print Selection Modal ── */}
      {invoiceToPrint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden p-6 md:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('Print Invoice Copies')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('GST BILL Snapshots')}</p>
                </div>
              </div>
              <button
                onClick={() => setInvoiceToPrint(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">{t('Close')}</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                <span>{t('Invoice No:')}</span>
                <span className="text-slate-800 font-extrabold">{invoiceToPrint.invoice_number}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                <span>{t('Customer:')}</span>
                <span className="text-slate-800 font-extrabold">{invoiceToPrint.customer_name}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>{t('Total Amount:')}</span>
                <span className="text-indigo-600 font-black">₹{invoiceToPrint.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  triggerPrint('original');
                  setInvoiceToPrint(null);
                }}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-2xl transition-all duration-200 group text-left shadow-sm hover:shadow"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">{t('Original Copy')}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('For Recipient')}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-indigo-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => {
                  triggerPrint('duplicate');
                  setInvoiceToPrint(null);
                }}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-2xl transition-all duration-200 group text-left shadow-sm hover:shadow"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-900 tracking-tight group-hover:text-amber-600 transition-colors">{t('Duplicate Copy')}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('For Transporter')}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-amber-100 flex items-center justify-center text-slate-400 group-hover:text-amber-600 transition-colors">
                  <Truck className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => {
                  triggerPrint('triplicate');
                  setInvoiceToPrint(null);
                }}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-2xl transition-all duration-200 group text-left shadow-sm hover:shadow"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors">{t('Triplicate Copy')}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('For Supplier')}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
              </button>

              <div className="pt-2 border-t border-slate-100 mt-2">
                <button
                  onClick={() => {
                    triggerPrintAll();
                    setInvoiceToPrint(null);
                  }}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all duration-200 shadow-lg shadow-slate-200 hover:shadow active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" /> {t('Print All 3 Copies')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Creator ──────────────────────────────────────────────────────────
function GstInvoiceCreator({
  initialData,
  onSaved,
  onCancel,
  onPrintRequest,
}: {
  initialData?: Invoice;
  onSaved: () => void;
  onCancel?: () => void;
  onPrintRequest?: (inv: Invoice) => void;
}) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyId>('sbbm');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [generatingNumber, setGeneratingNumber] = useState(false);

  // Customer
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerGst, setCustomerGst] = useState('');

  // Price master
  const [priceMaster, setPriceMaster] = useState<PriceMaster[]>([]);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      material: '',
      hsn: '',
      quantity: '',
      price: '',
      discountRs: '0',
      discountPct: '0',
      taxRate: 5,
    },
  ]);

  // Extra fields
  const [securityPaperNo, setSecurityPaperNo] = useState('');
  const [bulkPermitNo, setBulkPermitNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const [saving, setSaving] = useState(false);

  // ── Fetch customers and price master ────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const [{ data: customerData }, { data: priceData }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, company, gst_number, billing_address')
          .order('name'),
        supabase
          .from('material_investors')
          .select('id, product_type, sales_price, hsn, gst_rate, is_tax_inclusive')
          .eq('status', 'active')
          .order('product_type'),
      ]);
      if (customerData) setCustomers(customerData);
      if (priceData) {
        const mapped = (priceData as any[]).map((item) => {
          const salesPrice = parseFloat(item.sales_price) || 0;
          const gstRate = parseFloat(item.gst_rate) || 5;
          const isInclusive = !!item.is_tax_inclusive;
          const incPrice = isInclusive ? salesPrice : salesPrice * (1 + gstRate / 100);
          return {
            ...item,
            inclusive_price: Number(incPrice.toFixed(2)),
          };
        });
        setPriceMaster(mapped);
      }
    };
    fetchData();
  }, []);

  // ── Pre-populate when initialData changes ────────────────────────────────────
  useEffect(() => {
    if (initialData) {
      setInvoiceDate(initialData.invoice_date || '');
      setInvoiceNumber(initialData.invoice_number || '');
      setSelectedCustomerId(initialData.customer_id || null);
      setCustomerName(initialData.customer_name || '');
      setVehicleNo(initialData.vehicle_no || '');

      // Parse items
      try {
        const itemsData = typeof initialData.items === 'string'
          ? JSON.parse(initialData.items)
          : initialData.items;
        if (Array.isArray(itemsData)) {
          const mapped = itemsData.map((item: any) => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.rate || item.price) || 0;
            const baseAmount = qty * price;
            const discountRs = parseFloat(item.discount_rs || item.discount) || 0;
            const discountPct = baseAmount > 0 ? ((discountRs / baseAmount) * 100).toFixed(2) : '0';
            return {
              id: item.id || crypto.randomUUID(),
              material: item.material || item.material_name || '',
              hsn: item.hsn || '',
              quantity: String(item.quantity || ''),
              price: String(item.rate || item.price || ''),
              discountRs: String(discountRs),
              discountPct: discountPct,
              taxRate: 5,
            };
          });
          setLineItems(mapped);
        }
      } catch (e) {
        console.error('Error parsing items in initialData:', e);
      }

      // Parse notes
      if (initialData.notes) {
        try {
          const parsed = typeof initialData.notes === 'string'
            ? JSON.parse(initialData.notes)
            : initialData.notes;
          if (parsed.company_id) setSelectedCompany(parsed.company_id);
          if (parsed.security_paper_no) setSecurityPaperNo(parsed.security_paper_no);
          if (parsed.bulk_permit_no) setBulkPermitNo(parsed.bulk_permit_no);
          if (parsed.customer_gstin) setCustomerGst(parsed.customer_gstin);
        } catch (e) {
          console.error('Error parsing notes in initialData:', e);
        }
      }
    }
  }, [initialData]);

  // ── Generate invoice number whenever company changes ────────────────────────
  useEffect(() => {
    if (!initialData) {
      generateInvoiceNumber(selectedCompany);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, initialData]);

  const generateInvoiceNumber = async (companyId: CompanyId) => {
    setGeneratingNumber(true);
    try {
      const year = new Date().getFullYear();
      const prefix = getCompanyDetails(companyId).prefix;
      const { data } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `${prefix}-${year}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (data && data.length > 0) {
        const parts = data[0].invoice_number.split('-');
        const lastVal = parts.slice(-1)[0];
        const last = lastVal ? parseInt(lastVal) : NaN;
        if (!isNaN(last)) nextNum = last + 1;
      }
      setInvoiceNumber(`${prefix}-${year}-${String(nextNum).padStart(3, '0')}`);
    } catch (err) {
      console.error('Error generating invoice number:', err);
    } finally {
      setGeneratingNumber(false);
    }
  };

  // ── Line item helpers ───────────────────────────────────────────────────────
  const addItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        material: '',
        hsn: '',
        quantity: '',
        price: '',
        discountRs: '0',
        discountPct: '0',
        taxRate: 5,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };

        // Keep discount Rs ↔ Pct in sync
        const baseAmount =
          (parseFloat(merged.quantity) || 0) * (parseFloat(merged.price) || 0);

        if ('discountRs' in updates && updates.discountRs !== undefined) {
          const dRs = parseFloat(updates.discountRs) || 0;
          merged.discountPct =
            baseAmount > 0 ? ((dRs / baseAmount) * 100).toFixed(2) : '0';
        } else if ('discountPct' in updates && updates.discountPct !== undefined) {
          const dPct = parseFloat(updates.discountPct) || 0;
          merged.discountRs = ((dPct / 100) * baseAmount).toFixed(2);
        }

        return merged;
      })
    );
  };

  const selectMaterial = (itemId: string, material: string) => {
    const pm = priceMaster.find((p) => p.product_type === material);
    updateItem(itemId, {
      material,
      hsn: pm?.hsn || '',
      price: pm ? String(pm.inclusive_price) : '',
      taxRate: pm?.gst_rate || 5,
    });
  };

  // ── Per-line calculations ───────────────────────────────────────────────────
  const calcItem = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;           // GST-inclusive price per MT
    const discountRs = parseFloat(item.discountRs) || 0;
    const grossInclusive = qty * price;                   // Total inclusive of GST, before discount
    const afterDiscount = Math.max(0, grossInclusive - discountRs); // Inclusive total after discount
    const taxableAmount = afterDiscount / 1.05;           // Back-calculate base (excl. GST)
    const cgst = taxableAmount * 0.025;                   // CGST @ 2.5%
    const sgst = taxableAmount * 0.025;                   // SGST @ 2.5%
    const lineTotal = afterDiscount;                      // = taxableAmount * 1.05
    return { qty, price, grossInclusive, discountRs, taxableAmount, cgst, sgst, lineTotal };
  };

  // ── Invoice totals ──────────────────────────────────────────────────────────
  const totals = lineItems.reduce(
    (acc, item) => {
      const c = calcItem(item);
      acc.subtotal += c.taxableAmount;
      acc.cgst += c.cgst;
      acc.sgst += c.sgst;
      acc.grandTotal += c.lineTotal;
      acc.totalDiscount += c.discountRs;
      acc.netWeight += c.qty;
      return acc;
    },
    { subtotal: 0, cgst: 0, sgst: 0, grandTotal: 0, totalDiscount: 0, netWeight: 0 }
  );

  // ── Save invoice ────────────────────────────────────────────────────────────
  const handleSave = async (shouldPrint = false) => {
    if (!customerName.trim()) {
      toast.error('Please select a customer');
      return;
    }
    if (lineItems.every((i) => !i.material)) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      const company = getCompanyDetails(selectedCompany);

      const detailedItems = lineItems
        .filter((i) => i.material)
        .map((item) => {
          const c = calcItem(item);
          return {
            material: item.material,
            material_name: item.material,
            hsn: item.hsn,
            quantity: c.qty,
            rate: c.price,
            amount: parseFloat(c.lineTotal.toFixed(2)),
            discount_rs: c.discountRs,
            cgst: parseFloat(c.cgst.toFixed(2)),
            sgst: parseFloat(c.sgst.toFixed(2)),
            taxable_amount: parseFloat(c.taxableAmount.toFixed(2)),
          };
        });

      const uuid = initialData?.id || crypto.randomUUID();
      const payload = {
        id: uuid,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: invoiceDate,
        customer_id: selectedCustomerId,
        customer_name: customerName,
        vehicle_no: vehicleNo || null,
        material_name: lineItems
          .filter((i) => i.material)
          .map((i) => i.material)
          .join(', '),
        material_rate: parseFloat(lineItems[0]?.price) || 0,
        empty_weight: 0,
        gross_weight: 0,
        net_weight: parseFloat(totals.netWeight.toFixed(3)),
        subtotal: parseFloat(totals.subtotal.toFixed(2)),
        tax_rate: 5,
        tax_amount: parseFloat((totals.cgst + totals.sgst).toFixed(2)),
        total_amount: parseFloat(totals.grandTotal.toFixed(2)),
        amount_paid: initialData?.amount_paid || 0,
        status: initialData?.status || 'unpaid',
        payment_history: initialData?.payment_history || '[]',
        items: JSON.stringify(detailedItems),
        notes: JSON.stringify({
          company_id: selectedCompany,
          company_name: company.name,
          company_gstin: company.gstin,
          customer_gstin: customerGst,
          security_paper_no: securityPaperNo,
          bulk_permit_no: bulkPermitNo,
          invoice_type: 'gst_invoice',
        }),
      };

      const query = initialData?.id
        ? supabase.from('invoices').update(payload).eq('id', initialData.id)
        : supabase.from('invoices').insert([payload]);

      const { error } = await query;
      if (error) throw error;

      // ── Auto-register vehicle in customer_vehicles table ──────────────────
      if (vehicleNo && vehicleNo.trim()) {
        const normalizedVehicle = vehicleNo.trim().toUpperCase();
        try {
          // Check if this vehicle already exists
          const { data: existingVehicle } = await supabase
            .from('customer_vehicles')
            .select('id')
            .eq('vehicle_number', normalizedVehicle)
            .maybeSingle();

          if (!existingVehicle) {
            // Insert as a new vehicle linked to the customer
            await supabase
              .from('customer_vehicles')
              .insert([{
                vehicle_number: normalizedVehicle,
                owner_name: customerName || 'Unknown',
                vehicle_type: '10 wheeler tipper',
                updated_at: new Date().toISOString(),
              }]);
          }
        } catch (vehicleErr) {
          // Non-blocking: don't fail the invoice save if vehicle registration fails
          console.warn('Auto-register vehicle warning:', vehicleErr);
        }
      }

      toast.success(`GST Invoice ${invoiceNumber} ${initialData ? 'updated' : 'saved'} successfully!`);

      if (shouldPrint) {
        const invoiceObj = {
          ...payload,
          id: initialData?.id || '',
          created_at: initialData?.created_at || new Date().toISOString(),
        } as unknown as Invoice;
        if (onPrintRequest) {
          onPrintRequest(invoiceObj);
        } else {
          printGstInvoice(invoiceObj);
        }
      }

      onSaved();
    } catch (err: any) {
      toast.error(`Failed to ${initialData ? 'update' : 'save'} invoice: ` + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-300">


      {/* ── 1. Company Selector ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(COMPANIES) as CompanyId[]).map((compId) => {
          const co = getCompanyDetails(compId);
          const isSelected = selectedCompany === compId;
          return (
            <button
              key={compId}
              type="button"
              onClick={() => setSelectedCompany(compId)}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
                isSelected
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-lg shadow-indigo-100/60'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                isSelected ? 'bg-indigo-600 shadow-md shadow-indigo-300' : 'bg-slate-100 group-hover:bg-indigo-100'
              }`}>
                <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              </div>
              <p className={`font-black text-sm leading-snug ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                {co.name}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                {t('GSTIN:')} {co.gstin}
              </p>
              {isSelected && (
                <div className="absolute top-3.5 right-3.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 2. Invoice Header (Number + Date) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              {t('Invoice Number')}
            </label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
              generatingNumber ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10'
            } transition-all`}>
              {generatingNumber ? (
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
              )}
              <input
                type="text"
                value={generatingNumber ? 'Generating...' : invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={generatingNumber}
                className="flex-1 font-black text-slate-700 text-sm tracking-wide bg-transparent outline-none disabled:text-slate-400"
                placeholder="Invoice Number"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              {t('Invoice Date')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Bill To + Security / Permit / Vehicle ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">
          {t('Bill To')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="relative flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{t('Customer Name *')}</label>
              <CustomerDropdown
                customers={customers}
                value={customerName}
                onSelect={(cust) => {
                  setSelectedCustomerId(cust.id);
                  setCustomerName(cust.name || cust.company);
                  setCustomerGst(cust.gst_number || '');
                }}
              />
            </div>
            <div className="relative flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{t('Customer GSTIN')}</label>
              <input
                type="text"
                value={customerGst}
                onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                placeholder="Auto-filled from customer record"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-700 uppercase bg-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{t('Security Paper No.')}</label>
              <input
                type="text"
                value={securityPaperNo}
                onChange={(e) => setSecurityPaperNo(e.target.value)}
                placeholder="Enter security paper number"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{t('Bulk Permit No.')}</label>
              <input
                type="text"
                value={bulkPermitNo}
                onChange={(e) => setBulkPermitNo(e.target.value)}
                placeholder="Enter bulk permit number"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{t('Vehicle No.')}</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. TN 33 AB 1234"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-700 uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>
      </div>

      {/* ── 4. Line Items ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {t('Items')}
          </span>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-indigo-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{t('Item')}</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('HSN')}</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Qty (MTON)')}</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Price / MT')}</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  {t('Discount (₹ / %)')}
                </th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Tax')}</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('Amount (₹)')}</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lineItems.map((item) => {
                const c = calcItem(item);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/20 transition-colors"
                  >
                    {/* Item select */}
                    <td className="px-4 py-3.5">
                      <MaterialDropdown
                        priceMaster={priceMaster}
                        value={item.material}
                        onSelect={(mat) => selectMaterial(item.id, mat)}
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => updateItem(item.id, { hsn: e.target.value })}
                        placeholder="HSN"
                        className="w-full px-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                        placeholder="0.000"
                        className="w-full px-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                      />
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(item.id, { price: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-black text-indigo-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                        />
                      </div>
                    </td>

                    {/* Discount Rs + Pct (linked) */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {/* Rs */}
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountRs}
                            onChange={(e) => updateItem(item.id, { discountRs: e.target.value })}
                            className="w-full pl-5 pr-1.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 outline-none transition-all"
                          />
                        </div>
                        <span className="text-[10px] text-slate-300 font-black shrink-0">|</span>
                        {/* Pct */}
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPct}
                            onChange={(e) => updateItem(item.id, { discountPct: e.target.value })}
                            className="w-full pl-1.5 pr-5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 outline-none transition-all"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">%</span>
                        </div>
                      </div>
                    </td>

                    {/* Tax amount */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100">
                        5%
                      </span>
                      {(c.cgst + c.sgst) > 0 && (
                        <p className="text-[10px] font-black text-indigo-700 mt-1">
                          ₹{(c.cgst + c.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-black text-slate-900 leading-tight">
                        ₹{c.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {c.discountRs > 0 && (
                        <p className="text-[9px] font-bold text-amber-500 mt-0.5">
                          -{c.discountRs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3.5">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Totals Summary ── */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 border-t border-slate-100 bg-slate-50/50">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Taxable Amount')}</span>
            <span className="text-sm font-bold text-slate-800">Rs. {totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('Total Discount')}</span>
            <span className="text-sm font-bold text-rose-500">- Rs. {totals.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('CGST @ 2.5%')}</span>
            <span className="text-sm font-bold text-slate-700">Rs. {totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('SGST @ 2.5%')}</span>
            <span className="text-sm font-bold text-slate-700">Rs. {totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white p-6 rounded-2xl flex justify-between items-center shadow-md">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">{t('Grand Total')}</span>
            <span className="text-xl font-black text-white">Rs. {totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* ── Save Buttons ── */}
      <div className="flex justify-end gap-3 pb-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl transition-all"
          >
            {t('Cancel Edit')}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Printer className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : initialData ? 'Update & Print' : 'Save & Print'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-200 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Receipt className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : initialData ? 'Update GST Invoice' : 'Save GST Invoice'}
        </button>
      </div>
    </div>
  );
}

// ─── Customer Dropdown ────────────────────────────────────────────────────────
function CustomerDropdown({
  customers,
  value,
  onSelect,
}: {
  customers: Customer[];
  value: string;
  onSelect: (c: Customer) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = customers.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
          isOpen
            ? 'border-indigo-500 ring-4 ring-indigo-500/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={`text-sm font-bold truncate ${value ? 'text-slate-800' : 'text-slate-400 font-normal'}`}>
          {value || 'Search and select customer...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Type to search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 transition-colors ${
                    value === c.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <p className="text-sm font-bold leading-tight">{c.name}</p>
                  {c.company && (
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {c.company}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <li className="px-4 py-3 text-xs font-bold text-slate-400 italic text-center">{t('No customers found')}</li>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Material Dropdown ────────────────────────────────────────────────────────
function MaterialDropdown({
  priceMaster,
  value,
  onSelect,
}: {
  priceMaster: PriceMaster[];
  value: string;
  onSelect: (material: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = priceMaster.filter((p) =>
    p.product_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-2 border-2 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/10'
            : 'border-slate-100 hover:border-slate-300'
        }`}
      >
        <span className={`text-xs font-bold truncate ${value ? 'text-slate-800' : 'text-slate-400 font-normal'}`}>
          {value || 'Select item...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-56 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelect(p.product_type);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2.5 text-xs cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2 ${
                    value === p.product_type
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 font-medium'
                  }`}
                >
                  <span className="truncate">{p.product_type}</span>
                  <span className="shrink-0 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    ₹{p.inclusive_price}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center">
                <li className="px-4 py-3 text-xs font-bold text-slate-400 italic text-center">{t('No items found')}</li>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report Viewer (existing functionality preserved) ─────────────────────────
function GstReportViewer({ onEdit, onPrintRequest }: { onEdit: (inv: Invoice) => void; onPrintRequest?: (inv: Invoice) => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this GST invoice?')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('GST Invoice deleted successfully!');
      fetchGstInvoices();
    } catch (err: any) {
      toast.error('Failed to delete invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const fetchGstInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gt('tax_rate', 0)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter to ONLY include official GST invoices created by GstSalesModule
      const gstInvoices = (data || []).filter((inv) => {
        try {
          const parsed = JSON.parse(inv.notes || '{}');
          return parsed && parsed.invoice_type === 'gst_invoice';
        } catch {
          return false;
        }
      });

      setInvoices(gstInvoices);
    } catch (err) {
      console.error('Error fetching GST invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchGstInvoices();
  }, [fetchGstInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.vehicle_no && inv.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.delivery_location &&
        inv.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && inv.status === statusFilter;
  });

  const stats = filteredInvoices.reduce(
    (acc, inv) => {
      acc.totalGross += inv.total_amount || 0;
      acc.totalSubtotal += inv.subtotal || 0;
      acc.totalTax += inv.tax_amount || 0;
      acc.totalPaid += inv.amount_paid || 0;
      acc.totalDue += (inv.total_amount - inv.amount_paid) || 0;
      return acc;
    },
    { totalGross: 0, totalSubtotal: 0, totalTax: 0, totalPaid: 0, totalDue: 0 }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'partial': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'unpaid': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getMaterialDetails = (itemsJson: string) => {
    try {
      const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      if (Array.isArray(items)) {
        return items
          .map((i: any) => `${i.material || i.material_name || ''} (${(i.quantity || 0).toFixed(2)} MT)`)
          .join(', ');
      }
    } catch {
      // Ignore parsing error and fallback
    }
    return '-';
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('GST Sales');
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.addRow([]);
    worksheet.addRow(['SRI BABA BLUE METALS PVT LTD']).font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow(['GST Sales Report']).font = { size: 12, bold: true, color: { argb: 'FF475569' } };
    worksheet.addRow([`Period: ${format(parseISO(startDate), 'dd-MM-yyyy')} to ${format(parseISO(endDate), 'dd-MM-yyyy')}`]).font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headers = ['Sl No', 'Invoice No', 'Date', 'Customer Name', 'Vehicle No', 'Materials (Qty)', 'Subtotal (Excl. GST)', 'GST (5%)', 'Gross Amount', 'Paid', 'Due Amount', 'Status'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    filteredInvoices.forEach((inv, index) => {
      const row = worksheet.addRow([
        index + 1, inv.invoice_number, format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
        inv.customer_name, inv.vehicle_no || '-', getMaterialDetails(inv.items),
        inv.subtotal, inv.tax_amount, inv.total_amount, inv.amount_paid,
        inv.total_amount - inv.amount_paid, inv.status.toUpperCase(),
      ]);
      row.eachCell((cell, colIndex) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        if (colIndex >= 7 && colIndex <= 11) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
        if (colIndex === 1 || colIndex === 3 || colIndex === 12) { cell.alignment = { horizontal: 'center' }; }
      });
    });
    const totalRowIndex = worksheet.lastRow!.number + 1;
    const totalsRow = worksheet.addRow(['Total', '', '', '', '', '',
      { formula: `=SUM(G6:G${totalRowIndex - 1})` }, { formula: `=SUM(H6:H${totalRowIndex - 1})` },
      { formula: `=SUM(I6:I${totalRowIndex - 1})` }, { formula: `=SUM(J6:J${totalRowIndex - 1})` },
      { formula: `=SUM(K6:K${totalRowIndex - 1})` }, '']);
    totalsRow.eachCell((cell, colIndex) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'double' } };
      if (colIndex >= 7 && colIndex <= 11) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
    });
    worksheet.columns.forEach((col, index) => {
      if (index === 0) col.width = 8; else if (index === 1) col.width = 16;
      else if (index === 2) col.width = 14; else if (index === 3) col.width = 28;
      else if (index === 4) col.width = 16; else if (index === 5) col.width = 38;
      else if (index >= 6 && index <= 10) col.width = 18; else if (index === 11) col.width = 14;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Sales_Report_${startDate}_to_${endDate}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('SRI BABA BLUE METALS PVT LTD', 14, 15);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(t('GST Sales Ledger'), 14, 21);
    doc.text(t('Comprehensive 5% GST billing insights'), 14, 26);
    const tableRows = filteredInvoices.map((inv, index) => [
      index + 1, inv.invoice_number, format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
      inv.customer_name, inv.vehicle_no || '-', getMaterialDetails(inv.items),
      `Rs. ${inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      inv.status.toUpperCase(),
    ]);
    tableRows.push(['Total', '', '', '', '', '',
      `Rs. ${stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']);
    autoTable(doc, {
      head: [['Sl No', 'Invoice No', 'Date', 'Customer', 'Vehicle No', 'Materials', 'Subtotal', 'GST (5%)', 'Gross Amt', 'Paid', 'Due', 'Status']],
      body: tableRows, startY: 32, theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 }, 1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 18 }, 3: { cellWidth: 45 }, 4: { cellWidth: 20 },
        5: { cellWidth: 55 }, 6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
        11: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save(`GST_Sales_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transform -rotate-3">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{t('GST Sales Ledger')}</h3>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{t('Comprehensive 5% GST billing insights')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <span className="text-slate-500 font-black text-xs">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <button onClick={exportToExcel} disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" /> EXCEL
            </button>
            <button onClick={exportToPDF} disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-950 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Gross Sales', value: stats.totalGross, icon: FileText, color: 'blue', sub: `(${filteredInvoices.length} invoices)` },
          { label: 'Taxable Subtotal', value: stats.totalSubtotal, icon: Calculator, color: 'teal', sub: 'EXCLUDING GST' },
          { label: 'GST Collected', value: stats.totalTax, icon: TrendingUp, color: 'indigo', sub: '5% Tax Share' },
          { label: 'Amount Paid', value: stats.totalPaid, icon: CheckCircle, color: 'emerald', sub: 'Cleared Payments' },
          { label: 'Balance Due', value: stats.totalDue, icon: ShieldAlert, color: 'rose', sub: 'Pending Receivable' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2.5 text-slate-400 mb-3">
                <div className={`w-7 h-7 bg-${color}-50 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 text-${color}-600`} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
              </div>
              <p className={`text-xl font-black leading-none text-${color === 'blue' || color === 'teal' ? 'slate' : color}-${color === 'blue' || color === 'teal' ? '900' : '600'}`}>
                {t('Rs.')} {value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-${color}-${color === 'blue' || color === 'teal' ? '400' : '500'} uppercase tracking-wider`}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search invoice number, customer, vehicle or location..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-semibold text-slate-700 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">{t('All Payment Status')}</option>
          <option value="unpaid">{t('Unpaid Only')}</option>
          <option value="partial">{t('Partially Paid Only')}</option>
          <option value="paid">{t('Fully Paid Only')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
             <p className="text-sm font-bold text-slate-400">{t('Fetching GST records...')}</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-24 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <p className="text-base font-black text-slate-800">{t('No GST Invoices Found')}</p>
             <p className="text-xs text-slate-400 mt-1">{t('Adjust dates or try searching different keywords')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Sl', 'Invoice Details', 'Customer & Routing', 'Vehicle & Materials', 'Subtotal', 'GST (5%)', 'Gross Total', 'Paid', 'Due', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest ${i > 3 && i < 9 ? 'text-right' : ''} ${i === 0 || i === 9 || i === 10 ? 'text-center' : ''}`}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 text-sm">
                {filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-4 text-center text-xs text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900">{inv.invoice_number}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                        {format(parseISO(inv.invoice_date), 'dd MMM yyyy')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-800 leading-tight">{inv.customer_name}</p>
                      {inv.delivery_location && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[160px]">{t('Dest:')} {inv.delivery_location}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-800 text-xs font-bold leading-tight truncate max-w-[200px]" title={getMaterialDetails(inv.items)}>
                        {getMaterialDetails(inv.items)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-0.5">{t('VEHICLE:')} {inv.vehicle_no || '-'}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-xs">{t('Rs.')} {inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-indigo-600 font-bold">{t('Rs.')} {inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-slate-900 font-bold">{t('Rs.')} {inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-emerald-600">{t('Rs.')} {inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-rose-600 font-bold">{t('Rs.')} {(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrintRequest ? onPrintRequest(inv) : printGstInvoice(inv)}
                          title="Print GST Invoice"
                          className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-200 inline-flex items-center justify-center"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(inv)}
                          title="Edit GST Invoice"
                          className="p-2 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-indigo-100 inline-flex items-center justify-center"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {user?.role === 'director' && (
                          <button
                            onClick={() => handleDelete(inv.id)}
                            title="Delete GST Invoice"
                            className="p-2 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all border border-transparent hover:border-rose-100 inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-xs uppercase tracking-widest text-slate-500">{t('Totals')}</td>
                  <td className="px-4 py-4 text-right text-xs">{t('Rs.')} {stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-indigo-600">{t('Rs.')} {stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-slate-900">{t('Rs.')} {stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-emerald-600">{t('Rs.')} {stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-rose-600">{t('Rs.')} {stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
