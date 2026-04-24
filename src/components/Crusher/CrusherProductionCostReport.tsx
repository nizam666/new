import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Zap, Truck, DollarSign, Calendar } from 'lucide-react';

interface DailyCostData {
  date: string;
  qc_qty: number;
  sc_qty: number;
  total_qty: number;
  eb_units: number;
  units_per_ton: number;
}

export function CrusherProductionCostReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DailyCostData[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Transport Data (QC and SC)
      const { data: transportData, error: transportError } = await supabase
        .from('transport_records')
        .select('date, quantity, from_location, to_location')
        .gte('date', startDate)
        .lte('date', endDate)
        .or('and(from_location.eq.Quarry,to_location.eq.Crusher),and(from_location.eq.Stockyard,to_location.eq.Crusher)');

      if (transportError) throw transportError;

      // 2. Fetch EB Reports Data
      const { data: ebData, error: ebError } = await supabase
        .from('eb_reports')
        .select('report_date, meter_reading_start, meter_reading_end')
        .gte('report_date', startDate)
        .lte('report_date', endDate);

      if (ebError) throw ebError;

      // 3. Process and Combine
      const combined: Record<string, DailyCostData> = {};

      // Initialize with dates from range if needed, or just from data
      transportData?.forEach(row => {
        if (!combined[row.date]) {
          combined[row.date] = { date: row.date, qc_qty: 0, sc_qty: 0, total_qty: 0, eb_units: 0, units_per_ton: 0 };
        }
        const qty = parseFloat(String(row.quantity)) || 0;
        if (row.from_location === 'Quarry') {
          combined[row.date].qc_qty += qty;
        } else {
          combined[row.date].sc_qty += qty;
        }
        combined[row.date].total_qty += qty;
      });

      ebData?.forEach(row => {
        if (!combined[row.report_date]) {
          combined[row.report_date] = { date: row.report_date, qc_qty: 0, sc_qty: 0, total_qty: 0, eb_units: 0, units_per_ton: 0 };
        }
        const units = (row.meter_reading_end || 0) - (row.meter_reading_start || 0);
        combined[row.report_date].eb_units += units;
      });

      // Calculate ratios
      const result = Object.values(combined).map(day => ({
        ...day,
        units_per_ton: day.total_qty > 0 ? day.eb_units / day.total_qty : 0
      })).sort((a, b) => b.date.localeCompare(a.date));

      setData(result);
    } catch (error) {
      console.error('Error fetching production cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = data.reduce((acc, curr) => ({
    qc: acc.qc + curr.qc_qty,
    sc: acc.sc + curr.sc_qty,
    total: acc.total + curr.total_qty,
    units: acc.units + curr.eb_units
  }), { qc: 0, sc: 0, total: 0, units: 0 });

  const avgUnitsPerTon = totals.total > 0 ? totals.units / totals.total : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Average Production Cost</h3>
              <p className="text-sm text-slate-500 font-medium">Daily EB Units vs Transported Tonnage (QC & SC)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-slate-400 font-bold">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total QC</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{totals.qc.toFixed(2)} <span className="text-sm font-normal text-slate-400">Tons</span></p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total SC</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{totals.sc.toFixed(2)} <span className="text-sm font-normal text-slate-400">Tons</span></p>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <span className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Total EB Units</span>
            </div>
            <p className="text-2xl font-black text-yellow-900">{totals.units.toFixed(1)} <span className="text-sm font-normal text-yellow-600/60">kWh</span></p>
          </div>
          <div className="bg-indigo-600 rounded-2xl p-5 shadow-lg shadow-indigo-100">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-indigo-100" />
              <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Avg Units/Ton</span>
            </div>
            <p className="text-2xl font-black text-white">{avgUnitsPerTon.toFixed(2)} <span className="text-sm font-normal text-indigo-100/60">kWh/T</span></p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">QC Qty (T)</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">SC Qty (T)</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Qty (T)</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">EB Units (kWh)</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Units / Ton</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">Loading production data...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No records found for the selected range</td>
                </tr>
              ) : (
                data.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">
                          {new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'long' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-700">{day.qc_qty.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-700">{day.sc_qty.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
                        <span className="text-sm font-black text-slate-900">{day.total_qty.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-yellow-700">{day.eb_units.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-lg font-black text-sm ${
                        day.units_per_ton > avgUnitsPerTon * 1.2 ? 'bg-red-50 text-red-700' : 
                        day.units_per_ton < avgUnitsPerTon * 0.8 ? 'bg-green-50 text-green-700' : 
                        'bg-indigo-50 text-indigo-700'
                      }`}>
                        {day.units_per_ton.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
