import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface Account {
  id: string;
  transaction_type: 'val' | 'income' | 'expense'; // deduced from usage, refined below
  amount: number;
  transaction_date: string;
  category: string;
  payment_method: string;
}

export function AccountingReportModule() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAccountingData = useCallback(async () => {
    try {
      let query = supabase
        .from('accounts')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounting data:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAccountingData();
  }, [fetchAccountingData]);

  const calculateSummary = () => {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: { [key: string]: number } = {};
    const paymentMethodBreakdown: { [key: string]: number } = {};

    accounts.forEach(account => {
      if (account.transaction_type === 'income') {
        totalIncome += account.amount;
      } else {
        totalExpense += account.amount;
      }

      if (!categoryBreakdown[account.category]) {
        categoryBreakdown[account.category] = 0;
      }
      categoryBreakdown[account.category] += account.amount;

      if (!paymentMethodBreakdown[account.payment_method]) {
        paymentMethodBreakdown[account.payment_method] = 0;
      }
      paymentMethodBreakdown[account.payment_method] += account.amount;
    });

    const netBalance = totalIncome - totalExpense;

    const topExpenses = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalIncome,
      totalExpense,
      netBalance,
      categoryBreakdown,
      paymentMethodBreakdown,
      topExpenses
    };
  };

  const formatCategory = (category: string) => {
    return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading accounting report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Accounting Report</h3>
            <p className="text-sm text-slate-600">Financial transactions and balance summary</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-green-900">₹{summary.totalIncome.toFixed(2)}</p>
                <p className="text-xs text-green-600">{accounts.filter(a => a.transaction_type === 'income').length} transactions</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-xs text-red-600 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-900">₹{summary.totalExpense.toFixed(2)}</p>
                <p className="text-xs text-red-600">{accounts.filter(a => a.transaction_type === 'expense').length} transactions</p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg p-4 border ${summary.netBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <DollarSign className={`w-8 h-8 ${summary.netBalance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-xs font-medium ${summary.netBalance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>Net Balance</p>
                <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                  ₹{Math.abs(summary.netBalance).toFixed(2)}
                </p>
                <p className={`text-xs ${summary.netBalance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {summary.netBalance >= 0 ? 'Profit' : 'Loss'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Top 5 Expense Categories</h4>
            <div className="space-y-3">
              {summary.topExpenses.map(([category, amount], index) => (
                <div key={category} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-100 text-red-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{formatCategory(category)}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">₹{amount.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${(amount / summary.totalExpense) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {((amount / summary.totalExpense) * 100).toFixed(1)}% of total expenses
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Payment Methods</h4>
            <div className="space-y-3">
              {Object.entries(summary.paymentMethodBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => (
                  <div key={method} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-900">{formatCategory(method)}</span>
                      <span className="text-sm font-bold text-slate-900">₹{amount.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(amount / (summary.totalIncome + summary.totalExpense)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Financial Overview</h4>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Avg Income</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{accounts.filter(a => a.transaction_type === 'income').length > 0
                    ? (summary.totalIncome / accounts.filter(a => a.transaction_type === 'income').length).toFixed(2)
                    : '0.00'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Avg Expense</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{accounts.filter(a => a.transaction_type === 'expense').length > 0
                    ? (summary.totalExpense / accounts.filter(a => a.transaction_type === 'expense').length).toFixed(2)
                    : '0.00'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Categories</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Object.keys(summary.categoryBreakdown).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
