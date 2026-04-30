import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

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
