import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  MapPin,
  Building
} from 'lucide-react';

interface InventoryItem {
  id: string;
  item_name: string;
  item_code: string;
  category: string;
  quantity: number;
  unit: string;
  minimum_quantity: number;
  location: string;
  supplier: string;
  last_restock_date: string;
  notes: string;
  created_at: string;
}

interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  totalCategories: number;
  totalValue: number;
}

export function InventoryDetails() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    totalItems: 0,
    lowStockItems: 0,
    totalCategories: 0,
    totalValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;

      setItems(data || []);

      const lowStockItems = data?.filter(item => item.quantity <= item.minimum_quantity).length || 0;
      const categories = new Set(data?.map(item => item.category));

      setStats({
        totalItems: data?.length || 0,
        lowStockItems,
        totalCategories: categories.size,
        totalValue: 0
      });
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'low-stock') return item.quantity <= item.minimum_quantity;
    return item.category === filter;
  });

  const categories = Array.from(new Set(items.map(item => item.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-cyan-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalItems}</p>
          <p className="text-sm text-slate-600">Total Items</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.lowStockItems}</p>
          <p className="text-sm text-slate-600">Low Stock Items</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalCategories}</p>
          <p className="text-sm text-slate-600">Categories</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {items.filter(i => i.quantity > i.minimum_quantity).length}
          </p>
          <p className="text-sm text-slate-600">In Stock</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Inventory Items</h3>
              <p className="text-sm text-slate-600">Click on an item to view details</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('low-stock')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'low-stock'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Low Stock
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === cat
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No inventory items found. Add your first item to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredItems.map((item) => {
              const isLowStock = item.quantity <= item.minimum_quantity;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg ${isLowStock ? 'bg-red-100' : 'bg-cyan-100'} flex items-center justify-center flex-shrink-0`}>
                        <Package className={`w-6 h-6 ${isLowStock ? 'text-red-600' : 'text-cyan-600'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{item.item_name}</h4>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mt-0.5">
                          <span className="font-mono">{item.item_code}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-medium text-slate-600">Quantity</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-medium text-slate-600">Min Level</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.minimum_quantity} {item.unit}
                      </p>
                    </div>

                    {item.location && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-slate-600" />
                          <span className="text-xs font-medium text-slate-600">Location</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">{item.location}</p>
                      </div>
                    )}

                    {item.supplier && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Building className="w-4 h-4 text-slate-600" />
                          <span className="text-xs font-medium text-slate-600">Supplier</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">{item.supplier}</p>
                      </div>
                    )}
                  </div>

                  {selectedItem?.id === item.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                      {item.last_restock_date && (
                        <div>
                          <span className="text-sm font-medium text-slate-700">Last Restock: </span>
                          <span className="text-sm text-slate-600">
                            {new Date(item.last_restock_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {item.notes && (
                        <div>
                          <span className="text-sm font-medium text-slate-700">Notes: </span>
                          <p className="text-sm text-slate-600 mt-1">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
