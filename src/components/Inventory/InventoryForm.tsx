import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Save } from 'lucide-react';

const generateItemCode = () => {
  const prefix = 'INV';
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${prefix}-${randomNum}`;
};

const categories = [
  'Equipment',
  'Tools',
  'Spare Parts',
  'Explosives',
  'Safety Gear',
  'Consumables',
  'Other'
];

const units = [
  'pieces',
  'kg',
  'liters',
  'meters',
  'boxes',
  'sets',
  'units'
];

const storageAreas = [
  'Main Store',
  'Tool Room',
  'Equipment Shed',
  'Yard Storage',
  'Office Supply Closet',
  'Workshop',
  'Field Storage',
  'Security Cabin',
  'Other'
];

const statuses = [
  'In Stock',
  'Assigned',
  'In Maintenance',
  'Disposed',
  'Lost/Stolen'
];

const assignedTo = [
  'Not Assigned',
  'Site Supervisor',
  'Foreman',
  'Operator',
  'Technician',
  'Safety Officer',
  'Office Staff'
];


export function InventoryForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  interface FormData {
    item_name: string;
    item_code: string;
    category: string;
    quantity: string;
    unit: string;
    status: string;
    assigned_to: string;
    assigned_date: string;
    expected_return_date: string;
    storage_location: string;
    minimum_quantity: string;
    location: string;
    given_to: string;
    supplier: string;
    last_restock_date: string;
    notes: string;
  }

  const initialFormData: FormData = {
    item_name: '',
    item_code: generateItemCode(),
    category: '',
    quantity: '',
    unit: '',
    status: 'In Stock',
    assigned_to: 'Not Assigned',
    assigned_date: '',
    expected_return_date: '',
    storage_location: 'Main Store',
    minimum_quantity: '',
    location: 'Main Store',
    given_to: '',
    supplier: '',
    last_restock_date: '',
    notes: ''
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .insert([
          {
            item_name: formData.item_name,
            item_code: formData.item_code,
            category: formData.category,
            quantity: parseFloat(formData.quantity) || 0,
            unit: formData.unit,
            minimum_quantity: parseFloat(formData.minimum_quantity) || 0,
            location: formData.location,
            supplier: formData.supplier,
            given_to: formData.given_to || null,
            last_restock_date: formData.last_restock_date || null,
            notes: formData.notes
          }
        ]);

      if (error) throw error;

      const resetForm = () => {
        setFormData({
          ...initialFormData,
          item_code: generateItemCode()
        });
      };

      resetForm();

      alert('Inventory item added successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error adding inventory item: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
          <Package className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Add Inventory Item</h3>
          <p className="text-sm text-slate-600">Add new item to inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Item Name *
          </label>
          <input
            type="text"
            value={formData.item_name}
            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="e.g., Drill Bits"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Item Code
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.item_code}
              readOnly
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed"
              aria-label="Auto-generated item code"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-sm">
              Auto-generated
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Unit
          </label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">Select unit</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Minimum Quantity (Alert Level)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.minimum_quantity}
            onChange={(e) => setFormData({ ...formData, minimum_quantity: e.target.value })}
            min="0"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="0"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Storage Area *
            </label>
            <select
              value={formData.storage_location}
              onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {storageAreas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Item Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assigned To
            </label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {assignedTo.map((person) => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </div>

          {formData.assigned_to !== 'Not Assigned' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assignment Date
              </label>
              <input
                type="date"
                value={formData.assigned_date}
                onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          )}

          {formData.assigned_to !== 'Not Assigned' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expected Return Date
              </label>
              <input
                type="date"
                value={formData.expected_return_date}
                onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Given To
          </label>
          <input
            type="text"
            value={formData.given_to}
            onChange={(e) => setFormData({ ...formData, given_to: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Enter recipient's name or leave blank"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Supplier
          </label>
          <input
            type="text"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Supplier name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Last Restock Date
          </label>
          <input
            type="date"
            value={formData.last_restock_date}
            onChange={(e) => setFormData({ ...formData, last_restock_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Additional details about this item..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
