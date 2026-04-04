import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Receipt, Calendar, RotateCcw, Zap, AlertTriangle, CheckCircle, IndianRupee } from 'lucide-react';

interface EBRecordsProps {
  onSuccess: () => void;
}

interface BillRecord {
  id: string;
  bill_date: string;
  due_date: string | null;
  bill_amount: number;
  md_penalty: number;
  pf_penalty: number;
  units_billed: number;
  kw_uc_at_billing: number;
  kw_uc_reset: boolean;
  kw_uc_reset_value: number;
  bill_number: string | null;
  notes: string | null;
  created_at: string;
}

export function EBRecords({ onSuccess }: EBRecordsProps) {
  const [loading, setLoading] = useState(false);
  const [pastBills, setPastBills] = useState<BillRecord[]>([]);
  const [latestKwUC, setLatestKwUC] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    bill_amount: '',
    md_penalty: '',
    pf_penalty: '',
    units_billed: '',
    kw_uc_at_billing: '',
    kw_uc_reset: false,
    kw_uc_reset_value: '0',
    bill_number: '',
    notes: '',
  });

  // Fetch latest KW UC from eb_reports to pre-fill
  useEffect(() => {
    const fetchLatestKwUC = async () => {
      try {
        const { data, error } = await supabase
          .from('eb_reports')
          .select('ending_reading, created_at')
          .not('ending_reading', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data?.ending_reading) {
          const uc = parseFloat(String(data.ending_reading['KW UC'] ?? '')) || 0;
          setLatestKwUC(uc);
          setFormData(prev => ({ ...prev, kw_uc_at_billing: String(uc) }));
        }
      } catch (_) {
        // No records yet
      }
    };

    fetchLatestKwUC();
    fetchPastBills();
  }, []);

  const fetchPastBills = async () => {
    try {
      const { data, error } = await supabase
        .from('eb_bill_records')
        .select('*')
        .order('bill_date', { ascending: false })
        .limit(10);

      if (!error && data) setPastBills(data);
    } catch (_) { }
  };

  const handleKwUcReset = () => {
    setFormData(prev => ({ ...prev, kw_uc_reset: true, kw_uc_reset_value: '0' }));
  };

  const handleCancelReset = () => {
    setFormData(prev => ({ ...prev, kw_uc_reset: false, kw_uc_reset_value: '0' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert('You must be logged in'); return; }

      const payload = {
        user_id: user.id,
        bill_date: formData.bill_date,
        due_date: formData.due_date || null,
        bill_amount: parseFloat(formData.bill_amount) || 0,
        md_penalty: parseFloat(formData.md_penalty) || 0,
        pf_penalty: parseFloat(formData.pf_penalty) || 0,
        units_billed: parseFloat(formData.units_billed) || 0,
        kw_uc_at_billing: parseFloat(formData.kw_uc_at_billing) || 0,
        kw_uc_reset: formData.kw_uc_reset,
        kw_uc_reset_value: formData.kw_uc_reset ? parseFloat(formData.kw_uc_reset_value) || 0 : 0,
        bill_number: formData.bill_number || null,
        notes: formData.notes || null,
      };

      const { error } = await supabase.from('eb_bill_records').insert([payload]);
      if (error) throw error;

      alert(
        formData.kw_uc_reset
          ? '✅ Bill recorded & KW UC Reset marked. The next EB Daily Report will start from ' + formData.kw_uc_reset_value + '.'
          : '✅ EB Bill recorded successfully!'
      );

      // Reset form
      setFormData({
        bill_date: new Date().toISOString().split('T')[0],
        due_date: '',
        bill_amount: '',
        md_penalty: '',
        pf_penalty: '',
        units_billed: '',
        kw_uc_at_billing: '',
        kw_uc_reset: false,
        kw_uc_reset_value: '0',
        bill_number: '',
        notes: '',
      });
      fetchPastBills();
      onSuccess();
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error?.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Receipt className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">EB Bill Taken</h3>
            <p className="text-sm text-slate-500">Record received EB bill and meter reset</p>
          </div>
          {latestKwUC !== null && (
            <div className="ml-auto flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <Zap className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-700 font-medium">Current KW UC: <strong>{latestKwUC}</strong></span>
            </div>
          )}
        </div>

        {/* KW UC Reset Banner */}
        {formData.kw_uc_reset && (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">KW UC Reset is Active</p>
              <p className="text-sm text-amber-700 mt-0.5">
                After submitting, the next Daily EB Report will use <strong>{formData.kw_uc_reset_value || 0}</strong> as the Starting KW UC.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelReset}
              className="text-amber-600 hover:text-amber-800 text-sm font-medium underline"
            >
              Cancel Reset
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bill Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bill Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                required
                value={formData.bill_date}
                onChange={e => setFormData({ ...formData, bill_date: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Bill Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bill Number
            </label>
            <input
              type="text"
              value={formData.bill_number}
              onChange={e => setFormData({ ...formData, bill_number: e.target.value })}
              placeholder=""
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Bill Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bill Amount (₹) *
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.bill_amount}
                onChange={e => setFormData({ ...formData, bill_amount: e.target.value })}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* MD Penalty */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              MD Penalty (&lt;= 2.8 is 0) (₹)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.md_penalty}
                onChange={e => setFormData({ ...formData, md_penalty: e.target.value })}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* PF Penalty */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              PF Penalty (&lt;= 0.90 is 0) (₹)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.pf_penalty}
                onChange={e => setFormData({ ...formData, pf_penalty: e.target.value })}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Units Billed */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Units Billed (kWh) *
            </label>
            <div className="relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.units_billed}
                onChange={e => setFormData({ ...formData, units_billed: e.target.value })}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* KW UC at Billing */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              KW UC Reading at Billing *
            </label>
            <div className="relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.kw_uc_at_billing}
                onChange={e => setFormData({ ...formData, kw_uc_at_billing: e.target.value })}
                placeholder="Current KW UC meter reading"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">KW UC value from the latest Daily EB Report</p>
          </div>
        </div>

        {/* KW UC Reset Value (shown when reset is active) */}
        {formData.kw_uc_reset && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-amber-800 mb-2">
              KW UC Reset To (New Starting Value)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.kw_uc_reset_value}
              onChange={e => setFormData({ ...formData, kw_uc_reset_value: e.target.value })}
              className="w-full max-w-xs px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
            <p className="text-xs text-amber-700 mt-1">Usually 0 — this becomes the Starting KW UC for the next EB report</p>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="Any remarks about this bill..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {/* KW UC Reset Button */}
          {!formData.kw_uc_reset ? (
            <button
              type="button"
              onClick={handleKwUcReset}
              className="flex items-center gap-2 px-5 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              KW UC Reset
            </button>
          ) : (
            <div className="flex items-center gap-2 text-amber-700">
              <CheckCircle className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium">KW UC Reset will be applied on submit</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors font-medium"
          >
            <Receipt className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Bill Record'}
          </button>
        </div>
      </form>

      {/* Past Bills Table */}
      {pastBills.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Recent EB Bills</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bill Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bill No.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">MD Pen.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">PF Pen.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Units</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">KW UC at Bill</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">KW UC Reset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {pastBills.map(bill => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                      {new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{bill.bill_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">₹{bill.bill_amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">₹{(bill.md_penalty || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">₹{(bill.pf_penalty || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm text-right text-yellow-700 font-medium">{bill.units_billed}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">{bill.kw_uc_at_billing}</td>
                    <td className="px-4 py-3 text-center">
                      {bill.kw_uc_reset ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <RotateCcw className="w-3 h-3" /> Reset → {bill.kw_uc_reset_value}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{bill.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
