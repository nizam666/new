import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, DollarSign, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';

interface Account {
  id: string;
  transaction_type: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  amount_given: number;
  balance: number;
  reason: string;
  transaction_date: string;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
}

export function AccountsDetails() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-amber-100 text-amber-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'payment':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'expense':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Wallet className="w-5 h-5 text-slate-600" />;
    }
  };

  const filteredAccounts = accounts
    .filter(account => {
      if (filter === 'all') return true;
      return account.status === filter;
    })
    .filter(account => {
      if (!searchTerm) return true;
      return (
        account.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const calculateTotals = () => {
    const totalAmount = filteredAccounts.reduce((sum, acc) => sum + acc.amount, 0);
    const totalPaid = filteredAccounts.reduce((sum, acc) => sum + acc.amount_given, 0);
    const totalBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    return { totalAmount, totalPaid, totalBalance };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Amount</p>
              <p className="text-xl font-bold text-blue-900">₹{totals.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Total Paid</p>
              <p className="text-xl font-bold text-green-900">₹{totals.totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium">Outstanding</p>
              <p className="text-xl font-bold text-red-900">₹{totals.totalBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by customer, invoice, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <Wallet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No accounts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                    {getTransactionIcon(account.transaction_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{account.customer_name}</h3>
                      {account.invoice_number && (
                        <span className="text-sm text-slate-500">({account.invoice_number})</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 capitalize">{account.transaction_type}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                  {account.status.toUpperCase()}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-1">Reason:</p>
                <p className="text-base font-medium text-slate-900">{account.reason}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                  <p className="text-base font-semibold text-slate-900">₹{account.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Amount Paid</p>
                  <p className="text-base font-semibold text-green-600">₹{account.amount_given.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Balance</p>
                  <p className={`text-base font-semibold ${account.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{account.balance.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(account.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {account.payment_method && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Payment Method</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">
                    {account.payment_method.replace('_', ' ')}
                  </p>
                </div>
              )}

              {account.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{account.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
