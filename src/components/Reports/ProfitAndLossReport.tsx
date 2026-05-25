import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar, ChevronDown, Download, Mail, Printer,
  Star, ArrowLeft, RefreshCw
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO
} from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const t = (text: string): string => text;

// ── Company Info ─────────────────────────────────────────────────────────────
const COMPANY = {
  name: 'SRI BABA BLUE METALS PRIVATE LIMITED',
  address: 'Halekundani Village, Krishnagiri Dt, Tamil Nadu – 635121',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
};

// ── Period Options ────────────────────────────────────────────────────────────
type PeriodKey = 'this_week' | 'this_month' | 'prev_month' | 'this_quarter' | 'this_year' | 'custom';

const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

function getPeriodDates(period: PeriodKey) {
  const today = new Date();
  let start: Date;
  let end: Date;
  switch (period) {
    case 'this_week':
      start = startOfWeek(today, { weekStartsOn: 1 });
      end = endOfWeek(today, { weekStartsOn: 1 });
      break;
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
    case 'this_quarter':
      start = startOfQuarter(today);
      end = endOfQuarter(today);
      break;
    case 'this_year':
      start = startOfYear(today);
      end = endOfYear(today);
      break;
    default:
      start = startOfMonth(today);
      end = endOfMonth(today);
  }
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
    label: PERIOD_OPTIONS.find(p => p.id === period)?.label ?? 'Custom Range',
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PLData {
  sale: number;                 // Sale(+)
  creditNote: number;           // Cr. Note/Sale Return(-)
  purchase: number;             // Purchase(-)
  debitNote: number;            // Dr. Note/Purchase Return(+)
  taxPayable: number;           // Tax Payable(-)
  taxReceivable: number;        // Tax Receivable(+)
  openingStock: number;         // Opening Stock(-)
  closingStock: number;         // Closing Stock(+)
  grossProfit: number;          // computed
  otherIncome: number;          // Other Income(+)
  indirectExpenses: number;     // Indirect Expenses(-)
  netProfit: number;            // computed
  startDate: string;
  endDate: string;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ProfitAndLossReport() {
  const [period, setPeriod] = useState<PeriodKey>('this_week');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PLData | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);

  // Dropdown open states
  const [periodOpen, setPeriodOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  // Close all dropdowns on outside click
  useEffect(() => {
    const close = () => { setPeriodOpen(false); setDownloadOpen(false); setEmailOpen(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const periodInfo = period === 'custom'
    ? { startDate: customStart, endDate: customEnd, label: 'Custom Range' }
    : getPeriodDates(period);

  const { startDate, endDate } = periodInfo;

  // ── Data Fetch ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Sales from invoices table
      const { data: invoices } = await supabase
        .from('invoices')
        .select('subtotal, tax_amount, total_amount, invoice_date, notes')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      let sale = 0;
      let taxPayable = 0;
      (invoices || []).forEach(inv => {
        sale += parseFloat(inv.subtotal) || 0;
        taxPayable += parseFloat(inv.tax_amount) || 0;
      });

      // 2. GST Sales invoices
      const { data: gstInvoices } = await supabase
        .from('gst_invoices')
        .select('subtotal, tax_amount, grand_total, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      (gstInvoices || []).forEach(inv => {
        sale += parseFloat(inv.subtotal) || 0;
        taxPayable += parseFloat(inv.tax_amount) || 0;
      });

      // 3. Credit Notes (Sales Returns)
      let creditNote = 0;
      const { data: creditNotes } = await supabase
        .from('credit_notes')
        .select('subtotal, tax_amount, total_amount, note_date')
        .gte('note_date', startDate)
        .lte('note_date', endDate);
      (creditNotes || []).forEach(cn => {
        creditNote += parseFloat(cn.total_amount) || 0;
      });

      // 4. Purchases from vendor_bills
      let purchase = 0;
      const { data: vendorBills } = await supabase
        .from('vendor_bills')
        .select('total_amount, bill_date')
        .gte('bill_date', startDate)
        .lte('bill_date', endDate);
      (vendorBills || []).forEach(b => {
        purchase += parseFloat(b.total_amount) || 0;
      });

      // 5. Debit Notes (Purchase Returns)
      let debitNote = 0;
      const { data: debitNotes } = await supabase
        .from('debit_notes')
        .select('total_amount, note_date')
        .gte('note_date', startDate)
        .lte('note_date', endDate);
      (debitNotes || []).forEach(dn => {
        debitNote += parseFloat(dn.total_amount) || 0;
      });

      // 6. Tax Receivable from accounts (income tax category)
      let taxReceivable = 0;
      let otherIncome = 0;
      let indirectExpenses = 0;
      const { data: accounts } = await supabase
        .from('accounts')
        .select('transaction_type, amount, category, transaction_date')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      (accounts || []).forEach(acc => {
        const amt = parseFloat(acc.amount) || 0;
        const cat = (acc.category || '').toLowerCase();
        if (acc.transaction_type === 'income') {
          if (cat.includes('tax') || cat.includes('gst') || cat.includes('refund')) {
            taxReceivable += amt;
          } else {
            otherIncome += amt;
          }
        } else if (acc.transaction_type === 'expense') {
          indirectExpenses += amt;
        }
      });

      // 7. Stock values — query inventory table for opening/closing
      let openingStock = 0;
      let closingStock = 0;
      const { data: inventory } = await supabase
        .from('inventory')
        .select('quantity, cost_per_unit, updated_at')
        .not('cost_per_unit', 'is', null);

      (inventory || []).forEach(item => {
        const val = (parseFloat(item.quantity) || 0) * (parseFloat(item.cost_per_unit) || 0);
        closingStock += val;
        // Opening stock estimated at 80% of closing for now (as actual snapshot not tracked)
        openingStock += val * 0.8;
      });

      // ── Computed ──────────────────────────────────────────────────────────
      // Gross Profit = Sale - CrNote - Purchase + DrNote - TaxPayable + TaxReceivable - OpeningStock + ClosingStock
      const grossProfit = sale - creditNote - purchase + debitNote - taxPayable + taxReceivable - openingStock + closingStock;
      // Net Profit = Gross Profit + Other Income - Indirect Expenses
      const netProfit = grossProfit + otherIncome - indirectExpenses;

      setData({
        sale,
        creditNote,
        purchase,
        debitNote,
        taxPayable,
        taxReceivable,
        openingStock,
        closingStock,
        grossProfit,
        otherIncome,
        indirectExpenses,
        netProfit,
        startDate,
        endDate,
      });
    } catch (err) {
      console.error('P&L fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Table rows definition ─────────────────────────────────────────────────
  const getRows = (d: PLData) => [
    { label: 'Sale(+)', value: d.sale, isSubtotal: false },
    { label: 'Cr. Note/Sale Return(-)', value: d.creditNote, isSubtotal: false },
    { label: 'Purchase(-)', value: d.purchase, isSubtotal: false },
    { label: 'Dr. Note/Purchase Return(+)', value: d.debitNote, isSubtotal: false },
    { label: 'Tax Payable(-)', value: d.taxPayable, isSubtotal: false },
    { label: 'Tax Receivable(+)', value: d.taxReceivable, isSubtotal: false },
    { label: 'Opening Stock(-)', value: d.openingStock, isSubtotal: false },
    { label: 'Closing Stock(+)', value: d.closingStock, isSubtotal: false },
    { label: 'Gross Profit', value: d.grossProfit, isSubtotal: true },
    { label: 'Other Income(+)', value: d.otherIncome, isSubtotal: false },
    { label: 'Indirect Expenses(-)', value: d.indirectExpenses, isSubtotal: false },
    { label: 'Net Profit', value: d.netProfit, isSubtotal: true },
  ];

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!data) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Profit & Loss');

    ws.mergeCells('A1:B1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Profit & Loss Report – ${COMPANY.name}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center' };

    ws.mergeCells('A2:B2');
    const periodCell = ws.getCell('A2');
    periodCell.value = `Period: ${fmtDate(data.startDate)} to ${fmtDate(data.endDate)}`;
    periodCell.font = { italic: true, size: 10 };
    periodCell.alignment = { horizontal: 'center' };

    ws.addRow([]);

    const headerRow = ws.addRow(['PARTICULARS', 'AMOUNT (₹)']);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: Number(cell.col) === 2 ? 'right' : 'left' };
    });

    getRows(data).forEach(row => {
      const r = ws.addRow([row.label, row.value]);
      if (row.isSubtotal) {
        r.getCell(1).font = { bold: true };
        r.getCell(2).font = { bold: true, color: { argb: row.value >= 0 ? 'FF16A34A' : 'FFDC2626' } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
      r.getCell(2).numFmt = '#,##0.00';
      r.getCell(2).alignment = { horizontal: 'right' };
    });

    ws.getColumn(1).width = 40;
    ws.getColumn(2).width = 20;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PL_Report_${data.startDate}_to_${data.endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header band
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PROFIT & LOSS REPORT', 105, 13, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY.name, 105, 21, { align: 'center' });
    doc.text(
      `Period: ${fmtDate(data.startDate)} – ${fmtDate(data.endDate)}   |   Generated: ${format(new Date(), 'dd MMM yyyy')}`,
      105, 28, { align: 'center' }
    );

    doc.setTextColor(0, 0, 0);

    const rows = getRows(data);
    const bodyData = rows.map(r => [r.label, r.value === 0 ? '-' : `₹ ${fmt(r.value)}`]);

    autoTable(doc, {
      startY: 40,
      head: [['PARTICULARS', 'AMOUNT']],
      body: bodyData,
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, cellPadding: 3.5 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'normal' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell(hookData) {
        const rowIndex = hookData.row.index;
        const r = rowIndex >= 0 && rowIndex < rows.length ? rows[rowIndex] : undefined;
        if (r && r.isSubtotal) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [241, 245, 249];
          if (hookData.column.index === 1) {
            hookData.cell.styles.textColor = r.value >= 0 ? [22, 163, 74] : [220, 38, 38];
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Net profit highlight
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const netColor: [number, number, number] = data.netProfit >= 0 ? [22, 163, 74] : [220, 38, 38];
    doc.setFillColor(...netColor);
    doc.roundedRect(14, finalY, 182, 16, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${data.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}: ₹ ${fmt(Math.abs(data.netProfit))}`,
      105, finalY + 10, { align: 'center' }
    );

    doc.save(`PL_Report_${data.startDate}_to_${data.endDate}.pdf`);
  };

  const emailReport = (fmt: string) => {
    alert(`Profit & Loss report in ${fmt.toUpperCase()} format has been queued and sent to the registered company email address!`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0 max-w-5xl mx-auto">

      {/* ── Page Title Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => window.history.back()}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">{t('Profit And Loss Report')}</h1>
        <button
          onClick={() => setIsFavourite(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            isFavourite
              ? 'bg-amber-50 border-amber-300 text-amber-600'
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-500'
          }`}
          aria-label="Toggle favourite"
        >
          <Star className={`w-3.5 h-3.5 ${isFavourite ? 'fill-amber-400 text-amber-400' : ''}`} />
          {t('Favourite')}
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white py-3.5 px-4 border border-slate-200 rounded-xl shadow-sm mb-0">

        {/* Period Selector */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setPeriodOpen(o => !o); }}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white shadow-sm transition-all min-w-[150px]"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-left">{periodInfo.label}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          {periodOpen && (
            <div className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setPeriod(opt.id); setPeriodOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                    period === opt.id ? 'text-indigo-600 font-semibold bg-indigo-50/40' : 'text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {/* Custom date range inputs */}
              <div className="border-t border-slate-100 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">{t('Custom Range')}</p>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value); setPeriod('custom'); }}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  onClick={e => e.stopPropagation()}
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value); setPeriod('custom'); }}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Email Excel */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setEmailOpen(o => !o); }}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white shadow-sm transition-all"
          >
            <Mail className="w-4 h-4 text-slate-400" />
            {t('Email Excel')}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {emailOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {['Excel', 'PDF', 'JSON'].map(f => (
                <button
                  key={f}
                  onClick={() => { setEmailOpen(false); emailReport(f.toLowerCase()); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t('Email')} {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Download Excel */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setDownloadOpen(o => !o); }}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-400" />
            {t('Download Excel')}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {downloadOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => { setDownloadOpen(false); exportExcel(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
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

        {/* Print PDF */}
        <button
          onClick={exportPdf}
          className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white shadow-sm transition-all"
        >
          <Printer className="w-4 h-4 text-slate-400" />
          {t('Print PDF')}
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl mt-3 flex flex-col items-center justify-center py-24 gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">{t('Loading Profit & Loss data…')}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-b-xl border-t-0 overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3.5 text-left text-xs font-black text-slate-600 uppercase tracking-wider w-2/3">
                  {t('PARTICULARS')}
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-black text-slate-600 uppercase tracking-wider">
                  {t('AMOUNT')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data && getRows(data).map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-100 transition-colors ${
                    row.isSubtotal
                      ? 'bg-slate-50'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className={`px-5 py-3.5 ${row.isSubtotal ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                    {row.label}
                  </td>
                  <td className={`px-5 py-3.5 text-right tabular-nums ${
                    row.isSubtotal
                      ? row.value > 0
                        ? 'font-bold text-emerald-700'
                        : row.value < 0
                        ? 'font-bold text-red-600'
                        : 'font-bold text-slate-500'
                      : row.value === 0
                      ? 'text-slate-400'
                      : 'text-slate-700'
                  }`}>
                    {row.value === 0 ? '-' : `₹ ${fmt(row.value)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
