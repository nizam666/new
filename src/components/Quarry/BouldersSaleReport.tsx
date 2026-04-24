import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Calendar, Truck, Package, Search } from 'lucide-react';

interface BouldersSale {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  vehicle_no: string;
  material_name: string;
  quantity: number;
}

export function BouldersSaleReport() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<BouldersSale[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      // We fetch invoices and filter for Q-Boulders
      // Note: Items are stored as JSON in the 'items' column or sometimes in 'material_name' for legacy.
      // But based on the code, they are in 'items'.
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, customer_name, vehicle_no, items, total_amount')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const filteredSales: BouldersSale[] = [];

      invoices?.forEach(inv => {
        let items = [];
        try {
          items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        } catch (e) {
          console.error('Error parsing items for invoice:', inv.invoice_number);
        }

        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const matName = item.material || item.material_name || '';
            if (matName === 'Q-Boulders') {
              filteredSales.push({
                id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                customer_name: inv.customer_name,
                vehicle_no: inv.vehicle_no,
                material_name: matName,
                quantity: item.quantity || 0
              });
            }
          });
        }
      });

      setSales(filteredSales);
    } catch (error) {
      console.error('Error fetching boulders sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = sales.filter(s => 
    s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.vehicle_no && s.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = filteredData.reduce((acc, curr) => ({
    totalQty: acc.totalQty + curr.quantity,
    count: acc.count + 1
  }), { totalQty: 0, count: 0 });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Boulders Sale Report</h3>
              <p className="text-sm text-slate-500 font-medium">Tracking sales for Q-Boulders material</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <span className="text-slate-400 font-bold">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice, customer or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-orange-600" />
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">Total Quantity</span>
            </div>
            <p className="text-2xl font-black text-orange-900">{stats.totalQty.toFixed(3)} <span className="text-sm font-normal text-orange-700/60">Tons</span></p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Total Invoices</span>
            </div>
            <p className="text-2xl font-black text-blue-900">{stats.count} <span className="text-sm font-normal text-blue-700/60">Tickets</span></p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice / Customer</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Vehicle</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">Loading sales records...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">No Q-Boulders sales found</td>
                </tr>
              ) : (
                filteredData.map((sale) => (
                  <tr key={`${sale.id}-${sale.invoice_number}`} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">
                          {new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-blue-600">{sale.invoice_number}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight truncate max-w-[200px]">{sale.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{sale.vehicle_no || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900">{sale.quantity.toFixed(3)}</span>
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
