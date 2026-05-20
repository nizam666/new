import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Search, Download, FileText, CheckCircle, TrendingUp, Calculator, ShieldAlert, Award } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  created_at: string;
}

export function GstSalesModule() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

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
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching GST invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchGstInvoices();
  }, [fetchGstInvoices]);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.vehicle_no && inv.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.delivery_location && inv.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'partial':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'unpaid':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getMaterialDetails = (itemsJson: string) => {
    try {
      const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      if (Array.isArray(items)) {
        return items.map((i: any) => `${i.material || i.material_name || ''} (${(i.quantity || 0).toFixed(2)} MT)`).join(', ');
      }
    } catch (e) {}
    return '-';
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('GST Sales');

    // Set page orientation and margins
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;

    // Header styling helper
    worksheet.addRow([]);
    worksheet.addRow(['SRI BABA BLUE METALS PVT LTD']).font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow(['GST Sales Report']).font = { size: 12, bold: true, color: { argb: 'FF475569' } };
    worksheet.addRow([`Period: ${format(parseISO(startDate), 'dd-MM-yyyy')} to ${format(parseISO(endDate), 'dd-MM-yyyy')}`]).font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);

    const headers = [
      'Sl No', 'Invoice No', 'Date', 'Customer Name', 'Vehicle No', 
      'Materials (Qty)', 'Subtotal (Excl. GST)', 'GST (5%)', 'Gross Amount', 'Paid', 'Due Amount', 'Status'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    filteredInvoices.forEach((inv, index) => {
      const row = worksheet.addRow([
        index + 1,
        inv.invoice_number,
        format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
        inv.customer_name,
        inv.vehicle_no || '-',
        getMaterialDetails(inv.items),
        inv.subtotal,
        inv.tax_amount,
        inv.total_amount,
        inv.amount_paid,
        inv.total_amount - inv.amount_paid,
        inv.status.toUpperCase()
      ]);

      row.eachCell((cell, colIndex) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colIndex >= 7 && colIndex <= 11) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
        if (colIndex === 1 || colIndex === 3 || colIndex === 12) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // Add Totals Row
    const totalRowIndex = worksheet.lastRow!.number + 1;
    const totalsRow = worksheet.addRow([
      'Total', '', '', '', '', '',
      { formula: `=SUM(G6:G${totalRowIndex - 1})` },
      { formula: `=SUM(H6:H${totalRowIndex - 1})` },
      { formula: `=SUM(I6:I${totalRowIndex - 1})` },
      { formula: `=SUM(J6:J${totalRowIndex - 1})` },
      { formula: `=SUM(K6:K${totalRowIndex - 1})` },
      ''
    ]);

    totalsRow.eachCell((cell, colIndex) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      };
      if (colIndex >= 7 && colIndex <= 11) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });

    // Set Column Widths
    worksheet.columns.forEach((col, index) => {
      if (index === 0) col.width = 8; // Sl No
      else if (index === 1) col.width = 16; // Invoice No
      else if (index === 2) col.width = 14; // Date
      else if (index === 3) col.width = 28; // Customer
      else if (index === 4) col.width = 16; // Vehicle
      else if (index === 5) col.width = 38; // Materials
      else if (index >= 6 && index <= 10) col.width = 18; // Amounts
      else if (index === 11) col.width = 14; // Status
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
    
    // Brand header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('SRI BABA BLUE METALS PVT LTD', 14, 15);
    
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('GST Sales Report', 14, 21);
    doc.text(`Period: ${format(parseISO(startDate), 'dd-MM-yyyy')} to ${format(parseISO(endDate), 'dd-MM-yyyy')}`, 14, 26);
    
    const tableRows = filteredInvoices.map((inv, index) => [
      index + 1,
      inv.invoice_number,
      format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
      inv.customer_name,
      inv.vehicle_no || '-',
      getMaterialDetails(inv.items),
      `Rs. ${inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      inv.status.toUpperCase()
    ]);

    // Push total row
    tableRows.push([
      'Total', '', '', '', '', '',
      `Rs. ${stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      ''
    ]);

    autoTable(doc, {
      head: [[
        'Sl No', 'Invoice No', 'Date', 'Customer', 'Vehicle No', 'Materials', 
        'Subtotal', 'GST (5%)', 'Gross Amt', 'Paid', 'Due', 'Status'
      ]],
      body: tableRows,
      startY: 32,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 18 },
        3: { cellWidth: 45 },
        4: { cellWidth: 20 },
        5: { cellWidth: 55 },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`GST_Sales_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Date Range & Actions Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transform -rotate-3">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">GST Sales Ledger</h2>
            <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Comprehensive 5% GST billing insights</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dates */}
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-slate-500 font-black text-xs">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Exports */}
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <button
              onClick={exportToExcel}
              disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> EXCEL
            </button>
            <button
              onClick={exportToPDF}
              disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Statistics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross GST Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider">Gross Sales</p>
            </div>
            <p className="text-xl font-black text-slate-900 leading-none">
              Rs. {stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>INCLUSIVE TOTAL</span>
            <span className="text-slate-600">({filteredInvoices.length} invoices)</span>
          </div>
        </div>

        {/* Taxable Subtotal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
              <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider">Taxable Subtotal</p>
            </div>
            <p className="text-xl font-black text-slate-900 leading-none">
              Rs. {stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            EXCLUDING GST
          </div>
        </div>

        {/* Collected GST */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider">GST Collected</p>
            </div>
            <p className="text-xl font-black text-indigo-600 leading-none">
              Rs. {stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-black">
            5% Tax Share
          </div>
        </div>

        {/* Paid Amount */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider">Amount Paid</p>
            </div>
            <p className="text-xl font-black text-emerald-600 leading-none">
              Rs. {stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-emerald-500 font-bold uppercase tracking-wider">
            Cleared Payments
          </div>
        </div>

        {/* Balance Due */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
              <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wider">Balance Due</p>
            </div>
            <p className="text-xl font-black text-rose-600 leading-none">
              Rs. {stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-rose-500 font-bold uppercase tracking-wider">
            Pending Receivable
          </div>
        </div>
      </div>

      {/* Search & Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice number, customer, vehicle or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-semibold text-slate-700 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-bold text-slate-600 outline-none"
        >
          <option value="all">All Payment Status</option>
          <option value="unpaid">Unpaid Only</option>
          <option value="partial">Partially Paid Only</option>
          <option value="paid">Fully Paid Only</option>
        </select>
      </div>

      {/* Grid or Table listing */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-400">Fetching GST records...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-24 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-base font-black text-slate-800">No GST Invoices Found</p>
            <p className="text-xs text-slate-400 mt-1">Adjust dates or try searching different keywords</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sl</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Details</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer & Routing</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle & Materials</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">GST (5%)</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Gross Total</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Paid</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Due</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[160px]">
                          Dest: {inv.delivery_location}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-800 text-xs font-bold leading-tight truncate max-w-[200px]" title={getMaterialDetails(inv.items)}>
                        {getMaterialDetails(inv.items)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-0.5">
                        VEHICLE: {inv.vehicle_no || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right text-xs">
                      Rs. {inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-indigo-600 font-bold">
                      Rs. {inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-slate-900 font-bold">
                      Rs. {inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-emerald-600">
                      Rs. {inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-rose-600 font-bold">
                      Rs. {(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-xs uppercase tracking-widest text-slate-500">Totals</td>
                  <td className="px-4 py-4 text-right text-xs">
                    Rs. {stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right text-xs text-indigo-600">
                    Rs. {stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right text-xs text-slate-900">
                    Rs. {stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right text-xs text-emerald-600">
                    Rs. {stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right text-xs text-rose-600">
                    Rs. {stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
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
