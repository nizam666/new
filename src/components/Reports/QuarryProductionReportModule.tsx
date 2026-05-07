import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Calendar, Download, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyReportItem {
  date: string;
  qcQty: number;
  qsQty: number;
  scQty: number;
  qSalesQty: number;
  totalQuarryProd: number;
  totalCrusherProd: number;
}

export function QuarryProductionReportModule() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dailyData, setDailyData] = useState<DailyReportItem[]>([]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd-MM-yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Transport Records
      const { data: transportData } = await supabase
        .from('transport_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 2. Fetch Invoices
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('items, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const reportRows: DailyReportItem[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // 1) Q-C qty
        const qc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // 2) Q-S qty
        const qs = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // 3) S-C qty
        const sc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // 4) Q-bolders sales
        let qSales = 0;
        invoiceData?.filter(inv => inv.invoice_date === dateStr).forEach(inv => {
          let items = [];
          try {
            items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
          } catch (e) {}
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matName = (item.material || item.material_name || '').toLowerCase();
              if (matName.includes('q-boulder') || matName.includes('q-bolders')) {
                qSales += (item.quantity || 0);
              }
            });
          }
        });

        // total quarry production means (1+2+4)
        const totalQuarryProd = qc + qs + qSales;

        // total crusher production (1+3)
        const totalCrusherProd = qc + sc;

        return {
          date: dateStr,
          qcQty: qc,
          qsQty: qs,
          scQty: sc,
          qSalesQty: qSales,
          totalQuarryProd,
          totalCrusherProd
        };
      });

      setDailyData(reportRows);
    } catch (err) {
      console.error('Error fetching daily report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quarry Production');

    worksheet.addRow(['Quarry Day-wise Production Report']).font = { name: 'Arial', size: 14, bold: true };
    worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]).font = { name: 'Arial', size: 11, italic: true };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      'Date', 
      'Q-C (MT)', 
      'Q-S (MT)', 
      'S-C (MT)', 
      'Q-Sales (MT)', 
      'Total Quarry Prod (MT)', 
      'Total Crusher Prod (MT)'
    ]);

    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    dailyData.forEach(day => {
      const row = worksheet.addRow([
        formatDate(day.date),
        day.qcQty,
        day.qsQty,
        day.scQty,
        day.qSalesQty,
        day.totalQuarryProd,
        day.totalCrusherProd
      ]);
      row.font = { name: 'Arial', size: 10 };
    });

    const totals = dailyData.reduce((acc, day) => {
      acc.qc += day.qcQty;
      acc.qs += day.qsQty;
      acc.sc += day.scQty;
      acc.qSales += day.qSalesQty;
      acc.totalQuarry += day.totalQuarryProd;
      acc.totalCrusher += day.totalCrusherProd;
      return acc;
    }, { qc: 0, qs: 0, sc: 0, qSales: 0, totalQuarry: 0, totalCrusher: 0 });

    const totalRow = worksheet.addRow([
      'Total',
      totals.qc,
      totals.qs,
      totals.sc,
      totals.qSales,
      totals.totalQuarry,
      totals.totalCrusher
    ]);
    totalRow.font = { name: 'Arial', size: 10, bold: true };
    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarry_Production_${startDate}_to_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text(`Quarry Day-wise Production Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 22);

    const totals = dailyData.reduce((acc, day) => {
      acc.qc += day.qcQty;
      acc.qs += day.qsQty;
      acc.sc += day.scQty;
      acc.qSales += day.qSalesQty;
      acc.totalQuarry += day.totalQuarryProd;
      acc.totalCrusher += day.totalCrusherProd;
      return acc;
    }, { qc: 0, qs: 0, sc: 0, qSales: 0, totalQuarry: 0, totalCrusher: 0 });

    const rows = dailyData.map(d => [
      formatDate(d.date),
      d.qcQty.toFixed(1),
      d.qsQty.toFixed(1),
      d.scQty.toFixed(1),
      d.qSalesQty.toFixed(1),
      d.totalQuarryProd.toFixed(1),
      d.totalCrusherProd.toFixed(1)
    ]);

    rows.push([
      'Total',
      totals.qc.toFixed(1),
      totals.qs.toFixed(1),
      totals.sc.toFixed(1),
      totals.qSales.toFixed(1),
      totals.totalQuarry.toFixed(1),
      totals.totalCrusher.toFixed(1)
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Q-C (MT)', 'Q-S (MT)', 'S-C (MT)', 'Q-Sales (MT)', 'Total Quarry Prod', 'Total Crusher Prod']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 8 }
    });

    doc.save(`Quarry_Production_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Quarry Production Report</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Day-wise Performance Breakdowns</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-1">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-slate-400 font-black text-xs">TO</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-C qty (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-S qty (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">S-C qty (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-Boulders Sales (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-right bg-emerald-50/50 text-emerald-700">Total Quarry Prod (1+2+4)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-right bg-blue-50/50 text-blue-700">Total Crusher Prod (1+3)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Loading daily metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-sm font-bold text-slate-400 italic">
                    No data recorded for this window.
                  </td>
                </tr>
              ) : (
                dailyData.map((day, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-500 text-xs">{formatDate(day.date)}</td>
                    <td className="px-4 py-3 text-right">{day.qcQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.qsQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.scQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.qSalesQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right bg-emerald-50/20 font-bold text-emerald-700">{day.totalQuarryProd.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right bg-blue-50/20 font-bold text-blue-700">{day.totalCrusherProd.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && dailyData.length > 0 && (
              <tfoot className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.qcQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.qsQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.scQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.qSalesQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right bg-emerald-50/50 font-black text-emerald-800">
                    {dailyData.reduce((sum, d) => sum + d.totalQuarryProd, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right bg-blue-50/50 font-black text-blue-800">
                    {dailyData.reduce((sum, d) => sum + d.totalCrusherProd, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
