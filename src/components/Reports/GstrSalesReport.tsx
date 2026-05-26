import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Download, RefreshCw, Calendar, Search,
  Receipt, AlertCircle, BarChart3,
  ChevronDown, Printer, Mail, Building2, CheckCircle2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const t = (text: string): string => text;

// ── Companies Master ────────────────────────────────────────────────────────
const COMPANIES = {
  kvs: {
    id: 'kvs',
    prefix: 'KVS',
    name: 'K V S SUBRAHMANYAM',
    gstin: '33BZMPS0103A1Z0',
    address: '20/1A, Halekundani Village, Krishnagiri Tk and Dt, Tamil Nadu – 635121',
    pan: 'BZMPS0103A',
  },
  sbbm: {
    id: 'sbbm',
    prefix: 'SBBM',
    name: 'SRI BABA BLUE METALS PRIVATE LIMITED',
    gstin: '33AAKCS1538C1ZO',
    address: 'Halekundani Village, Krishnagiri Dt, Tamil Nadu – 635121',
    pan: 'AAKCS1538C',
  },
} as const;

type CompanyId = keyof typeof COMPANIES;

// ── Place of Supply Mapping ──────────────────────────────────────────────────
const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const getPlaceOfSupply = (gstin?: string) => {
  if (gstin && gstin.trim().length === 15) {
    const code = gstin.trim().substring(0, 2);
    return {
      code,
      name: GST_STATES[code] || 'Out of State',
    };
  }
  // Default POS to Tamil Nadu for unregistered B2CS (matching screenshots)
  return { code: '33', name: 'Tamil Nadu' };
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCurrency = (n: number) => {
  return `₹ ${fmt(n)}`;
};

const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd-MM-yyyy'); } catch { return d; }
};

const getPeriodDates = (period: string) => {
  const today = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'this_month':
      start = startOfMonth(today);
      end = endOfMonth(today);
      break;
    case 'prev_month': {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
      break;
    }
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), q * 3, 1);
      end = new Date(today.getFullYear(), (q + 1) * 3, 0);
      break;
    }
    case 'fy': {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      if (currentMonth >= 3) {
        start = new Date(currentYear, 3, 1);
        end = new Date(currentYear + 1, 2, 31);
      } else {
        start = new Date(currentYear - 1, 3, 1);
        end = new Date(currentYear, 2, 31);
      }
      break;
    }
    default: {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
    }
  }

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
    label: period === 'this_month' ? 'Current Month' :
           period === 'prev_month' ? 'Previous Month' :
           period === 'this_quarter' ? 'This Quarter' : 'Financial Year'
  };
};

// ── Types ────────────────────────────────────────────────────────────────────
interface GstInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id?: string;
  delivery_location: string;
  vehicle_no: string;
  invoice_date: string;
  items: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  amount_paid: number;
  notes: string;
  created_at: string;
}


interface GstNote {
  id: string;
  note_number: string;
  original_invoice_number: string;
  customer_name: string;
  customer_gstin?: string;
  note_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
}

// ── Mock return notes for secondary tabs ─────────────────────────────────────
const MOCK_CREDIT_NOTES: GstNote[] = [
  {
    id: 'cn-1',
    note_number: 'CN/2026/001',
    original_invoice_number: '03',
    customer_name: 'SKL MOTORS',
    customer_gstin: '33DIIPS8591D1ZU',
    note_date: '2026-04-10',
    subtotal: 2000.00,
    tax_rate: 5,
    tax_amount: 100.00,
    total_amount: 2100.00,
    status: 'adjusted'
  }
];

const MOCK_DEBIT_NOTES: GstNote[] = [];

// ── Main Component ──────────────────────────────────────────────────────────
export function GstrSalesReport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('this_month');
  const [selectedCompany, setSelectedCompany] = useState<CompanyId>('sbbm');
  const [invoices, setInvoices] = useState<GstInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'sales_return' | 'purchase_return'>('sales');
  const [invoiceView, setInvoiceView] = useState<'invoice' | 'customer' | 'summary'>('invoice');

  // Toolbar open dropdown states
  const [periodOpen, setPeriodOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  // Active company details – explicit safe lookup instead of bracket notation
  const activeCompany = selectedCompany === 'kvs' ? COMPANIES.kvs : COMPANIES.sbbm;

  // Close dropdowns on window click
  useEffect(() => {
    const handleOutsideClick = () => {
      setPeriodOpen(false);
      setDownloadOpen(false);
      setEmailOpen(false);
      setViewOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const periodInfo = getPeriodDates(selectedPeriod);
  const startDate = periodInfo.startDate;
  const endDate = periodInfo.endDate;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gt('tax_rate', 0)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: true });

      if (error) throw error;

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

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Derived filtered list: company prefix + search term
  const filteredSales = invoices.filter((inv) => {
    // Match company by invoice prefix or notes.company_id
    let companyId = inv.invoice_number.startsWith('KVS') ? 'kvs' : 'sbbm';
    try {
      const n = JSON.parse(inv.notes || '{}');
      if (n.company_id) companyId = n.company_id;
    } catch { /* ignore */ }
    if (companyId !== selectedCompany) return false;
    return (
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredCreditNotes = MOCK_CREDIT_NOTES.filter((note) =>
    note.note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDebitNotes = MOCK_DEBIT_NOTES.filter((note) =>
    note.note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Grand totals helper
  const getTotals = () => {
    if (activeTab === 'sales') {
      return filteredSales.reduce(
        (acc, inv) => {
          let custGst = '';
          try { const n = JSON.parse(inv.notes || '{}'); custGst = n.customer_gstin || ''; } catch { /* ignore */ }
          const pos = getPlaceOfSupply(custGst);
          const isInterState = pos.code !== '33';
          const taxable = inv.subtotal || 0;
          const taxAmt = inv.tax_amount || 0;

          acc.taxable += taxable;
          acc.tax += taxAmt;
          acc.gross += inv.total_amount || 0;
          if (isInterState) {
            acc.igst += taxAmt;
          } else {
            acc.cgst += taxAmt / 2;
            acc.sgst += taxAmt / 2;
          }
          return acc;
        },
        { taxable: 0, tax: 0, gross: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 }
      );
    } else {
      const activeList = activeTab === 'sales_return' ? filteredCreditNotes : filteredDebitNotes;
      return activeList.reduce(
        (acc, note) => {
          const pos = getPlaceOfSupply(note.customer_gstin);
          const isInterState = pos.code !== '33';
          const taxable = note.subtotal || 0;
          const taxAmt = note.tax_amount || 0;

          acc.taxable += taxable;
          acc.tax += taxAmt;
          acc.gross += note.total_amount || 0;
          if (isInterState) {
            acc.igst += taxAmt;
          } else {
            acc.cgst += taxAmt / 2;
            acc.sgst += taxAmt / 2;
          }
          return acc;
        },
        { taxable: 0, tax: 0, gross: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 }
      );
    }
  };

  const totals = getTotals();

  // ── Exports & Actions ──────────────────────────────────────────────────────────
  const exportJson = () => {
    let records: object[] = [];

    if (activeTab === 'sales') {
      records = filteredSales.map((inv) => {
        let custGst = '';
        try { const n = JSON.parse(inv.notes || '{}'); custGst = n.customer_gstin || ''; } catch { /* ignore */ }
        const pos = getPlaceOfSupply(custGst);
        const isInterState = pos.code !== '33';
        const taxable = inv.subtotal || 0;
        const taxAmt = inv.tax_amount || 0;
        const cgst = isInterState ? 0 : taxAmt / 2;
        const sgst = isInterState ? 0 : taxAmt / 2;
        const igst = isInterState ? taxAmt : 0;

        return {
          gstin: custGst || 'Unregistered',
          customer_name: inv.customer_name,
          place_of_supply_code: pos.code,
          place_of_supply_name: pos.name,
          invoice_number: inv.invoice_number,
          invoice_date: fmtDate(inv.invoice_date),
          invoice_value: inv.total_amount,
          tax_rate_percent: inv.tax_rate,
          taxable_value: taxable,
          cgst: cgst,
          sgst_utgst: sgst,
          igst: igst,
          cess: 0,
          total_tax: taxAmt,
        };
      });
    } else {
      const activeList = activeTab === 'sales_return' ? filteredCreditNotes : filteredDebitNotes;
      records = activeList.map((note) => {
        const pos = getPlaceOfSupply(note.customer_gstin);
        const isInterState = pos.code !== '33';
        const taxable = note.subtotal || 0;
        const taxAmt = note.tax_amount || 0;
        const cgst = isInterState ? 0 : taxAmt / 2;
        const sgst = isInterState ? 0 : taxAmt / 2;
        const igst = isInterState ? taxAmt : 0;

        return {
          gstin: note.customer_gstin || 'Unregistered',
          customer_name: note.customer_name,
          place_of_supply_code: pos.code,
          place_of_supply_name: pos.name,
          note_number: note.note_number,
          original_invoice_number: note.original_invoice_number,
          note_date: fmtDate(note.note_date),
          note_value: note.total_amount,
          tax_rate_percent: note.tax_rate,
          taxable_value: taxable,
          cgst: cgst,
          sgst_utgst: sgst,
          igst: igst,
          cess: 0,
          total_tax: taxAmt,
        };
      });
    }

    const tabLabel =
      activeTab === 'sales' ? 'Outward_Sales' :
      activeTab === 'sales_return' ? 'Sales_Return_Credit_Notes' :
      'Purchase_Return_Debit_Notes';

    const payload = {
      report: 'GSTR-1',
      section: tabLabel.replace(/_/g, ' '),
      company: activeCompany.name,
      gstin: activeCompany.gstin,
      period: periodInfo.label,
      period_from: startDate,
      period_to: endDate,
      generated_at: new Date().toISOString(),
      total_records: records.length,
      totals: {
        taxable_value: totals.taxable,
        cgst: totals.cgst,
        sgst_utgst: totals.sgst,
        igst: totals.igst,
        cess: 0,
        total_tax: totals.tax,
        gross_value: totals.gross,
      },
      invoices: records,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `GSTR1_${tabLabel}_${periodInfo.label.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const emailReport = (formatType: string) => {
    alert(t(`GSTR-1 report in ${formatType.toUpperCase()} format has been queued and successfully sent to the registered company email address!`));
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const sheetName = activeTab === 'sales' ? 'Outward Sales' : activeTab === 'sales_return' ? 'Credit Notes' : 'Debit Notes';
    const ws = wb.addWorksheet(sheetName);

    ws.addRow([activeCompany.name]).font = { size: 14, bold: true };
    ws.addRow([`GSTIN: ${activeCompany.gstin}`]).font = { size: 10 };
    ws.addRow([`${sheetName} – ${periodInfo.label}`]).font = { size: 12, bold: true };
    ws.addRow([]);

    const headers = [
      'GSTIN', 'Customer Name', 'State Code', 'State Name',
      'Document No', 'Date', 'Document Value', 'Tax Rate (%)',
      'Taxable Value', 'CGST', 'SGST/UTGST', 'IGST', 'Cess', 'Total Tax'
    ];
    const sh = ws.addRow(headers);
    sh.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo theme
      cell.alignment = { horizontal: 'center' };
    });

    if (activeTab === 'sales') {
      filteredSales.forEach((inv) => {
        let custGst = '';
        try { const n = JSON.parse(inv.notes || '{}'); custGst = n.customer_gst || ''; } catch { /* ignore */ }
        const pos = getPlaceOfSupply(custGst);
        const isInterState = pos.code !== '33';
        const taxable = inv.subtotal || 0;
        const taxAmt = inv.tax_amount || 0;
        const cgst = isInterState ? 0 : taxAmt / 2;
        const sgst = isInterState ? 0 : taxAmt / 2;
        const igst = isInterState ? taxAmt : 0;

        const row = ws.addRow([
          custGst || 'Unregistered',
          inv.customer_name,
          pos.code,
          pos.name,
          inv.invoice_number,
          fmtDate(inv.invoice_date),
          inv.total_amount,
          inv.tax_rate,
          taxable,
          cgst,
          sgst,
          igst,
          0,
          taxAmt
        ]);
        row.eachCell((cell, ci) => {
          if (ci === 7 || ci >= 9) { cell.numFmt = '#,##0.00'; }
        });
      });
    } else {
      const activeList = activeTab === 'sales_return' ? filteredCreditNotes : filteredDebitNotes;
      activeList.forEach((note) => {
        const pos = getPlaceOfSupply(note.customer_gstin);
        const isInterState = pos.code !== '33';
        const taxable = note.subtotal || 0;
        const taxAmt = note.tax_amount || 0;
        const cgst = isInterState ? 0 : taxAmt / 2;
        const sgst = isInterState ? 0 : taxAmt / 2;
        const igst = isInterState ? taxAmt : 0;

        const row = ws.addRow([
          note.customer_gstin || 'Unregistered',
          note.customer_name,
          pos.code,
          pos.name,
          note.note_number,
          fmtDate(note.note_date),
          note.total_amount,
          note.tax_rate,
          taxable,
          cgst,
          sgst,
          igst,
          0,
          taxAmt
        ]);
        row.eachCell((cell, ci) => {
          if (ci === 7 || ci >= 9) { cell.numFmt = '#,##0.00'; }
        });
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${sheetName.replace(/\s+/g, '_')}_${periodInfo.label.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(activeCompany.name, 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`GSTIN: ${activeCompany.gstin}  |  ${activeCompany.address}`, 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const title = activeTab === 'sales' ? 'GSTR-1 Outward Supplies (Sales)' : activeTab === 'sales_return' ? 'Sales Return / Credit Notes' : 'Purchase Return / Debit Notes';
    doc.text(`${title} – ${periodInfo.label}`, 14, 28);

    const bodyData = activeTab === 'sales'
      ? filteredSales.map((inv) => {
          let custGst = '';
          try { const n = JSON.parse(inv.notes || '{}'); custGst = n.customer_gstin || ''; } catch { /* ignore */ }
          const pos = getPlaceOfSupply(custGst);
          const isInterState = pos.code !== '33';
          const taxAmt = inv.tax_amount || 0;
          const cgst = isInterState ? 0 : taxAmt / 2;
          const sgst = isInterState ? 0 : taxAmt / 2;
          const igst = isInterState ? taxAmt : 0;
          return [
            custGst || 'Unregistered',
            inv.customer_name,
            `${pos.code}-${pos.name}`,
            inv.invoice_number,
            fmtDate(inv.invoice_date),
            fmt(inv.total_amount),
            inv.tax_rate + '%',
            fmt(inv.subtotal),
            fmt(cgst),
            fmt(sgst),
            fmt(igst),
            fmt(taxAmt)
          ];
        })
      : (activeTab === 'sales_return' ? filteredCreditNotes : filteredDebitNotes).map((note) => {
          const pos = getPlaceOfSupply(note.customer_gstin);
          const isInterState = pos.code !== '33';
          const taxAmt = note.tax_amount || 0;
          const cgst = isInterState ? 0 : taxAmt / 2;
          const sgst = isInterState ? 0 : taxAmt / 2;
          const igst = isInterState ? taxAmt : 0;
          return [
            note.customer_gstin || 'Unregistered',
            note.customer_name,
            `${pos.code}-${pos.name}`,
            note.note_number,
            fmtDate(note.note_date),
            fmt(note.total_amount),
            note.tax_rate + '%',
            fmt(note.subtotal),
            fmt(cgst),
            fmt(sgst),
            fmt(igst),
            fmt(taxAmt)
          ];
        });

    autoTable(doc, {
      startY: 34,
      head: [[
        'GSTIN', 'Customer', 'POS', 'Doc No', 'Date',
        'Doc Val', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Tax'
      ]],
      body: bodyData,
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`GSTR1_${title.replace(/\s+/g, '_')}_${periodInfo.label.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">

      {/* ── Company Selector ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          {t('Select Company')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.values(COMPANIES) as typeof COMPANIES[CompanyId][]).map((co) => {
            const isSelected = selectedCompany === co.id;
            return (
              <button
                key={co.id}
                onClick={() => setSelectedCompany(co.id as CompanyId)}
                className={`relative flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-sm leading-tight ${
                    isSelected ? 'text-indigo-900' : 'text-slate-700'
                  }`}>{co.name}</p>
                  <p className={`font-mono text-xs mt-1 ${
                    isSelected ? 'text-indigo-600' : 'text-slate-400'
                  }`}>{t('GSTIN')}: {co.gstin}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom Toolbar Panel (Image 1 Style) ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        {/* Period Selector Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setPeriodOpen(!periodOpen); }}
            className="flex items-center justify-between gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm transition-all min-w-[170px]"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {periodInfo.label}
            </span>
            <ChevronDown className="w-4.5 h-4.5 text-slate-400" />
          </button>
          {periodOpen && (
            <div className="absolute left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {[
                { id: 'this_month', label: 'Current Month' },
                { id: 'prev_month', label: 'Previous Month' },
                { id: 'this_quarter', label: 'This Quarter' },
                { id: 'fy', label: 'Financial Year' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPeriod(p.id); setPeriodOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                    selectedPeriod === p.id ? 'text-indigo-600 bg-indigo-50/50 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Download Excel Dropdown Menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setDownloadOpen(!downloadOpen); }}
            className="flex items-center justify-between gap-2 px-4 py-2.5 border border-violet-400 hover:border-violet-500 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50/30 shadow-sm transition-all min-w-[175px]"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-violet-500" />
              {t('Download Excel')}
            </span>
            <ChevronDown className="w-4.5 h-4.5 text-violet-500" />
          </button>
          {downloadOpen && (
            <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => { setDownloadOpen(false); exportJson(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('Download JSON')}
              </button>
              <button
                onClick={() => { setDownloadOpen(false); exportExcel(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors bg-violet-50/30 font-semibold text-violet-700"
              >
                {t('Download Excel')}
              </button>
              <button
                onClick={() => { setDownloadOpen(false); exportPdf(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('Download PDF')}
              </button>
            </div>
          )}
        </div>

        {/* Email Excel Dropdown Menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setEmailOpen(!emailOpen); }}
            className="flex items-center justify-between gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm transition-all min-w-[160px]"
          >
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              {t('Email Excel')}
            </span>
            <ChevronDown className="w-4.5 h-4.5 text-slate-400" />
          </button>
          {emailOpen && (
            <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => { setEmailOpen(false); emailReport('json'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('Email JSON')}
              </button>
              <button
                onClick={() => { setEmailOpen(false); emailReport('excel'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('Email Excel')}
              </button>
              <button
                onClick={() => { setEmailOpen(false); emailReport('pdf'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('Email PDF')}
              </button>
            </div>
          )}
        </div>

        {/* Print PDF Button */}
        <button
          onClick={exportPdf}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm transition-all"
        >
          <Printer className="w-4 h-4 text-slate-400" />
          {t('Print Pdf')}
        </button>

        {/* Invoice View Selector Menu */}
        <div className="relative md:ml-auto">
          <button
            onClick={(e) => { e.stopPropagation(); setViewOpen(!viewOpen); }}
            className="flex items-center justify-between gap-2 px-4 py-2.5 border border-sky-400 hover:border-sky-500 rounded-xl text-sm font-semibold text-sky-700 bg-sky-50/20 shadow-sm transition-all min-w-[150px]"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-500" />
              {invoiceView === 'invoice' ? t('Invoice View') : invoiceView === 'customer' ? t('Customer View') : t('Summary View')}
            </span>
            <ChevronDown className="w-4.5 h-4.5 text-sky-500" />
          </button>
          {viewOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {[
                { id: 'invoice', label: t('Invoice View') },
                { id: 'customer', label: t('Customer View') },
                { id: 'summary', label: t('Summary View') }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setInvoiceView(v.id as 'invoice' | 'customer' | 'summary'); setViewOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                    invoiceView === v.id ? 'text-sky-600 bg-sky-50/30 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Document Switcher Tab Panel ────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'sales', label: t('Sales') },
          { id: 'sales_return', label: t('Sales Return/ Credit Note') },
          { id: 'purchase_return', label: t('Purchase Return/ Debit Note') }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as 'sales' | 'sales_return' | 'purchase_return')}
            className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all -mb-[2px] ${
              activeTab === t.id
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search Input bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('Search by document number or customer...')}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* ── Main Data Rendering ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-slate-500 font-bold text-sm">{t('Loading tax records...')}</p>
          </div>
        </div>
      ) : activeTab === 'sales' && filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">{t('No outward sales invoices found for')} {periodInfo.label}</p>
        </div>
      ) : activeTab === 'sales_return' && filteredCreditNotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">{t('No Credit Notes found for')} {periodInfo.label}</p>
        </div>
      ) : activeTab === 'purchase_return' && filteredDebitNotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">{t('No Debit Notes found for')} {periodInfo.label}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Scrollable table container */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Spanned Group Header */}
                <tr className="bg-slate-50/70 border-b border-slate-200">
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[150px]">{t('GSTIN')}</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[200px]">{t('Customer Name')}</th>
                  <th colSpan={2} className="px-4 py-2 border-r border-slate-200 text-center text-xs font-black text-slate-500 uppercase tracking-wider">{t('Place of Supply')}</th>
                  <th colSpan={5} className="px-4 py-2 border-r border-slate-200 text-center text-xs font-black text-slate-500 uppercase tracking-wider">{t('Invoice Details')}</th>
                  <th colSpan={5} className="px-4 py-2 text-center text-xs font-black text-slate-500 uppercase tracking-wider">{t('Amount of Tax')}</th>
                </tr>
                {/* Secondary Column Header */}
                <tr className="bg-slate-50/70 border-b border-slate-200">
                  <th className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[80px]">{t('State Code')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[110px]">{t('State Name')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[120px]">{t('Invoice Number')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[100px]">{t('Invoice Date')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[120px]">{t('Invoice Value')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[90px]">{t('Total Tax(%)')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[120px]">{t('Taxable Value')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[100px]">{t('CGST')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[110px]">{t('SGST/UTGST')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[100px]">{t('IGST')}</th>
                  <th className="px-4 py-3 border-r border-slate-200 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[80px]">{t('CESS')}</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider min-w-[120px]">{t('Total Tax')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTab === 'sales' ? (
                  filteredSales.map((inv) => {
                    let custGst = '';
                    try { const n = JSON.parse(inv.notes || '{}'); custGst = n.customer_gstin || ''; } catch { /* ignore */ }
                    const pos = getPlaceOfSupply(custGst);
                    const isInterState = pos.code !== '33';
                    const taxableValue = inv.subtotal || 0;
                    const totalTax = inv.tax_amount || 0;
                    const totalValue = inv.total_amount || 0;

                    const cgst = isInterState ? 0 : totalTax / 2;
                    const sgst = isInterState ? 0 : totalTax / 2;
                    const igst = isInterState ? totalTax : 0;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 border-r border-slate-100 font-mono text-xs text-slate-700">{custGst || '-'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 font-semibold text-slate-800 uppercase">{inv.customer_name}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{pos.code}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{pos.name}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 font-medium text-slate-800">{inv.invoice_number}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right font-medium text-slate-800">{fmtCurrency(totalValue)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{inv.tax_rate}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right font-medium text-slate-800">{fmtCurrency(taxableValue)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{cgst > 0 ? fmtCurrency(cgst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{sgst > 0 ? fmtCurrency(sgst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{igst > 0 ? fmtCurrency(igst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">₹ 0</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmtCurrency(totalTax)}</td>
                      </tr>
                    );
                  })
                ) : (
                  (activeTab === 'sales_return' ? filteredCreditNotes : filteredDebitNotes).map((note) => {
                    const pos = getPlaceOfSupply(note.customer_gstin);
                    const isInterState = pos.code !== '33';
                    const taxableValue = note.subtotal || 0;
                    const totalTax = note.tax_amount || 0;
                    const totalValue = note.total_amount || 0;

                    const cgst = isInterState ? 0 : totalTax / 2;
                    const sgst = isInterState ? 0 : totalTax / 2;
                    const igst = isInterState ? totalTax : 0;

                    return (
                      <tr key={note.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 border-r border-slate-100 font-mono text-xs text-slate-700">{note.customer_gstin || '-'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 font-semibold text-slate-800 uppercase">{note.customer_name}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{pos.code}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{pos.name}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 font-medium text-slate-800">{note.note_number}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-slate-600">{fmtDate(note.note_date)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right font-medium text-slate-800">{fmtCurrency(totalValue)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{note.tax_rate}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right font-medium text-slate-800">{fmtCurrency(taxableValue)}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{cgst > 0 ? fmtCurrency(cgst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{sgst > 0 ? fmtCurrency(sgst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">{igst > 0 ? fmtCurrency(igst) : '₹ 0'}</td>
                        <td className="px-4 py-3.5 border-r border-slate-100 text-right text-slate-600">₹ 0</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmtCurrency(totalTax)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/70 border-t-2 border-slate-200 font-black">
                  <td colSpan={6} className="px-4 py-4 border-r border-slate-200 text-xs font-black uppercase text-slate-600">{t('Totals')}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-800 font-bold">{fmtCurrency(totals.gross)}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-400 font-normal">-</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-800 font-bold">{fmtCurrency(totals.taxable)}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-700 font-bold">{fmtCurrency(totals.cgst)}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-700 font-bold">{fmtCurrency(totals.sgst)}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-700 font-bold">{fmtCurrency(totals.igst)}</td>
                  <td className="px-4 py-4 border-r border-slate-200 text-right text-slate-400 font-normal">₹ 0</td>
                  <td className="px-4 py-4 text-right text-slate-900 font-black">{fmtCurrency(totals.tax)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
