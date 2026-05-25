import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Download, Calendar, RefreshCw, Printer,
  ChevronDown, ChevronRight, Building2, ShoppingCart,
  Wallet, Users, Zap, Wrench, Package, FileText
} from 'lucide-react';
import { format, startOfYear, endOfYear, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

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

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface BalanceSection {
  label: string;
  amount: number;
  icon: React.FC<any>;
  color: string;
  bgColor: string;
  children?: { label: string; amount: number }[];
}

interface BalanceData {
  // INCOME SIDE
  salesRevenue: number;
  gstSalesRevenue: number;
  otherIncome: number;
  fundInflow: number;
  totalIncome: number;

  // EXPENSE SIDE
  accountsExpenses: { [category: string]: number };
  totalAccountsExpenses: number;
  overheadSalaries: number;
  ebCost: number;
  maintenanceCost: number;
  inventoryCost: number;
  totalExpenses: number;

  // NET
  netBalance: number;

  // Meta
  startDate: string;
  endDate: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
};

const formatCat = (s: string) =>
  s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export function BalanceSheetReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BalanceData | null>(null);
  const [period, setPeriod] = useState<'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['income', 'expenses']));

  // ── Period Presets ───────────────────────────────────────────────────────
  const applyPeriod = (p: 'month' | 'year' | 'custom') => {
    setPeriod(p);
    const now = new Date();
    if (p === 'month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (p === 'year') {
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(now), 'yyyy-MM-dd'));
    }
  };

  // ── Fetch & Aggregate ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Standard Invoices (weighbridge sales)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, invoice_date, items')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      const salesRevenue = (invoices || []).reduce((sum, inv) => {
        const amt = parseFloat(inv.total_amount) || 0;
        return sum + amt;
      }, 0);

      // 2. GST Invoices
      const { data: gstInvoices } = await supabase
        .from('gst_invoices')
        .select('grand_total, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      const gstSalesRevenue = (gstInvoices || []).reduce((sum, inv) => {
        return sum + (parseFloat(inv.grand_total) || 0);
      }, 0);

      // 3. Accounts table – income and expenses
      const { data: accounts } = await supabase
        .from('accounts')
        .select('transaction_type, amount, category, transaction_date')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      let otherIncome = 0;
      let fundInflow = 0;
      const accountsExpenses: { [cat: string]: number } = {};
      let totalAccountsExpenses = 0;

      (accounts || []).forEach(acc => {
        const amt = parseFloat(acc.amount) || 0;
        if (acc.transaction_type === 'income') {
          otherIncome += amt;
        } else if (acc.transaction_type === 'inflow') {
          fundInflow += amt;
        } else {
          // expense
          const cat = acc.category || 'Uncategorized';
          accountsExpenses[cat] = (accountsExpenses[cat] || 0) + amt;
          totalAccountsExpenses += amt;
        }
      });

      // 4. Overhead salaries (monthly per user, projected over period months)
      const { data: overheadUsers } = await supabase
        .from('users')
        .select('salary, is_overhead')
        .eq('is_overhead', true);

      const monthlyOverhead = (overheadUsers || []).reduce((sum, u) => sum + (parseFloat(u.salary) || 0), 0);
      // Approximate months in the selected period
      const periodDays = Math.max(1,
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const periodMonths = periodDays / 30;
      const overheadSalaries = monthlyOverhead * periodMonths;

      // 5. EB costs (from accounts with category containing 'eb' or 'electricity')
      const ebCost = Object.entries(accountsExpenses)
        .filter(([k]) => k.toLowerCase().includes('eb') || k.toLowerCase().includes('electric'))
        .reduce((sum, [, v]) => sum + v, 0);

      // 6. Maintenance costs
      const maintenanceCost = Object.entries(accountsExpenses)
        .filter(([k]) => k.toLowerCase().includes('maintenance') || k.toLowerCase().includes('repair'))
        .reduce((sum, [, v]) => sum + v, 0);

      // 7. Inventory / purchase costs
      const { data: vendorBills } = await supabase
        .from('vendor_bills')
        .select('total_amount, bill_date')
        .gte('bill_date', startDate)
        .lte('bill_date', endDate);
      const inventoryCost = (vendorBills || []).reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

      const totalIncome = salesRevenue + gstSalesRevenue + otherIncome + fundInflow;
      const totalExpenses = totalAccountsExpenses + overheadSalaries + inventoryCost;
      const netBalance = totalIncome - totalExpenses;

      setData({
        salesRevenue,
        gstSalesRevenue,
        otherIncome,
        fundInflow,
        totalIncome,
        accountsExpenses,
        totalAccountsExpenses,
        overheadSalaries,
        ebCost,
        maintenanceCost,
        inventoryCost,
        totalExpenses,
        netBalance,
        startDate,
        endDate,
      });
    } catch (err) {
      console.error('Balance Sheet fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Toggle Section ───────────────────────────────────────────────────────
  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Export PDF ───────────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE SHEET REPORT', 105, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sri Baba Blue Metals Pvt Ltd  |  Period: ${fmtDate(data.startDate)} – ${fmtDate(data.endDate)}`, 105, 22, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 105, 29, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let y = 44;

    // Summary boxes
    const boxes = [
      { label: 'Total Income', value: `Rs ${fmt(data.totalIncome)}`, color: [16, 185, 129] as [number, number, number] },
      { label: 'Total Expenses', value: `Rs ${fmt(data.totalExpenses)}`, color: [239, 68, 68] as [number, number, number] },
      { label: data.netBalance >= 0 ? 'Net Profit' : 'Net Loss', value: `Rs ${fmt(Math.abs(data.netBalance))}`, color: data.netBalance >= 0 ? [79, 70, 229] as [number, number, number] : [245, 158, 11] as [number, number, number] },
    ];

    boxes.forEach((b, i) => {
      const x = 14 + i * 62;
      doc.setFillColor(...b.color);
      doc.roundedRect(x, y, 58, 20, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(b.label, x + 29, y + 7, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(b.value, x + 29, y + 15, { align: 'center' });
    });

    y += 28;
    doc.setTextColor(0, 0, 0);

    // Income Table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INCOME', 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Amount (Rs)']],
      body: [
        ['Weighbridge Sales (Standard)', fmt(data.salesRevenue)],
        ['GST Sales Revenue', fmt(data.gstSalesRevenue)],
        ['Other Income (Accounts)', fmt(data.otherIncome)],
        ['Fund Inflow', fmt(data.fundInflow)],
      ],
      foot: [['TOTAL INCOME', fmt(data.totalIncome)]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      footStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Expenses Table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('EXPENSES', 14, y);
    y += 2;

    const expenseRows: string[][] = Object.entries(data.accountsExpenses).map(([k, v]) => [
      formatCat(k), fmt(v)
    ]);
    expenseRows.push(['Overhead Salaries', fmt(data.overheadSalaries)]);
    expenseRows.push(['Inventory / Vendor Bills', fmt(data.inventoryCost)]);

    autoTable(doc, {
      startY: y,
      head: [['Expense Category', 'Amount (Rs)']],
      body: expenseRows,
      foot: [['TOTAL EXPENSES', fmt(data.totalExpenses)]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      footStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Net
    const netColor: [number, number, number] = data.netBalance >= 0 ? [79, 70, 229] : [245, 158, 11];
    doc.setFillColor(...netColor);
    doc.roundedRect(14, y, 182, 18, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${data.netBalance >= 0 ? 'NET PROFIT' : 'NET LOSS'}:  Rs ${fmt(Math.abs(data.netBalance))}`,
      105, y + 11,
      { align: 'center' }
    );

    doc.save(`Balance_Sheet_${data.startDate}_to_${data.endDate}.pdf`);
  };

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!data) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Balance Sheet');

    ws.mergeCells('A1:B1');
    ws.getCell('A1').value = 'BALANCE SHEET REPORT – Sri Baba Blue Metals Pvt Ltd';
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:B2');
    ws.getCell('A2').value = `Period: ${fmtDate(data.startDate)} to ${fmtDate(data.endDate)}`;
    ws.getCell('A2').font = { italic: true, size: 10 };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    const addSection = (title: string, rows: [string, number][], fillColor: string) => {
      ws.addRow([]);
      const headerRow = ws.addRow([title, '']);
      headerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      ws.mergeCells(`A${headerRow.number}:B${headerRow.number}`);

      rows.forEach(([label, amount]) => {
        const r = ws.addRow([label, amount]);
        r.getCell(2).numFmt = '#,##0.00';
        r.getCell(2).alignment = { horizontal: 'right' };
      });
    };

    addSection('INCOME', [
      ['Weighbridge Sales (Standard)', data.salesRevenue],
      ['GST Sales Revenue', data.gstSalesRevenue],
      ['Other Income', data.otherIncome],
      ['Fund Inflow', data.fundInflow],
      ['TOTAL INCOME', data.totalIncome],
    ], 'FF059669');

    const expRows: [string, number][] = Object.entries(data.accountsExpenses).map(([k, v]) => [formatCat(k), v]);
    expRows.push(['Overhead Salaries', data.overheadSalaries]);
    expRows.push(['Inventory / Vendor Bills', data.inventoryCost]);
    expRows.push(['TOTAL EXPENSES', data.totalExpenses]);
    addSection('EXPENSES', expRows, 'FFDC2626');

    ws.addRow([]);
    const netRow = ws.addRow([data.netBalance >= 0 ? 'NET PROFIT' : 'NET LOSS', Math.abs(data.netBalance)]);
    netRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    netRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    const netFill: string = data.netBalance >= 0 ? 'FF4F46E5' : 'FFF59E0B';
    netRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netFill } };
    netRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netFill } };
    netRow.getCell(2).numFmt = '#,##0.00';
    netRow.getCell(2).alignment = { horizontal: 'right' };

    ws.getColumn(1).width = 40;
    ws.getColumn(2).width = 20;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Balance_Sheet_${data.startDate}_to_${data.endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Print ────────────────────────────────────────────────────────────────
  const printReport = () => {
    if (!data) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const expenseRows = Object.entries(data.accountsExpenses)
      .map(([k, v]) => '<tr><td>' + escapeHtml(formatCat(k)) + '</td><td class="amt">₹' + escapeHtml(fmt(v)) + '</td></tr>')
      .concat([
        '<tr><td>Overhead Salaries (prorated)</td><td class="amt">₹' + escapeHtml(fmt(data.overheadSalaries)) + '</td></tr>',
        '<tr><td>Inventory / Vendor Bills</td><td class="amt">₹' + escapeHtml(fmt(data.inventoryCost)) + '</td></tr>'
      ])
      .join('');

    const htmlTemplate = `<!DOCTYPE html><html><head><title>Balance Sheet</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Inter',sans-serif; font-size:12px; color:#0f172a; background:#fff; padding:24px; }
      .header { background:#0f172a; color:#fff; padding:20px 24px; border-radius:12px; margin-bottom:20px; text-align:center; }
      .header h1 { font-size:20px; font-weight:800; }
      .header p { font-size:11px; color:#94a3b8; margin-top:4px; }
      .summary { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
      .summary-card { border-radius:10px; padding:14px; text-align:center; }
      .income-card { background:#ecfdf5; border:1px solid #6ee7b7; }
      .expense-card { background:#fef2f2; border:1px solid #fca5a5; }
      .net-card { background:#eef2ff; border:1px solid #a5b4fc; }
      .summary-card .label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
      .summary-card .value { font-size:18px; font-weight:800; margin-top:4px; }
      .income-card .value { color:#065f46; }
      .expense-card .value { color:#991b1b; }
      .net-card .value { color:#3730a3; }
      section { margin-bottom:16px; }
      section h2 { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; padding:8px 12px; border-radius:8px 8px 0 0; color:#fff; }
      .income-h { background:#10b981; }
      .expense-h { background:#ef4444; }
      table { width:100%; border-collapse:collapse; }
      td { padding:7px 12px; border-bottom:1px solid #f1f5f9; font-size:11px; }
      td.amt { text-align:right; font-weight:600; font-variant-numeric:tabular-nums; }
      .total-row td { font-weight:800; background:#f8fafc; border-top:2px solid #e2e8f0; font-size:12px; }
      .net-row td { font-weight:800; font-size:14px; background:#4f46e5; color:#fff; border-radius:0 0 10px 10px; padding:12px; }
      @media print { body { padding:0; } }
    </style></head><body>
    <div class="header">
      <h1>Balance Sheet Report</h1>
      <p>Sri Baba Blue Metals Pvt Ltd &nbsp;|&nbsp; __START_DATE__ to __END_DATE__</p>
    </div>
    <div class="summary">
      <div class="summary-card income-card">
        <div class="label">Total Income</div>
        <div class="value">₹__TOTAL_INCOME__</div>
      </div>
      <div class="summary-card expense-card">
        <div class="label">Total Expenses</div>
        <div class="value">₹__TOTAL_EXPENSES__</div>
      </div>
      <div class="summary-card net-card">
        <div class="label">__NET_LABEL__</div>
        <div class="value">₹__NET_VALUE__</div>
      </div>
    </div>
    <section>
      <h2 class="income-h">Income</h2>
      <table>
        <tr><td>Weighbridge Sales (Standard Invoices)</td><td class="amt">₹__SALES_REVENUE__</td></tr>
        <tr><td>GST Sales Revenue</td><td class="amt">₹__GST_SALES_REVENUE__</td></tr>
        <tr><td>Other Income (Accounts)</td><td class="amt">₹__OTHER_INCOME__</td></tr>
        <tr><td>Fund Inflow</td><td class="amt">₹__FUND_INFLOW__</td></tr>
        <tr class="total-row"><td>TOTAL INCOME</td><td class="amt">₹__TOTAL_INCOME__</td></tr>
      </table>
    </section>
    <section>
      <h2 class="expense-h">Expenses</h2>
      <table>__EXPENSE_ROWS__
        <tr class="total-row"><td>TOTAL EXPENSES</td><td class="amt">₹__TOTAL_EXPENSES__</td></tr>
      </table>
    </section>
    <table><tr class="net-row">
      <td>__NET_STATUS__</td>
      <td class="amt">₹__NET_VALUE__</td>
    </tr></table>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

    const renderedHtml = htmlTemplate
      .replace(/__START_DATE__/g, escapeHtml(fmtDate(data.startDate)))
      .replace(/__END_DATE__/g, escapeHtml(fmtDate(data.endDate)))
      .replace(/__TOTAL_INCOME__/g, escapeHtml(fmt(data.totalIncome)))
      .replace(/__TOTAL_EXPENSES__/g, escapeHtml(fmt(data.totalExpenses)))
      .replace(/__NET_LABEL__/g, escapeHtml(data.netBalance >= 0 ? 'Net Profit' : 'Net Loss'))
      .replace(/__NET_VALUE__/g, escapeHtml(fmt(Math.abs(data.netBalance))))
      .replace(/__SALES_REVENUE__/g, escapeHtml(fmt(data.salesRevenue)))
      .replace(/__GST_SALES_REVENUE__/g, escapeHtml(fmt(data.gstSalesRevenue)))
      .replace(/__OTHER_INCOME__/g, escapeHtml(fmt(data.otherIncome)))
      .replace(/__FUND_INFLOW__/g, escapeHtml(fmt(data.fundInflow)))
      .replace(/__EXPENSE_ROWS__/g, expenseRows)
      .replace(/__NET_STATUS__/g, escapeHtml(data.netBalance >= 0 ? '✅ NET PROFIT' : '⚠️ NET LOSS'));

    w.document.write(renderedHtml);
    w.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">{t('Building Balance Sheet…')}</p>
      </div>
    );
  }

  if (!data) return null;

  const profitPercent = data.totalIncome > 0
    ? ((data.netBalance / data.totalIncome) * 100).toFixed(1)
    : '0.0';

  const incomeSections: BalanceSection[] = [
    {
      label: 'Weighbridge Sales',
      amount: data.salesRevenue,
      icon: ShoppingCart,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'GST Sales Revenue',
      amount: data.gstSalesRevenue,
      icon: FileText,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      label: 'Other Income',
      amount: data.otherIncome,
      icon: Wallet,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
    },
    {
      label: 'Fund Inflow',
      amount: data.fundInflow,
      icon: TrendingUp,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
  ];

  const expenseChildrenFromAccounts = Object.entries(data.accountsExpenses).map(([k, v]) => ({
    label: formatCat(k),
    amount: v,
  }));

  const expenseSections: BalanceSection[] = [
    {
      label: 'Overhead Salaries',
      amount: data.overheadSalaries,
      icon: Users,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      label: 'Inventory / Vendor Bills',
      amount: data.inventoryCost,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Recorded Expenses',
      amount: data.totalAccountsExpenses,
      icon: Wrench,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      children: expenseChildrenFromAccounts,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-700">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-3xl p-8 shadow-2xl">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">{t('Balance Sheet')}</h1>
              <p className="text-slate-400 text-sm font-medium mt-0.5">
                <Building2 className="inline w-3.5 h-3.5 mr-1" />
                {t('Sri Baba Blue Metals Pvt Ltd')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('Refresh')}
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all"
            >
              <Printer className="w-3.5 h-3.5" /> {t('Print')}
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30"
            >
              <Download className="w-3.5 h-3.5" /> {t('PDF')}
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30"
            >
              <Download className="w-3.5 h-3.5" /> {t('Excel')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Period Filter ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['month', 'year', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => applyPeriod(p)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'month' ? t('This Month') : p === 'year' ? t('This Year') : t('Custom')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <Calendar className="w-4 h-4 text-indigo-500 ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPeriod('custom'); }}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none"
            />
            <span className="text-slate-400 font-black text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPeriod('custom'); }}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none"
            />
          </div>

          <span className="text-xs font-bold text-slate-400 ml-auto">
            {fmtDate(startDate)} – {fmtDate(endDate)}
          </span>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Income */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-lg">{t('Income')}</span>
          </div>
          <p className="text-3xl font-black">₹{fmt(data.totalIncome)}</p>
          <p className="text-emerald-100 text-xs font-bold mt-1">{t('Total Revenue This Period')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-emerald-200">{t('Sales')}</p>
              <p className="font-bold">₹{fmt(data.salesRevenue)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-emerald-200">{t('GST Sales')}</p>
              <p className="font-bold">₹{fmt(data.gstSalesRevenue)}</p>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-lg">{t('Expenses')}</span>
          </div>
          <p className="text-3xl font-black">₹{fmt(data.totalExpenses)}</p>
          <p className="text-red-100 text-xs font-bold mt-1">{t('Total Costs This Period')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-red-200">{t('Overhead')}</p>
              <p className="font-bold">₹{fmt(data.overheadSalaries)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-red-200">{t('Recorded')}</p>
              <p className="font-bold">₹{fmt(data.totalAccountsExpenses)}</p>
            </div>
          </div>
        </div>

        {/* Net Balance */}
        <div className={`rounded-2xl p-6 text-white shadow-lg ${
          data.netBalance >= 0
            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 shadow-indigo-500/20'
            : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-lg`}>
              {data.netBalance >= 0 ? t('Profit') : t('Loss')}
            </span>
          </div>
          <p className="text-3xl font-black">₹{fmt(Math.abs(data.netBalance))}</p>
          <p className={`text-xs font-bold mt-1 ${data.netBalance >= 0 ? 'text-indigo-200' : 'text-amber-100'}`}>
            {data.netBalance >= 0
              ? `${profitPercent}% ${t('profit margin')}`
              : `${Math.abs(parseFloat(profitPercent))}% ${t('loss margin')}`}
          </p>
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-xs">
              <span className="opacity-80">{t('Income')}</span>
              <span className="font-bold">₹{fmt(data.totalIncome)}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5 my-2">
              <div
                className="bg-white rounded-full h-1.5 transition-all"
                style={{ width: `${Math.min(100, (data.totalExpenses / Math.max(data.totalIncome, 1)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="opacity-80">{t('Expenses')}</span>
              <span className="font-bold">₹{fmt(data.totalExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-Column Ledger ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* INCOME Side */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 hover:from-emerald-100 hover:to-teal-100 transition-colors"
            onClick={() => toggleSection('income')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{t('Income')}</p>
                <p className="text-xl font-black text-slate-900">₹{fmt(data.totalIncome)}</p>
              </div>
            </div>
            {expandedSections.has('income')
              ? <ChevronDown className="w-5 h-5 text-slate-400" />
              : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>

          {expandedSections.has('income') && (
            <div className="divide-y divide-slate-50">
              {incomeSections.map(sec => (
                <div key={sec.label} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${sec.bgColor} rounded-lg flex items-center justify-center`}>
                      <sec.icon className={`w-4 h-4 ${sec.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{t(sec.label)}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 tabular-nums">₹{fmt(sec.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-4 bg-emerald-50 border-t-2 border-emerald-200">
                <span className="text-sm font-black text-emerald-800 uppercase tracking-wider">{t('Total Income')}</span>
                <span className="text-sm font-black text-emerald-700 tabular-nums">₹{fmt(data.totalIncome)}</span>
              </div>
            </div>
          )}
        </div>

        {/* EXPENSES Side */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 hover:from-red-100 hover:to-rose-100 transition-colors"
            onClick={() => toggleSection('expenses')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wider text-red-700">{t('Expenses')}</p>
                <p className="text-xl font-black text-slate-900">₹{fmt(data.totalExpenses)}</p>
              </div>
            </div>
            {expandedSections.has('expenses')
              ? <ChevronDown className="w-5 h-5 text-slate-400" />
              : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>

          {expandedSections.has('expenses') && (
            <div className="divide-y divide-slate-50">
              {expenseSections.map(sec => (
                <div key={sec.label}>
                  <div
                    className={`flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors ${sec.children ? 'cursor-pointer' : ''}`}
                    onClick={() => sec.children && toggleSection(sec.label)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${sec.bgColor} rounded-lg flex items-center justify-center`}>
                        <sec.icon className={`w-4 h-4 ${sec.color}`} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{t(sec.label)}</span>
                      {sec.children && (
                        expandedSections.has(sec.label)
                          ? <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                          : <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                      )}
                    </div>
                    <span className="text-sm font-black text-slate-900 tabular-nums">₹{fmt(sec.amount)}</span>
                  </div>

                  {sec.children && expandedSections.has(sec.label) && (
                    <div className="bg-slate-50/50 border-t border-slate-100">
                      {sec.children.map(child => (
                        <div key={child.label} className="flex justify-between items-center px-6 py-2.5 border-b border-slate-100 last:border-0">
                          <span className="text-xs font-medium text-slate-500">• {t(child.label)}</span>
                          <span className="text-xs font-bold text-slate-700 tabular-nums">₹{fmt(child.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between p-4 bg-red-50 border-t-2 border-red-200">
                <span className="text-sm font-black text-red-800 uppercase tracking-wider">{t('Total Expenses')}</span>
                <span className="text-sm font-black text-red-700 tabular-nums">₹{fmt(data.totalExpenses)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Net Balance Banner ────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-6 shadow-lg ${
        data.netBalance >= 0
          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-500/30'
          : 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-black uppercase tracking-[0.15em]">
                {data.netBalance >= 0 ? t('Net Profit') : t('Net Loss')}
              </p>
              <p className="text-white text-4xl font-black">₹{fmt(Math.abs(data.netBalance))}</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-white">
            <span className="opacity-70">{t('Total Income')}</span>
            <span className="font-black text-right">₹{fmt(data.totalIncome)}</span>
            <span className="opacity-70">{t('Total Expenses')}</span>
            <span className="font-black text-right">₹{fmt(data.totalExpenses)}</span>
            <span className="opacity-70 border-t border-white/20 pt-1 mt-1">{t('Profit Margin')}</span>
            <span className="font-black text-right border-t border-white/20 pt-1 mt-1">{profitPercent}%</span>
          </div>
        </div>
      </div>

      {/* ── Expense Breakdown Bar Chart ───────────────────────────────────── */}
      {Object.keys(data.accountsExpenses).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{t('Expense Breakdown')}</h3>
              <p className="text-xs text-slate-500 font-medium">{t('From recorded transactions')}</p>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(data.accountsExpenses)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => {
                const pct = data.totalAccountsExpenses > 0
                  ? Math.min(100, (amt / data.totalAccountsExpenses) * 100)
                  : 0;
                const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-teal-500'];
                const colorIdx = Object.keys(data.accountsExpenses).indexOf(cat) % colors.length;
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-700">{t(formatCat(cat))}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-900 tabular-nums">₹{fmt(amt)}</span>
                        <span className="text-xs font-bold text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`${colors[colorIdx]} h-2 rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 font-medium pb-4">
        {t('Balance Sheet generated on ')}{format(new Date(), 'dd MMM yyyy, HH:mm')} &nbsp;|&nbsp; {t('Data sourced from all modules')}
      </p>
    </div>
  );
}
