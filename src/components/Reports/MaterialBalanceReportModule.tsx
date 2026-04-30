import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Calendar, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyBalanceItem {
  date: string;
  totalQuarryProd: number;
  qsQty: number;
  scQty: number;
  totalStockyardBalance: number;
  totalCrusherProd: number;
  sludge: number;
  afterSludgeCrusherProd: number;
  totalSales: number;
  sbSales: number;
  balanceCrusherMaterial: number;
  cumulativeStockyardBal: number;
  cumulativeCrusherBal: number;
}

export function MaterialBalanceReportModule() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dailyData, setDailyData] = useState<DailyBalanceItem[]>([]);

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

      let runningStockyardBal = 0;
      let runningCrusherBal = 0;

      const reportRows: DailyBalanceItem[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // Q-C qty
        const qc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // Q-S qty
        const qs = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // S-C qty
        const sc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // Invoice parsing
        let qSales = 0;
        let sSales = 0;
        let crusherSales = 0;

        invoiceData?.filter(inv => inv.invoice_date === dateStr).forEach(inv => {
          let items = [];
          try {
            items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
          } catch (e) {}
          
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matName = (item.material || item.material_name || '').toLowerCase();
              const qty = parseFloat(item.quantity) || (parseFloat(item.gross_weight) - parseFloat(item.empty_weight)) || 0;
              
              if (matName.includes('q-boulder') || matName.includes('q-bolders')) {
                qSales += qty;
              } else if (matName.includes('s-bolder') || matName.includes('s bolder') || matName.includes('stockyard boulder')) {
                sSales += qty;
              } else {
                crusherSales += qty;
              }
            });
          }
        });

        const totalQuarryProd = qc + qs + qSales;
        const totalStockyardBalance = qs - sc - sSales;
        const totalCrusherProd = qc + sc;
        const sludge = totalCrusherProd * 0.10;
        const afterSludgeCrusherProd = totalCrusherProd - sludge;
        const totalSales = crusherSales;
        const balanceCrusherMaterial = afterSludgeCrusherProd - totalSales;

        runningStockyardBal += totalStockyardBalance;
        runningCrusherBal += balanceCrusherMaterial;

        return {
          date: dateStr,
          totalQuarryProd,
          qsQty: qs,
          scQty: sc,
          totalStockyardBalance,
          totalCrusherProd,
          sludge,
          afterSludgeCrusherProd,
          totalSales,
          sbSales: sSales,
          balanceCrusherMaterial,
          cumulativeStockyardBal: runningStockyardBal,
          cumulativeCrusherBal: runningCrusherBal
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
    const worksheet = workbook.addWorksheet('Material Balance');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Total Quarry Prod (MT)', key: 'quarryProd', width: 25 },
      { header: 'Total Stockyard Material (MT)', key: 'qs', width: 25 },
      { header: 'S-C (MT)', key: 'sc', width: 15 },
      { header: 'Total Crusher Prod (MT)', key: 'crusherProd', width: 25 },
      { header: 'Sludge (10%) (MT)', key: 'sludge', width: 20 },
      { header: 'After Sludge Prod (MT)', key: 'afterSludge', width: 25 },
      { header: 'Total Sales (MT)', key: 'sales', width: 20 },
      { header: 'S-Bolder Sales (MT)', key: 'sbSales', width: 20 },
      { header: 'Stockyard Balance (MT)', key: 'stockyardBal', width: 25 },
      { header: 'Balances Crusher (MT)', key: 'balance', width: 25 },
      { header: 'Cum. Stockyard Balance (MT)', key: 'cumStockyard', width: 30 },
      { header: 'Cum. Crusher Balance (MT)', key: 'cumCrusher', width: 30 }
    ];

    const colColors = [
      { bg: 'F8FAFC', fg: '64748B' },
      { bg: 'EFF6FF', fg: '3B82F6' },
      { bg: 'F0FDF4', fg: '10B981' },
      { bg: 'F0FDF4', fg: '10B981' },
      { bg: 'F5F3FF', fg: '8B5CF6' },
      { bg: 'FFFBEB', fg: 'F59E0B' },
      { bg: 'FAF5FF', fg: 'A855F7' },
      { bg: 'FFF1F2', fg: 'F43F5E' },
      { bg: 'FFF1F2', fg: 'F43F5E' },
      { bg: 'F0FDF4', fg: '10B981' },
      { bg: 'ECFEFF', fg: '06B6D4' },
      { bg: 'F0FDF4', fg: '10B981' },
      { bg: 'EFF6FF', fg: '3B82F6' }
    ];

    colColors.forEach((color, index) => {
      const col = worksheet.getColumn(index + 1);
      col.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color.bg }
      };
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    colColors.forEach((color, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color.fg }
      };
    });

    dailyData.forEach(day => {
      worksheet.addRow({
        date: formatDate(day.date),
        quarryProd: day.totalQuarryProd,
        qs: day.qsQty,
        sc: day.scQty,
        crusherProd: day.totalCrusherProd,
        sludge: day.sludge,
        afterSludge: day.afterSludgeCrusherProd,
        sales: day.totalSales,
        sbSales: day.sbSales,
        stockyardBal: day.totalStockyardBalance,
        balance: day.balanceCrusherMaterial,
        cumStockyard: day.cumulativeStockyardBal,
        cumCrusher: day.cumulativeCrusherBal
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.font = { name: 'Arial', size: 10 };
        row.alignment = { vertical: 'middle' };
        
        for (let i = 2; i <= 13; i++) {
          const cell = row.getCell(i);
          cell.numFmt = '#,##0.0';
          cell.alignment = { horizontal: 'right' };
        }
      }
    });

    const totalRow = worksheet.addRow({
      date: 'Total',
      quarryProd: dailyData.reduce((sum, d) => sum + d.totalQuarryProd, 0),
      qs: dailyData.reduce((sum, d) => sum + d.qsQty, 0),
      sc: dailyData.reduce((sum, d) => sum + d.scQty, 0),
      crusherProd: dailyData.reduce((sum, d) => sum + d.totalCrusherProd, 0),
      sludge: dailyData.reduce((sum, d) => sum + d.sludge, 0),
      afterSludge: dailyData.reduce((sum, d) => sum + d.afterSludgeCrusherProd, 0),
      sales: dailyData.reduce((sum, d) => sum + d.totalSales, 0),
      sbSales: dailyData.reduce((sum, d) => sum + d.sbSales, 0),
      stockyardBal: dailyData.reduce((sum, d) => sum + d.totalStockyardBalance, 0),
      balance: dailyData.reduce((sum, d) => sum + d.balanceCrusherMaterial, 0),
      cumStockyard: dailyData[dailyData.length - 1]?.cumulativeStockyardBal || 0,
      cumCrusher: dailyData[dailyData.length - 1]?.cumulativeCrusherBal || 0
    });

    totalRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    
    colColors.forEach((color, index) => {
      const cell = totalRow.getCell(index + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color.fg }
      };
    });

    for (let i = 2; i <= 13; i++) {
      const cell = totalRow.getCell(i);
      cell.numFmt = '#,##0.0';
      cell.alignment = { horizontal: 'right' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Material_Balance_Report_${startDate}_to_${endDate}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.text('Material Balance Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Period: ${formatDate(startDate)} TO ${formatDate(endDate)}`, 14, 30);

    const tableColumn = [
      'Date', 
      'Quarry Prod', 
      'Total Stockyard Material',
      'S-C',
      'Crusher Prod', 
      'Sludge', 
      'After Sludge', 
      'Total Sales', 
      'S-Bolder Sales',
      'Stockyard Bal', 
      'Crusher Bal',
      'Cum. Stockyard',
      'Cum. Crusher'
    ];
    
    const tableRows = dailyData.map(day => [
      formatDate(day.date),
      day.totalQuarryProd.toFixed(1),
      day.qsQty.toFixed(1),
      day.scQty.toFixed(1),
      day.totalCrusherProd.toFixed(1),
      day.sludge.toFixed(1),
      day.afterSludgeCrusherProd.toFixed(1),
      day.totalSales.toFixed(1),
      day.sbSales.toFixed(1),
      day.totalStockyardBalance.toFixed(1),
      day.balanceCrusherMaterial.toFixed(1),
      day.cumulativeStockyardBal.toFixed(1),
      day.cumulativeCrusherBal.toFixed(1)
    ]);

    tableRows.push([
      'Total',
      dailyData.reduce((sum, d) => sum + d.totalQuarryProd, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.qsQty, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.scQty, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.totalCrusherProd, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.sludge, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.afterSludgeCrusherProd, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.totalSales, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.sbSales, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.totalStockyardBalance, 0).toFixed(1),
      dailyData.reduce((sum, d) => sum + d.balanceCrusherMaterial, 0).toFixed(1),
      (dailyData[dailyData.length - 1]?.cumulativeStockyardBal || 0).toFixed(1),
      (dailyData[dailyData.length - 1]?.cumulativeCrusherBal || 0).toFixed(1)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`Material_Balance_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Material Balance Report</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Day-wise Production & Sales Balance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-1">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-slate-400 font-black text-xs">TO</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-600 font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                EXCEL
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-rose-500" />
                PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-md transition-all hover:shadow-lg">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80 mb-2">Total Stockyard Balance( Bolders)</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight">
                {dailyData.reduce((sum, d) => sum + d.totalStockyardBalance, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
              </span>
              <span className="text-xs font-black text-emerald-100/80 uppercase tracking-widest">MT</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-md transition-all hover:shadow-lg">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-100/80 mb-2">Total Balance Crushed Materials(M-sand,P-sand,Aggregate and others)</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight">
                {dailyData.reduce((sum, d) => sum + d.balanceCrusherMaterial, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
              </span>
              <span className="text-xs font-black text-blue-100/80 uppercase tracking-widest">MT</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total Quarry Prod (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total Stockyard Material (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">S-C (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total Crusher Prod (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Sludge (10%) (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">After Sludge Crusher Prod (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total Sales (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">S-Bolder Sales (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Stockyard Balance (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Balances Crusher Material (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-blue-800 bg-blue-50/50 uppercase tracking-widest text-right">Cum. Stockyard (MT)</th>
                <th className="px-3 py-4 text-[9px] font-black text-emerald-800 bg-emerald-50/50 uppercase tracking-widest text-right">Cum. Crusher (MT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Loading metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-20 text-center text-sm font-bold text-slate-400 italic">
                    No data recorded for this window.
                  </td>
                </tr>
              ) : (
                dailyData.map((day, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 font-bold text-slate-500 text-[11px]">{formatDate(day.date)}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.totalQuarryProd.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.qsQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.scQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.totalCrusherProd.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px] text-amber-600">{day.sludge.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.afterSludgeCrusherProd.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.sbSales.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px]">{day.totalStockyardBalance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold text-slate-600">{day.balanceCrusherMaterial.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-black bg-blue-50/20 text-blue-700">{day.cumulativeStockyardBal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-black bg-emerald-50/20 text-emerald-700">{day.cumulativeCrusherBal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && dailyData.length > 0 && (
              <tfoot className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-3 text-[10px] uppercase tracking-wider">Total</td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.totalQuarryProd, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.qsQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.scQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.totalCrusherProd, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px] text-amber-700">
                    {dailyData.reduce((sum, d) => sum + d.sludge, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.afterSludgeCrusherProd, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.totalSales, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.sbSales, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.totalStockyardBalance, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px]">
                    {dailyData.reduce((sum, d) => sum + d.balanceCrusherMaterial, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px] bg-blue-50/50 font-black text-blue-800">
                    {(dailyData[dailyData.length - 1]?.cumulativeStockyardBal || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-3 text-right text-[11px] bg-emerald-50/50 font-black text-emerald-800">
                    {(dailyData[dailyData.length - 1]?.cumulativeCrusherBal || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
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
