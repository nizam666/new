import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Calendar, MapPin, Award } from 'lucide-react';

interface ProductionStock {
  id: string;
  material_type: string;
  quantity: number;
  unit: string;
  stock_date: string;
  location: string;
  quality_grade: string;
  notes: string;
  created_at: string;
}

export function ProductionStockDetails() {
  const [stocks, setStocks] = useState<ProductionStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStocks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('production_stock')
        .select('*')
        .order('stock_date', { ascending: false });

      if (error) throw error;
      setStocks(data || []);
    } catch (error) {
      console.error('Error fetching production stock:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const formatMaterialType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatQualityGrade = (grade: string) => {
    if (!grade) return 'N/A';
    return grade.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredStocks = stocks
    .filter(stock => {
      if (filter === 'all') return true;
      return stock.material_type === filter;
    })
    .filter(stock => {
      if (!searchTerm) return true;
      return (
        stock.material_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.quality_grade?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const calculateTotals = () => {
    const materialTotals: { [key: string]: number } = {};
    filteredStocks.forEach(stock => {
      if (!materialTotals[stock.material_type]) {
        materialTotals[stock.material_type] = 0;
      }
      materialTotals[stock.material_type] += stock.quantity;
    });
    return materialTotals;
  };

  const totals = calculateTotals();
  const uniqueMaterials = Array.from(new Set(stocks.map(s => s.material_type)));

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading production stock...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Stock Items</p>
              <p className="text-xl font-bold text-blue-900">{filteredStocks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Material Types</p>
              <p className="text-xl font-bold text-green-900">{uniqueMaterials.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-purple-600 font-medium">Total Quantity</p>
              <p className="text-xl font-bold text-purple-900">
                {filteredStocks.reduce((sum, s) => sum + s.quantity, 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Stock Summary by Material</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(totals).map(([material, quantity]) => (
              <div key={material} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">{formatMaterialType(material)}</p>
                <p className="text-lg font-bold text-slate-900">{quantity.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by material, location, or grade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Materials</option>
            {uniqueMaterials.map(material => (
              <option key={material} value={material}>
                {formatMaterialType(material)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredStocks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No production stock found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStocks.map((stock) => (
            <div
              key={stock.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {formatMaterialType(stock.material_type)}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {stock.quantity.toFixed(2)} {stock.unit}
                    </p>
                  </div>
                </div>
                {stock.quality_grade && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                    <Award className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-800">
                      {formatQualityGrade(stock.quality_grade)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Stock Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(stock.stock_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {stock.location && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Location</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900">{stock.location}</p>
                    </div>
                  </div>
                )}
              </div>

              {stock.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{stock.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
