import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Calendar, Zap, TrendingUp, IndianRupee, ChevronDown, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RATE_PER_UNIT = 8.80;
const MONTHLY_FIXED = 18480;
const DAILY_FIXED = MONTHLY_FIXED / 30; // 616
const TAX_RATE = 0.05; // 5%

interface DailyRow {
  report_date: string;
  starting_reading: string;
  ending_reading: string;
  units_consumed: number;  // sum of all records on this date
  unitAmount: number;
  fixedCost: number;
  tax: number;
  sumAmount: number;
}

function getMonthRange(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const from = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
  const to = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  
  return { from, to };
}

export function EBCalculator() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getMonthRange(selectedYear, selectedMonth);

      const { data, error } = await supabase
        .from('eb_reports')
        .select('report_date, units_consumed, starting_reading, ending_reading')
        .gte('report_date', from)
        .lte('report_date', to)
        .order('report_date', { ascending: true })
        .order('created_at', { ascending: true }); // Ensure chronological order for same day

      if (error) throw error;

      // 1. Group existing data from DB
      const grouped: Record<string, { units: number, start: string, end: string }> = {};
      for (const row of data || []) {
        const d = row.report_date;
        if (!grouped[d]) {
          grouped[d] = {
            units: 0,
            start: row.starting_reading?.['KW CH'] || '-',
            end: row.ending_reading?.['KW CH'] || '-'
          };
        }
        grouped[d].units += (row.units_consumed ?? 0);
        if (row.ending_reading?.['KW CH']) {
          grouped[d].end = row.ending_reading['KW CH'];
        }
      }

      // 2. Generate dates up to today (don't show future data)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
      
      // Determine the last day to display
      let displayUntilDay = lastDayOfMonth.getDate();
      
      // If the selected month is the current month, only show up to today
      if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth()) {
        displayUntilDay = today.getDate();
      } else if (new Date(selectedYear, selectedMonth, 1) > today) {
        // If the selected month is in the future, don't show any days
        displayUntilDay = 0;
      }

      const calculated: DailyRow[] = [];

      for (let day = 1; day <= displayUntilDay; day++) {
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = grouped[dateStr] || { units: 0, start: '-', end: '-' };
        
        const unitAmount = dayData.units * RATE_PER_UNIT;
        const fixedCost = DAILY_FIXED; // Still apply fixed cost even if units are 0
        const tax = (unitAmount + fixedCost) * TAX_RATE;
        const sumAmount = unitAmount + fixedCost + tax;

        calculated.push({
          report_date: dateStr,
          starting_reading: dayData.start,
          ending_reading: dayData.end,
          units_consumed: dayData.units,
          unitAmount,
          fixedCost,
          tax,
          sumAmount
        });
      }

      setRows(calculated);

    } catch (err) {
      console.error('Error fetching EB data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => ({
      units: acc.units + r.units_consumed,
      unitAmount: acc.unitAmount + r.unitAmount,
      fixedCost: acc.fixedCost + r.fixedCost,
      tax: acc.tax + r.tax,
      sumAmount: acc.sumAmount + r.sumAmount,
    }),
    { units: 0, unitAmount: 0, fixedCost: 0, tax: 0, sumAmount: 0 }
  );

  const fmt = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtUnits = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('EB Calculator');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 25 },
      { header: 'Start Reading', key: 'start', width: 20 },
      { header: 'End Reading', key: 'end', width: 20 },
      { header: 'Units (kWh)', key: 'units', width: 20 },
      { header: 'Unit Amount (₹)', key: 'unitAmount', width: 20 },
      { header: 'Fixed Cost (₹)', key: 'fixed', width: 20 },
      { header: 'Tax (₹)', key: 'tax', width: 15 },
      { header: 'Sum Amount (₹)', key: 'sumAmount', width: 20 }
    ];

    const colColors = [
      { bg: 'F8FAFC', fg: '64748B' },
      { bg: 'F8FAFC', fg: '64748B' },
      { bg: 'F8FAFC', fg: '64748B' },
      { bg: 'FFFBEB', fg: 'D97706' },
      { bg: 'EFF6FF', fg: '3B82F6' },
      { bg: 'F8FAFC', fg: '64748B' },
      { bg: 'FFF1F2', fg: 'F43F5E' },
      { bg: 'F0FDF4', fg: '10B981' }
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

    rows.forEach(row => {
      worksheet.addRow({
        date: new Date(row.report_date).toLocaleDateString('en-IN', {
          weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
        }),
        start: parseFloat(row.starting_reading) || 0,
        end: parseFloat(row.ending_reading) || 0,
        units: row.units_consumed,
        unitAmount: row.unitAmount,
        fixed: row.fixedCost,
        tax: row.tax,
        sumAmount: row.sumAmount
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.font = { name: 'Arial', size: 10 };
        row.alignment = { vertical: 'middle' };

        for (let i = 2; i <= 8; i++) {
          const cell = row.getCell(i);
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
      }
    });

    const totalRow = worksheet.addRow({
      date: `Total (${rows.length} days)`,
      units: totals.units,
      unitAmount: totals.unitAmount,
      fixed: totals.fixedCost,
      tax: totals.tax,
      sumAmount: totals.sumAmount
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

    for (let i = 4; i <= 8; i++) {
      const cell = totalRow.getCell(i);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `EB_Calculator_${MONTHS[selectedMonth]}_${selectedYear}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(18);
    doc.text(`EB Calculator Report - ${MONTHS[selectedMonth]} ${selectedYear}`, 14, 20);

    const tableColumn = [
      'Date', 
      'Start Reading', 
      'End Reading', 
      'Units (kWh)', 
      'Unit Amount (Rs)', 
      'Fixed Cost (Rs)', 
      'Tax (Rs)', 
      'Sum Amount (Rs)'
    ];

    const tableRows = rows.map(row => [
      new Date(row.report_date).toLocaleDateString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
      }),
      row.starting_reading,
      row.ending_reading,
      row.units_consumed.toFixed(2),
      row.unitAmount.toFixed(2),
      row.fixedCost.toFixed(2),
      row.tax.toFixed(2),
      row.sumAmount.toFixed(2)
    ]);

    tableRows.push([
      'Total',
      '',
      '',
      totals.units.toFixed(2),
      totals.unitAmount.toFixed(2),
      totals.fixedCost.toFixed(2),
      totals.tax.toFixed(2),
      totals.sumAmount.toFixed(2)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`EB_Calculator_${MONTHS[selectedMonth]}_${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 md:p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold">EB Calculator</h2>
            <p className="text-indigo-200 text-xs md:text-sm">Daily electricity cost breakdown</p>
          </div>
        </div>

        {/* Rate Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Rate/Unit', value: '₹8.80' },
            { label: 'Daily Fixed', value: '₹616' },
            { label: 'Monthly Fixed', value: '₹18,480' },
            { label: 'Tax Rate', value: '5%' },
          ].map(item => (
            <div key={item.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-indigo-200 text-xs font-medium">{item.label}</p>
              <p className="text-white text-lg font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Month / Year Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-medium text-slate-700">Period:</span>
          </div>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <span className="text-sm text-slate-500">
            {rows.length} day{rows.length !== 1 ? 's' : ''} found
          </span>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 ml-auto">
            <button
              onClick={exportToExcel}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-600 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              EXCEL
            </button>
            <button
              onClick={exportToPDF}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-rose-500" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {[
            { label: 'Total Units', value: fmtUnits(totals.units) + ' kWh', color: 'yellow', icon: Zap },
            { label: 'Unit Amount', value: fmt(totals.unitAmount), color: 'blue', icon: IndianRupee },
            { label: 'Fixed Cost', value: fmt(totals.fixedCost), color: 'slate', icon: IndianRupee },
            { label: 'Total Tax (5%)', value: fmt(totals.tax), color: 'orange', icon: TrendingUp },
            { label: 'Total Payable', value: fmt(totals.sumAmount), color: 'green', icon: IndianRupee },
          ].map(card => (
            <div
              key={card.label}
              className={`bg-${card.color}-50 border border-${card.color}-200 rounded-xl p-3 md:p-4`}
            >
              <p className={`text-[10px] md:text-xs font-medium text-${card.color}-600 mb-1`}>{card.label}</p>
              <p className={`text-sm md:text-base font-bold text-${card.color}-900 break-words`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Daily EB Cost — {MONTHS[selectedMonth]} {selectedYear}
          </h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Fixed: ₹616/day · Rate: ₹8.80/unit · Tax: 5%
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <Calculator className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p>Loading EB data...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Zap className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No EB reports found</p>
            <p className="text-sm mt-1">Submit Daily EB Reports to see calculations here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    End
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-yellow-700 uppercase tracking-wider">
                    Units (kWh)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Unit Amount<br />
                    <span className="normal-case font-normal text-blue-400">(Units × ₹8.80)</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Fixed Cost<br />
                    <span className="normal-case font-normal text-slate-400">(₹18480 / 30)</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-orange-700 uppercase tracking-wider">
                    Tax<br />
                    <span className="normal-case font-normal text-orange-400">(Col 2+3) × 5%</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50">
                    Sum Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr
                    key={row.report_date}
                    className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {new Date(row.report_date).toLocaleDateString('en-IN', {
                        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {row.starting_reading}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {row.ending_reading}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="font-semibold text-yellow-700">{fmtUnits(row.units_consumed)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-blue-700">
                      {fmt(row.unitAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                      {fmt(row.fixedCost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600">
                      {fmt(row.tax)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right bg-green-50">
                      <span className="font-bold text-green-800">{fmt(row.sumAmount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  <td colSpan={3} className="px-4 py-4 text-sm font-bold text-indigo-900">
                    TOTAL ({rows.length} day{rows.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-bold text-yellow-800">
                    {fmtUnits(totals.units)} kWh
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-bold text-blue-800">
                    {fmt(totals.unitAmount)}
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-bold text-slate-700">
                    {fmt(totals.fixedCost)}
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-bold text-orange-800">
                    {fmt(totals.tax)}
                  </td>
                  <td className="px-4 py-4 text-sm text-right bg-green-100">
                    <span className="text-base font-extrabold text-green-900">{fmt(totals.sumAmount)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
