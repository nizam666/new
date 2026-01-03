import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, DollarSign } from 'lucide-react';

interface AccountsFormProps {
  onSuccess: () => void;
}

export function AccountsForm({ onSuccess }: AccountsFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: 'invoice',
    invoice_number: '',
    customer_name: '',
    amount: '',
    amount_given: '',
    reason: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    status: 'pending',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('accounts')
        .insert([{
          transaction_type: formData.transaction_type,
          invoice_number: formData.invoice_number || null,
          customer_name: formData.customer_name,
          amount: parseFloat(formData.amount),
          amount_given: formData.amount_given ? parseFloat(formData.amount_given) : 0,
          reason: formData.reason,
          transaction_date: formData.transaction_date,
          payment_method: formData.payment_method || null,
          status: formData.status,
          notes: formData.notes || null,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Account record created successfully!');
      setFormData({
        transaction_type: 'invoice',
        invoice_number: '',
        customer_name: '',
        amount: '',
        amount_given: '',
        reason: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        status: 'pending',
        notes: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalance = () => {
    const amount = parseFloat(formData.amount) || 0;
    const given = parseFloat(formData.amount_given) || 0;
    return amount - given;
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Wallet className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">New Account Entry</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Transaction Type *
          </label>
          <select
            required
            value={formData.transaction_type}
            onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="invoice">Invoice</option>
            <option value="payment">Payment</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Invoice Number
          </label>
          <input
            type="text"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="INV-2024-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Customer/Recipient Name *
          </label>
          <input
            type="text"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Enter name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Transaction Date *
          </label>
          <input
            type="date"
            required
            value={formData.transaction_date}
            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Total Amount *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Amount Given/Paid
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="number"
              step="0.01"
              value={formData.amount_given}
              onChange={(e) => setFormData({ ...formData, amount_given: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {(formData.amount || formData.amount_given) && (
          <div className="md:col-span-2">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Outstanding Balance:</span>
                <span className={`text-lg font-bold ${calculateBalance() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{calculateBalance().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Method
          </label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Select Method</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="credit_card">Credit Card</option>
            <option value="online">Online Payment</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="pending">Pending</option>
            <option value="partial">Partial Payment</option>
            <option value="paid">Fully Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Reason/Purpose *
          </label>
          <input
            type="text"
            required
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="e.g., Material supply, Equipment rental, Services rendered"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Additional details or remarks..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </form>
  );
}
