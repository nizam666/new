import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Plus, Trash2 } from 'lucide-react';

interface InvoiceItem {
  material: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [generatingInvoiceNumber, setGeneratingInvoiceNumber] = useState(true);
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: '5',
    amount_paid: '0',
    payment_mode: '',
    payment_date: '',
    empty_weight: '',
    gross_weight: '',
    net_weight: '',
    notes: '',
    terms_conditions: 'Payment due within 30 days.\nLate payments may incur additional charges.'
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { material: '', quantity: 0, rate: 0, amount: 0 }
  ]);

  const addItem = () => {
    setItems([...items, { material: '', quantity: 0, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }

    setItems(newItems);
  };

  const calculateTotals = () => {
    // Total is the sum of all item amounts (which include GST)
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;

    // Extract GST from the total (reverse calculation)
    // Formula: Base Amount = Total / (1 + tax_rate/100)
    const subtotal = total / (1 + taxRate / 100);
    const taxAmount = total - subtotal;

    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  useEffect(() => {
    generateInvoiceNumber();
  }, []);

  // Update quantity of first item when net weight changes
  useEffect(() => {
    if (formData.net_weight) {
      const netWeightValue = parseFloat(formData.net_weight);
      if (!isNaN(netWeightValue)) {
        setItems(currentItems => {
          if (currentItems.length > 0) {
            const newItems = [...currentItems];
            newItems[0] = { ...newItems[0], quantity: netWeightValue };
            // Recalculate amount for the updated item
            newItems[0].amount = newItems[0].quantity * newItems[0].rate;
            return newItems;
          }
          return currentItems;
        });
      }
    }
  }, [formData.net_weight]);

  const generateInvoiceNumber = async () => {
    try {
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `INV-${currentYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastInvoice = data[0].invoice_number;
        const lastNumber = parseInt(lastInvoice.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      const invoiceNumber = `INV-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
    } catch (error) {
      console.error('Error generating invoice number:', error);
    } finally {
      setGeneratingInvoiceNumber(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amountPaid = parseFloat(formData.amount_paid) || 0;
      const remainingBalance = total - amountPaid;

      let status = 'unpaid';
      if (remainingBalance <= 0) {
        status = 'paid';
      } else if (amountPaid > 0) {
        status = 'partial';
      }

      const paymentHistory = [];
      if (amountPaid > 0) {
        paymentHistory.push({
          amount: amountPaid,
          payment_mode: formData.payment_mode,
          payment_date: formData.payment_date,
          notes: 'Initial payment on invoice creation',
          recorded_at: new Date().toISOString()
        });
      }

      const { error } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: formData.invoice_number,
          customer_name: formData.customer_name,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          items: JSON.stringify(items),
          subtotal: subtotal,
          tax_rate: parseFloat(formData.tax_rate),
          tax_amount: taxAmount,
          total_amount: total,
          status: status,
          amount_paid: amountPaid,
          payment_mode: formData.payment_mode || null,
          payment_date: formData.payment_date || null,
          payment_history: paymentHistory.length > 0 ? JSON.stringify(paymentHistory) : null,
          notes: formData.notes || null,
          terms_conditions: formData.terms_conditions || null
        }]);

      if (error) throw error;

      alert('Invoice created successfully!');
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Create New Invoice</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Invoice Number *
          </label>
          <input
            type="text"
            required
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
            placeholder="Auto-generated"
            readOnly={generatingInvoiceNumber}
          />
          {generatingInvoiceNumber && (
            <p className="text-xs text-slate-500 mt-1">Generating invoice number...</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Customer Name *
          </label>
          <input
            type="text"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Customer name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Invoice Date *
          </label>
          <input
            type="date"
            required
            value={formData.invoice_date}
            onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Due Date (Optional)
          </label>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Weight Information Section */}
      <div className="border-t border-slate-200 pt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Weight Information (Optional)</h4>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Empty Weight */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Empty Weight (Tons)
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={formData.empty_weight}
                onChange={(e) => setFormData({ ...formData, empty_weight: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.000"
                title="Enter weight in tons"
              />
            </div>

            {/* Gross Weight */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Gross Weight (Tons)
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={formData.gross_weight}
                onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.000"
                title="Enter weight in tons"
              />
            </div>

            {/* Net Weight */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Net Weight (Tons)
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={formData.empty_weight && formData.gross_weight
                  ? (parseFloat(formData.gross_weight) - parseFloat(formData.empty_weight)).toFixed(3)
                  : formData.net_weight}
                onChange={(e) => setFormData({ ...formData, net_weight: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                placeholder="0.000"
                title="Enter weight in tons"
                readOnly={!!(formData.empty_weight && formData.gross_weight)}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Invoice Items</h4>
            <p className="text-xs text-slate-500 mt-1">Rate is GST inclusive (includes {formData.tax_rate}% GST)</p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        <div className="grid grid-cols-12 gap-3 px-3 mb-2">
          <div className="col-span-5 text-xs font-medium text-slate-600">Material/Description</div>
          <div className="col-span-2 text-xs font-medium text-slate-600">Quantity</div>
          <div className="col-span-2 text-xs font-medium text-slate-600">Rate (Inc. GST)</div>
          <div className="col-span-2 text-xs font-medium text-slate-600">Amount</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="col-span-5">
                <input
                  type="text"
                  required
                  value={item.material}
                  onChange={(e) => updateItem(index, 'material', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Material/Description"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Qty"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={item.rate || ''}
                  onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Rate"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  readOnly
                  value={item.amount.toFixed(2)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100"
                  placeholder="Amount"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tax Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.tax_rate}
            onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Base Amount:</span>
            <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">GST ({formData.tax_rate}%):</span>
            <span className="font-semibold text-slate-900">₹{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base pt-2 border-t border-slate-300">
            <span className="font-semibold text-slate-900">Total (Inc. GST):</span>
            <span className="font-bold text-blue-600 text-lg">₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Information Section */}
      <div className="border-t border-slate-200 pt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Payment Information (Optional)</h4>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount Received */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Amount Received
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount_paid}
                onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
              {parseFloat(formData.amount_paid) > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Balance: ₹{(total - parseFloat(formData.amount_paid)).toFixed(2)}
                </p>
              )}
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Mode
              </label>
              <select
                value={formData.payment_mode}
                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!formData.amount_paid || parseFloat(formData.amount_paid) === 0}
              >
                <option value="">Select mode</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Date
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!formData.amount_paid || parseFloat(formData.amount_paid) === 0}
              />
            </div>
          </div>
        </div>
      </div>


      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Additional notes for this invoice..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Terms & Conditions
        </label>
        <textarea
          value={formData.terms_conditions}
          onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Terms and conditions..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}
