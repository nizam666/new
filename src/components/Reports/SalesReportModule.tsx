import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

interface DailySalesItem {
  date: string;
  mSand: number;
  pSand: number;
  agg40: number;
  agg20: number;
  agg12: number;
  agg6: number;
  gbs: number;
  dust: number;
  wetMix: number;
  allMix: number;
  'S-bolder': number;
  totalSales: number;
}

export function SalesReportModule() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dailyData, setDailyData] = useState<DailySalesItem[]>([]);

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
      const { data: invoiceData, error } = await supabase
        .from('invoices')
        .select('items, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      if (error) throw error;

      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const reportRows: DailySalesItem[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        let mSand = 0, pSand = 0;
        let agg40 = 0, agg20 = 0, agg12 = 0, agg6 = 0;
        let gbs = 0, dust = 0, wetMix = 0, allMix = 0;
        let sBolder = 0;

        invoiceData?.filter(inv => inv.invoice_date === dateStr).forEach(inv => {
          let items = [];
          try {
            items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
          } catch (e) {}
          
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matName = (item.material || item.material_name || '').toLowerCase();
              const qty = parseFloat(item.quantity) || (parseFloat(item.gross_weight) - parseFloat(item.empty_weight)) || 0;
              
              if (matName.includes('m-sand') || matName.includes('m sand')) {
                mSand += qty;
              } else if (matName.includes('p-sand') || matName.includes('p sand')) {
                pSand += qty;
              } else if (matName.includes('40mm')) {
                agg40 += qty;
              } else if (matName.includes('20mm')) {
                agg20 += qty;
              } else if (matName.includes('12mm')) {
                agg12 += qty;
              } else if (matName.includes('6mm')) {
                agg6 += qty;
              } else if (matName.includes('gbs')) {
                gbs += qty;
              } else if (matName.includes('dust')) {
                dust += qty;
              } else if (matName.includes('wet mix')) {
                wetMix += qty;
              } else if (matName.includes('all mix')) {
                allMix += qty;
              } else if (matName.includes('s-bolder') || matName.includes('s bolder') || matName.includes('stockyard boulder')) {
                sBolder += qty;
              }
            });
          }
        });

        const totalSales = mSand + pSand + agg40 + agg20 + agg12 + agg6 + gbs + dust + wetMix + allMix + sBolder;

        return {
          date: dateStr,
          mSand,
          pSand,
          agg40,
          agg20,
          agg12,
          agg6,
          gbs,
          dust,
          wetMix,
          allMix,
          'S-bolder': sBolder,
          totalSales
        };
      });

      setDailyData(reportRows);
    } catch (err) {
      console.error('Error fetching daily sales report:', err);
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
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Sales Report</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Day-wise Material Sales Breakdowns</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-1">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-slate-400 font-black text-xs">TO</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
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
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">M-Sand (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">P-Sand (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Agg 40mm (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Agg 20mm (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Agg 12mm (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Agg 6mm (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">GBS (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Dust (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Wet Mix (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">All Mix (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">S-Bolder (MT)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-right bg-indigo-50/50 text-indigo-700">Total Sales (MT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Loading daily metrics...</p>
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
                    <td className="px-4 py-3 font-bold text-slate-500 text-xs">{formatDate(day.date)}</td>
                    <td className="px-4 py-3 text-right">{day.mSand.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.pSand.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.agg40.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.agg20.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.agg12.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.agg6.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.gbs.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.dust.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.wetMix.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day.allMix.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right">{day['S-bolder'].toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right bg-indigo-50/20 font-bold text-indigo-700">{day.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && dailyData.length > 0 && (
              <tfoot className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.mSand, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.pSand, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.agg40, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.agg20, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.agg12, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.agg6, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.gbs, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.dust, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.wetMix, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d.allMix, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dailyData.reduce((sum, d) => sum + d['S-bolder'], 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right bg-indigo-50/50 font-black text-indigo-800">
                    {dailyData.reduce((sum, d) => sum + d.totalSales, 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
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
