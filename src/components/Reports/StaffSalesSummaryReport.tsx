import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Calendar, Download, TrendingUp, FileText,
  ChevronDown, ChevronUp, Search, RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

interface StaffSummary {
  staffId: string;
  staffName: string;
  role: string;
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  materials: Record<string, { qty: number; amount: number }>;
  invoices: RawInvoice[];
}

interface RawInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  items: string;
  created_by: string | null;
  notes: string | null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const MATERIAL_KEYS = [
  { key: 'm-sand', label: 'M-Sand' },
  { key: 'p-sand', label: 'P-Sand' },
  { key: '40mm', label: '40mm' },
  { key: '20mm', label: '20mm' },
  { key: '12mm', label: '12mm' },
  { key: '6mm', label: '6mm' },
  { key: 'gbs', label: 'GBS' },
  { key: 'dust', label: 'Dust' },
  { key: 'wet mix', label: 'Wet Mix' },
  { key: 'all mix', label: 'All Mix' },
  { key: 's-bolder', label: 'S-Bolder' },
];

function classifyMaterial(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('m-sand') || n.includes('m sand')) return 'm-sand';
  if (n.includes('p-sand') || n.includes('p sand')) return 'p-sand';
  if (n.includes('40mm')) return '40mm';
  if (n.includes('20mm')) return '20mm';
  if (n.includes('12mm')) return '12mm';
  if (n.includes('6mm')) return '6mm';
  if (n.includes('gbs')) return 'gbs';
  if (n.includes('dust')) return 'dust';
  if (n.includes('wet mix')) return 'wet mix';
  if (n.includes('all mix')) return 'all mix';
  if (n.includes('s-bolder') || n.includes('s bolder') || n.includes('stockyard boulder')) return 's-bolder';
  return 'other';
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd-MM-yyyy'); } catch { return d; }
}

function statusColor(s: string) {
  if (s === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (s === 'partial') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

// ────────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────────

export function StaffSalesSummaryReport() {
  const { user: currentUser } = useAuth();
  const userRole = currentUser?.role;

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load all users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .order('full_name');

      const userMap: Record<string, { full_name: string; role: string }> = {};
      (usersData || []).forEach(u => { userMap[u.id] = { full_name: u.full_name, role: u.role }; });

      // 2. Load standard invoices (SalesModule, non-GST-invoice-type)
      let query = supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, invoice_date, total_amount, amount_paid, status, items, created_by, notes')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (userRole !== 'director') {
        query = query.gt('tax_rate', 0);
      }

      const { data: invoiceData, error } = await query;
      if (error) throw error;

      // Filter out GST module invoices
      const standardInvoices: RawInvoice[] = (invoiceData || []).filter(inv => {
        try {
          const parsed = JSON.parse(inv.notes || '{}');
          return !parsed || parsed.invoice_type !== 'gst_invoice';
        } catch {
          return true;
        }
      });

      // 3. Group by staff
      const grouped: Record<string, StaffSummary> = {};

      const UNASSIGNED_KEY = '__unassigned__';

      standardInvoices.forEach(inv => {
        const key = inv.created_by || UNASSIGNED_KEY;
        if (!grouped[key]) {
          const info = inv.created_by ? userMap[inv.created_by] : null;
          grouped[key] = {
            staffId: key,
            staffName: info?.full_name || 'Unassigned',
            role: info?.role || '—',
            totalInvoices: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalPending: 0,
            paidCount: 0,
            unpaidCount: 0,
            partialCount: 0,
            materials: {},
            invoices: [],
          };
        }

        const s = grouped[key];
        s.totalInvoices += 1;
        s.totalAmount += inv.total_amount || 0;
        s.totalPaid += inv.amount_paid || 0;
        s.totalPending += (inv.total_amount - (inv.amount_paid || 0));
        if (inv.status === 'paid') s.paidCount++;
        else if (inv.status === 'unpaid') s.unpaidCount++;
        else s.partialCount++;

        // Parse items for material breakdown
        try {
          const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matKey = classifyMaterial(item.material || item.material_name || '');
              const qty = parseFloat(item.quantity) || 0;
              const amt = parseFloat(item.amount) || 0;
              if (!s.materials[matKey]) s.materials[matKey] = { qty: 0, amount: 0 };
              s.materials[matKey].qty += qty;
              s.materials[matKey].amount += amt;
            });
          }
        } catch { /* ignore parse errors */ }

        s.invoices.push(inv);
      });

      // Sort by totalAmount desc
      const sorted = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
      setStaffSummaries(sorted);
    } catch (err) {
      console.error('Error fetching staff sales summary:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userRole]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = staffSummaries.filter(s =>
    s.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grandTotal = {
    invoices: filtered.reduce((a, s) => a + s.totalInvoices, 0),
    amount: filtered.reduce((a, s) => a + s.totalAmount, 0),
    paid: filtered.reduce((a, s) => a + s.totalPaid, 0),
    pending: filtered.reduce((a, s) => a + s.totalPending, 0),
  };

  // ── Export helpers ────────────────────────────────────────────────────────────

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Staff Sales Summary');

    // Header row
    ws.columns = [
      { header: 'Staff Name', key: 'staffName', width: 22 },
      { header: 'Role', key: 'role', width: 18 },
      { header: 'Invoices', key: 'invoices', width: 12 },
      { header: 'Total Amount', key: 'totalAmount', width: 18 },
      { header: 'Total Paid', key: 'totalPaid', width: 18 },
      { header: 'Total Pending', key: 'totalPending', width: 18 },
      { header: 'Paid Bills', key: 'paidCount', width: 12 },
      { header: 'Partial Bills', key: 'partialCount', width: 14 },
      { header: 'Unpaid Bills', key: 'unpaidCount', width: 14 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
      cell.alignment = { horizontal: 'center' };
    });

    filtered.forEach(s => {
      ws.addRow({
        staffName: s.staffName,
        role: s.role,
        invoices: s.totalInvoices,
        totalAmount: s.totalAmount,
        totalPaid: s.totalPaid,
        totalPending: s.totalPending,
        paidCount: s.paidCount,
        partialCount: s.partialCount,
        unpaidCount: s.unpaidCount,
      });
    });

    // Totals row
    const totalRow = ws.addRow({
      staffName: 'GRAND TOTAL',
      role: '',
      invoices: grandTotal.invoices,
      totalAmount: grandTotal.amount,
      totalPaid: grandTotal.paid,
      totalPending: grandTotal.pending,
      paidCount: filtered.reduce((a, s) => a + s.paidCount, 0),
      partialCount: filtered.reduce((a, s) => a + s.partialCount, 0),
      unpaidCount: filtered.reduce((a, s) => a + s.unpaidCount, 0),
    });
    totalRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Staff_Sales_Summary_${startDate}_to_${endDate}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Sales Summary – Staff Wise', 14, 14);
    doc.setFontSize(9);
    doc.text(`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`, 14, 22);

    const rows = filtered.map(s => [
      s.staffName,
      s.role,
      s.totalInvoices,
      fmtCurrency(s.totalAmount),
      fmtCurrency(s.totalPaid),
      fmtCurrency(s.totalPending),
      s.paidCount,
      s.partialCount,
      s.unpaidCount,
    ]);

    autoTable(doc, {
      head: [['Staff', 'Role', 'Bills', 'Total', 'Paid', 'Pending', '✓ Paid', '~ Partial', '✗ Unpaid']],
      body: rows,
      foot: [['GRAND TOTAL', '', grandTotal.invoices, fmtCurrency(grandTotal.amount), fmtCurrency(grandTotal.paid), fmtCurrency(grandTotal.pending), '', '', '']],
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
      footStyles: { fillColor: [237, 233, 254], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.save(`Staff_Sales_Summary_${startDate}_to_${endDate}.pdf`);
  };

  const exportToJSON = () => {
    const out = filtered.map(s => ({
      staffName: s.staffName,
      role: s.role,
      totalInvoices: s.totalInvoices,
      totalAmount: s.totalAmount,
      totalPaid: s.totalPaid,
      totalPending: s.totalPending,
      paidCount: s.paidCount,
      partialCount: s.partialCount,
      unpaidCount: s.unpaidCount,
      materials: s.materials,
      invoices: s.invoices.map(i => ({
        invoice_number: i.invoice_number,
        customer_name: i.customer_name,
        invoice_date: i.invoice_date,
        total_amount: i.total_amount,
        amount_paid: i.amount_paid,
        status: i.status,
      })),
    }));
    const blob = new Blob([JSON.stringify({ period: { from: startDate, to: endDate }, data: out }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Staff_Sales_Summary_${startDate}_to_${endDate}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ── Card wrapper ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Sales Summary – Staff Wise</h3>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">Invoices grouped by sales staff</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <span className="text-slate-400 font-black text-xs">TO</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>

            {/* Refresh */}
            <button onClick={fetchReport}
              className="p-2.5 bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-600 rounded-xl transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Exports */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <button onClick={exportToExcel}
                className="px-4 py-2 bg-white text-emerald-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-emerald-50 transition-all">
                <Download className="w-3.5 h-3.5 text-emerald-500" /> EXCEL
              </button>
              <button onClick={exportToPDF}
                className="px-4 py-2 bg-white text-rose-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-rose-50 transition-all">
                <Download className="w-3.5 h-3.5 text-rose-500" /> PDF
              </button>
              <button onClick={exportToJSON}
                className="px-4 py-2 bg-white text-violet-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-violet-50 transition-all">
                <Download className="w-3.5 h-3.5 text-violet-500" /> JSON
              </button>
            </div>
          </div>
        </div>

        {/* ── Grand-total KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {[
            { label: 'Total Invoices', value: grandTotal.invoices.toString(), bg: 'bg-violet-50 border-violet-100', icon: <FileText className="w-5 h-5 text-violet-500" />, text: 'text-violet-900' },
            { label: 'Total Sales', value: fmtCurrency(grandTotal.amount), bg: 'bg-blue-50 border-blue-100', icon: <TrendingUp className="w-5 h-5 text-blue-500" />, text: 'text-blue-900' },
            { label: 'Collected', value: fmtCurrency(grandTotal.paid), bg: 'bg-emerald-50 border-emerald-100', icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, text: 'text-emerald-900' },
            { label: 'Pending', value: fmtCurrency(grandTotal.pending), bg: 'bg-amber-50 border-amber-100', icon: <TrendingUp className="w-5 h-5 text-amber-500" />, text: 'text-amber-900' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-4 border flex flex-col gap-2 shadow-sm`}>
              <div className="flex items-center gap-2">
                {card.icon}
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</span>
              </div>
              <span className={`text-2xl font-black ${card.text} leading-none`}>{card.value}</span>
            </div>
          ))}
        </div>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search staff or role…" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* ── Table / Cards ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-400">Loading staff sales data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold italic text-sm">
            No data found for the selected period.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const isExpanded = expandedStaff === s.staffId;
              const collectionRate = s.totalAmount > 0 ? (s.totalPaid / s.totalAmount) * 100 : 0;

              return (
                <div key={s.staffId}
                  className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                  {/* ── Staff row header ─────────────────────────────────── */}
                  <button
                    onClick={() => setExpandedStaff(isExpanded ? null : s.staffId)}
                    className="w-full flex items-center gap-4 p-4 md:p-5 bg-white hover:bg-slate-50 transition-colors text-left">

                    {/* Avatar */}
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-violet-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md shadow-violet-200">
                      {s.staffName.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm md:text-base">{s.staffName}</span>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-widest">{s.role}</span>
                      </div>
                      {/* Collection bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(collectionRate, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 shrink-0">{collectionRate.toFixed(0)}% collected</span>
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="hidden md:flex items-center gap-6 text-right shrink-0">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bills</p>
                        <p className="text-lg font-black text-slate-900">{s.totalInvoices}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                        <p className="text-lg font-black text-slate-900">{fmtCurrency(s.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Paid</p>
                        <p className="text-lg font-black text-emerald-700">{fmtCurrency(s.totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pending</p>
                        <p className="text-lg font-black text-amber-700">{fmtCurrency(s.totalPending)}</p>
                      </div>
                    </div>

                    {/* Mobile summary */}
                    <div className="flex md:hidden flex-col items-end gap-0.5 shrink-0">
                      <span className="text-base font-black text-slate-900">{fmtCurrency(s.totalAmount)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{s.totalInvoices} bills</span>
                    </div>

                    <div className="ml-2 text-slate-400 shrink-0">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {/* ── Expanded detail ───────────────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 md:p-5 space-y-5">

                      {/* Status pills */}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
                          ✓ {s.paidCount} Paid
                        </span>
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-black">
                          ~ {s.partialCount} Partial
                        </span>
                        <span className="px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-xs font-black">
                          ✗ {s.unpaidCount} Unpaid
                        </span>
                      </div>

                      {/* Material breakdown */}
                      {Object.keys(s.materials).length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Material Breakdown</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {MATERIAL_KEYS.map(({ key, label }) => {
                              const mat = s.materials[key];
                              if (!mat || mat.qty === 0) return null;
                              return (
                                <div key={key} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                  <p className="text-sm font-black text-slate-800">{mat.qty.toFixed(2)} MT</p>
                                  <p className="text-[10px] font-bold text-violet-600">{fmtCurrency(mat.amount)}</p>
                                </div>
                              );
                            })}
                            {/* Other materials */}
                            {s.materials['other'] && s.materials['other'].qty > 0 && (
                              <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Other</p>
                                <p className="text-sm font-black text-slate-800">{s.materials['other'].qty.toFixed(2)} MT</p>
                                <p className="text-[10px] font-bold text-violet-600">{fmtCurrency(s.materials['other'].amount)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Invoice table */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Invoices</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest">Invoice #</th>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest">Customer</th>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest">Date</th>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-right">Total</th>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-right">Paid</th>
                                <th className="px-3 py-2 font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {s.invoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 font-bold text-blue-600">{inv.invoice_number}</td>
                                  <td className="px-3 py-2 font-semibold text-slate-700 max-w-[140px] truncate">{inv.customer_name}</td>
                                  <td className="px-3 py-2 text-slate-500">{fmtDate(inv.invoice_date)}</td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtCurrency(inv.total_amount)}</td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmtCurrency(inv.amount_paid)}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColor(inv.status)}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-violet-50 border-t-2 border-violet-200">
                              <tr>
                                <td colSpan={3} className="px-3 py-2 font-black text-violet-800 uppercase text-[10px] tracking-widest">Staff Total</td>
                                <td className="px-3 py-2 text-right font-black text-violet-900">{fmtCurrency(s.totalAmount)}</td>
                                <td className="px-3 py-2 text-right font-black text-emerald-800">{fmtCurrency(s.totalPaid)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
