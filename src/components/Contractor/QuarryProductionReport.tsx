import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Calendar, 
  Download,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyReportItem {
  date: string;
  qcQty: number;
  qsQty: number;
  qSalesQty: number;
  scQty: number;
  excavatorHours: number;
  tipperTrips: number;
  drillingFeet: number;
  crusherExcavatorHours: number;
  advances: number;
  deductions: number;
}

export function QuarryProductionReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const contractorName = 'Govindaraj';
  const [dailyData, setDailyData] = useState<DailyReportItem[]>([]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd-MM-yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    fetchDailyReport();
  }, [startDate, endDate]);

  const fetchDailyReport = async () => {
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

      // 3. Fetch Loading Records
      const { data: loadingData } = await supabase
        .from('loading_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 4. Fetch Drilling Records
      const { data: drillingData } = await supabase
        .from('drilling_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 5. Fetch Accounts
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('customer_name, amount_given, reason, notes, transaction_type, transaction_date')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      // 6. Fetch Resource Deductions
      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, given_price, unit, dispatch_date')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate)
        .not('given_price', 'is', null);

      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const reportRows: DailyReportItem[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // Q-C
        const qc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // Q-Stock
        const qs = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // Q-Sales
        let qSales = 0;
        invoiceData?.filter(inv => inv.invoice_date === dateStr).forEach(inv => {
          let items = [];
          try {
            items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
          } catch (e) {}
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matName = item.material || item.material_name || '';
              if (matName === 'Q-Boulders') {
                qSales += (item.quantity || 0);
              }
            });
          }
        });

        // S-C
        const sc = transportData
          ?.filter(r => r.date === dateStr && r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
          .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

        // Soil/WR Excavator Hours
        const excavatorHrs = loadingData
          ?.filter(r => r.date === dateStr && ['KVSS Soil', 'KVSS Weather Rocks'].includes(r.material_type))
          .reduce((sum, r) => {
            const run = (r.ending_hours || 0) - (r.starting_hours || 0);
            return sum + (run > 0 ? run : 0);
          }, 0) || 0;

        // Soil/WR Tipper Trips
        const trips = transportData
          ?.filter(r => r.date === dateStr && ['Soil', 'Weather Rocks'].includes(r.material_transported))
          .reduce((sum, r) => sum + (r.number_of_trips || 0), 0) || 0;

        // Drilling Feet
        const feet = drillingData
          ?.filter(r => r.date === dateStr && ['Weathered Rocks', 'Soil'].includes(r.material_type))
          .reduce((sum, r) => {
            let dailySum = 0;
            const set1 = r.rod_measurements || {};
            const set2 = r.rod_measurements_set2 || {};
            const ROD_STEPS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5];
            ROD_STEPS.forEach(step => {
              const key = step.toString().replace('.', '_');
              dailySum += (set1[`rod${key}`] || 0) * step;
              dailySum += (set2[`rod${key}_set2`] || 0) * step;
            });
            return sum + dailySum;
          }, 0) || 0;

        // Crusher Excavator Hours
        const crusherHrs = loadingData
          ?.filter(r => r.date === dateStr && [
            'SBBM Slurry Work', 
            'SBBM Stockyard Good Boulders', 
            'Aggregates rehandling/ Aggregate Loading', 
            'Crusher machine works'
          ].includes(r.material_type))
          .reduce((sum, r) => {
            const run = (r.ending_hours || 0) - (r.starting_hours || 0);
            return sum + (run > 0 ? run : 0);
          }, 0) || 0;

        // Advances
        let advTotal = 0;
        accountsData?.forEach((rec: any) => {
          if (rec.transaction_date !== dateStr || rec.transaction_type !== 'expense' || !(rec.amount_given > 0)) return;
          const matchesName = rec.customer_name?.toLowerCase().includes(contractorName.toLowerCase());
          const matchesRef = rec.reason?.toLowerCase().includes('con-qry-001') || 
                             rec.notes?.toLowerCase().includes('con-qry-001') || 
                             rec.customer_name?.toLowerCase().includes('con-qry-001');

          if (!matchesName && !matchesRef) return;

          const checkIsAdvance = () => {
            if (rec.notes) {
              const parts = rec.notes.split(' | ');
              const itemPart = parts.find((p: string) => p.startsWith('Item: '));
              if (itemPart) {
                const itemValue = itemPart.replace('Item: ', '').toLowerCase();
                if (itemValue.includes('payment')) return false;
                if (itemValue.includes('advance')) return true;
              }
            }
            return rec.reason?.toLowerCase().includes('advance') || 
                   rec.notes?.toLowerCase().includes('advance');
          };

          if (checkIsAdvance()) {
            advTotal += (rec.amount_given || 0);
          }
        });

        // Resource Deductions
        let resTotal = 0;
        dispatchData
          ?.filter(d => d.dispatch_date === dateStr)
          .forEach(d => {
            const qty = d.quantity_dispatched || 0;
            const price = d.given_price || 0;
            resTotal += qty * price;
          });

        return {
          date: dateStr,
          qcQty: qc,
          qsQty: qs,
          qSalesQty: qSales,
          scQty: sc,
          excavatorHours: excavatorHrs,
          tipperTrips: trips,
          drillingFeet: feet,
          crusherExcavatorHours: crusherHrs,
          advances: advTotal,
          deductions: resTotal
        };
      });

      setDailyData(reportRows);
    } catch (err) {
      console.error('Error fetching daily report:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Day-wise Production');

    worksheet.addRow([`Quarry Day-wise Production Report: ${contractorName}`]).font = { name: 'Arial', size: 14, bold: true };
    worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]).font = { name: 'Arial', size: 11, italic: true };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      'Date', 
      'Q-C (MT)', 
      'Q-Stock (MT)', 
      'Q-Sales (MT)', 
      'S-C (MT)', 
      'Soil/WR Exc. HRS', 
      'Soil/WR Tipper Trips', 
      'WR Drilling (FT)', 
      'Crusher Exc (HRS)'
    ]);

    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    dailyData.forEach(day => {
      const row = worksheet.addRow([
        formatDate(day.date),
        day.qcQty,
        day.qsQty,
        day.qSalesQty,
        day.scQty,
        day.excavatorHours,
        day.tipperTrips,
        day.drillingFeet,
        day.crusherExcavatorHours
      ]);
      row.font = { name: 'Arial', size: 10 };
    });

    const totals = dailyData.reduce((acc, day) => {
      acc.qc += day.qcQty;
      acc.qs += day.qsQty;
      acc.qSales += day.qSalesQty;
      acc.sc += day.scQty;
      acc.excavatorHrs += day.excavatorHours;
      acc.trips += day.tipperTrips;
      acc.drillingFeet += day.drillingFeet;
      acc.crusherHrs += day.crusherExcavatorHours;
      return acc;
    }, { qc: 0, qs: 0, qSales: 0, sc: 0, excavatorHrs: 0, trips: 0, drillingFeet: 0, crusherHrs: 0 });

    const totalRow = worksheet.addRow([
      'Total',
      totals.qc,
      totals.qs,
      totals.qSales,
      totals.sc,
      totals.excavatorHrs,
      totals.trips,
      totals.drillingFeet,
      totals.crusherHrs
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
    a.download = `Quarry_Daily_Production_${startDate}_to_${endDate}.xlsx`;
    a.click();
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
      acc.qSales += day.qSalesQty;
      acc.sc += day.scQty;
      acc.excavatorHrs += day.excavatorHours;
      acc.trips += day.tipperTrips;
      acc.drillingFeet += day.drillingFeet;
      acc.crusherHrs += day.crusherExcavatorHours;
      return acc;
    }, { qc: 0, qs: 0, qSales: 0, sc: 0, excavatorHrs: 0, trips: 0, drillingFeet: 0, crusherHrs: 0 });

    const rows = dailyData.map(d => [
      formatDate(d.date),
      d.qcQty.toFixed(2),
      d.qsQty.toFixed(2),
      d.qSalesQty.toFixed(2),
      d.scQty.toFixed(2),
      d.excavatorHours.toFixed(1),
      d.tipperTrips,
      d.drillingFeet.toFixed(1),
      d.crusherExcavatorHours.toFixed(1)
    ]);

    rows.push([
      'Total',
      totals.qc.toFixed(2),
      totals.qs.toFixed(2),
      totals.qSales.toFixed(2),
      totals.sc.toFixed(2),
      totals.excavatorHrs.toFixed(1),
      totals.trips.toString(),
      totals.drillingFeet.toFixed(1),
      totals.crusherHrs.toFixed(1)
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Q-C', 'Q-Stock', 'Q-Sales', 'S-C', 'Soil/WR Exc. HRS', 'Soil/WR Tipper Trips', 'WR Drilling (FT)', 'Crusher Hrs']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] },
      styles: { fontSize: 8 }
    });

    doc.save(`Quarry_Daily_Production_${startDate}_to_${endDate}.pdf`);
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

            <button
              onClick={exportToExcel}
              className="px-4 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            
            <button
              onClick={exportToPDF}
              className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-200"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-C (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-Stock (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Q-Sales (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">S-C (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Soil/WR Exc. HRS</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Soil/WR Tipper Trips</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">WR Drilling (FT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Crusher HRS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Loading daily metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-sm font-bold text-slate-400 italic">
                    No data recorded for this window.
                  </td>
                </tr>
              ) : (
                dailyData.map((day, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-500 text-xs">{formatDate(day.date)}</td>
                    <td className="px-4 py-3 text-right">{day.qcQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.qsQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.qSalesQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.scQty.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{day.excavatorHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{day.tipperTrips}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{day.drillingFeet.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{day.crusherExcavatorHours.toFixed(1)}</td>
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
                    {dailyData.reduce((sum, d) => sum + d.qSalesQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.scQty, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.excavatorHours, 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.tipperTrips, 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.drillingFeet, 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.crusherExcavatorHours, 0).toFixed(1)}
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
