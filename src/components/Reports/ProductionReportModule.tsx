import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Factory, Calendar, TrendingUp, Package } from 'lucide-react';

interface ProductionStock {
  id: string;
  stock_date: string;
  material_type: string;
  quantity: number;
  unit: string;
  location: string;
  quality_grade: string;
}

export function ProductionReportModule() {
  const [stocks, setStocks] = useState<ProductionStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchProductionData = useCallback(async () => {
    try {
      let query = supabase
        .from('production_stock')
        .select('*')
        .order('stock_date', { ascending: false });

      if (startDate) {
        query = query.gte('stock_date', startDate);
      }
      if (endDate) {
        query = query.lte('stock_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStocks(data || []);
    } catch (error) {
      console.error('Error fetching production data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchProductionData();
  }, [fetchProductionData]);

  const calculateSummary = () => {
    const materialSummary: { [key: string]: number } = {};
    let totalQuantity = 0;

    stocks.forEach(stock => {
      if (!materialSummary[stock.material_type]) {
        materialSummary[stock.material_type] = 0;
      }
      materialSummary[stock.material_type] += stock.quantity;
      totalQuantity += stock.quantity;
    });

    return { materialSummary, totalQuantity };
  };

  const formatMaterialType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const { materialSummary, totalQuantity } = calculateSummary();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading production report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Factory className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Crusher Production Report</h3>
            <p className="text-sm text-slate-600">Material production summary by crusher manager</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Production</p>
                <p className="text-2xl font-bold text-blue-900">{totalQuantity.toFixed(2)}</p>
                <p className="text-xs text-blue-600">Tons</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Material Types</p>
                <p className="text-2xl font-bold text-green-900">{Object.keys(materialSummary).length}</p>
                <p className="text-xs text-green-600">Different Materials</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Records</p>
                <p className="text-2xl font-bold text-purple-900">{stocks.length}</p>
                <p className="text-xs text-purple-600">Production Entries</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Production by Material Type</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(materialSummary).map(([material, quantity]) => (
              <div key={material} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-1">{formatMaterialType(material)}</p>
                <p className="text-2xl font-bold text-slate-900">{quantity.toFixed(2)}</p>
                <p className="text-xs text-slate-600">Tons</p>
                <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(quantity / totalQuantity) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {((quantity / totalQuantity) * 100).toFixed(1)}% of total
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Detailed Production Records</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Material</th>
                  <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Quantity</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Grade</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr key={stock.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {new Date(stock.stock_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatMaterialType(stock.material_type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                      {stock.quantity.toFixed(2)} {stock.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {stock.location || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {stock.quality_grade ? formatMaterialType(stock.quality_grade) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
