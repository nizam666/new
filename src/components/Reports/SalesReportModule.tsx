import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, TrendingUp, Users, DollarSign } from 'lucide-react';

interface DispatchRecord {
  id: string;
  dispatch_date: string;
  material_type: string;
  quantity_dispatched: number;
  customer_name: string;
  delivery_status: string;
}

export function SalesReportModule() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchSalesData = useCallback(async () => {
    try {
      let query = supabase
        .from('dispatch_list')
        .select('*')
        .order('dispatch_date', { ascending: false });

      if (startDate) {
        query = query.gte('dispatch_date', startDate);
      }
      if (endDate) {
        query = query.lte('dispatch_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDispatches(data || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const calculateSummary = () => {
    const materialSales: { [key: string]: number } = {};
    const customerSales: { [key: string]: number } = {};
    let totalDispatched = 0;
    let totalDelivered = 0;
    let totalPending = 0;

    dispatches.forEach(dispatch => {
      if (!materialSales[dispatch.material_type]) {
        materialSales[dispatch.material_type] = 0;
      }
      materialSales[dispatch.material_type] += dispatch.quantity_dispatched;

      if (!customerSales[dispatch.customer_name]) {
        customerSales[dispatch.customer_name] = 0;
      }
      customerSales[dispatch.customer_name] += dispatch.quantity_dispatched;

      totalDispatched += dispatch.quantity_dispatched;
      if (dispatch.delivery_status === 'delivered') {
        totalDelivered += dispatch.quantity_dispatched;
      } else {
        totalPending += dispatch.quantity_dispatched;
      }
    });

    const topCustomers = Object.entries(customerSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topMaterials = Object.entries(materialSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      materialSales,
      customerSales,
      totalDispatched,
      totalDelivered,
      totalPending,
      topCustomers,
      topMaterials,
      uniqueCustomers: Object.keys(customerSales).length
    };
  };

  const formatMaterialType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading sales report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Sales Report</h3>
            <p className="text-sm text-slate-600">Material dispatch and customer sales summary</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Total Dispatched</p>
                <p className="text-2xl font-bold text-green-900">{summary.totalDispatched.toFixed(2)}</p>
                <p className="text-xs text-green-600">Tons</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Delivered</p>
                <p className="text-2xl font-bold text-blue-900">{summary.totalDelivered.toFixed(2)}</p>
                <p className="text-xs text-blue-600">Tons</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-xs text-amber-600 font-medium">In Transit</p>
                <p className="text-2xl font-bold text-amber-900">{summary.totalPending.toFixed(2)}</p>
                <p className="text-xs text-amber-600">Tons</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Customers</p>
                <p className="text-2xl font-bold text-purple-900">{summary.uniqueCustomers}</p>
                <p className="text-xs text-purple-600">Total</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Top 5 Customers by Volume</h4>
            <div className="space-y-3">
              {summary.topCustomers.map(([customer, quantity], index) => (
                <div key={customer} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{customer}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{quantity.toFixed(2)} tons</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(quantity / summary.totalDispatched) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {((quantity / summary.totalDispatched) * 100).toFixed(1)}% of total sales
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Top 5 Materials by Volume</h4>
            <div className="space-y-3">
              {summary.topMaterials.map(([material, quantity], index) => (
                <div key={material} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{formatMaterialType(material)}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{quantity.toFixed(2)} tons</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(quantity / summary.totalDispatched) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {((quantity / summary.totalDispatched) * 100).toFixed(1)}% of total volume
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Delivery Performance</h4>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {summary.totalDispatched > 0
                    ? ((summary.totalDelivered / summary.totalDispatched) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{dispatches.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Avg Order Size</p>
                <p className="text-2xl font-bold text-slate-900">
                  {dispatches.length > 0
                    ? (summary.totalDispatched / dispatches.length).toFixed(2)
                    : 0} tons
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
