import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Banknote, CreditCard, Building2, TrendingUp, TrendingDown,
  Smartphone, Globe, Plus, RefreshCw, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FundSource {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
}

export const FUND_SOURCES: FundSource[] = [
  { id: 'sbbm_cash',     label: 'SBBM Cash',          icon: Banknote,   color: 'text-violet-600', bg: 'bg-violet-50'  },
  { id: 'sbbm_upi',      label: 'SBBM UPI',            icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50'  },
  { id: 'sbbm_netbank',  label: 'SBBM Net-Banking',    icon: Globe,      color: 'text-violet-600', bg: 'bg-violet-50'  },
  { id: 'appa_cash',     label: 'APPA Cash',           icon: Banknote,   color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { id: 'appa_account',  label: 'APPA Account',        icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { id: 'appa_hdfc_cc',  label: 'APPA HDFC CC',        icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { id: 'appa_axis_cc',  label: 'APPA Axis CC',        icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { id: 'amma_cash',     label: 'AMMA Cash',           icon: Banknote,   color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { id: 'amma_account',  label: 'AMMA Account',        icon: CreditCard, color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { id: 'mani_cash',     label: 'MANI Cash',           icon: Banknote,   color: 'text-amber-600',  bg: 'bg-amber-50'   },
  { id: 'mani_sbi',      label: 'MANI SBI',            icon: Building2,  color: 'text-amber-600',  bg: 'bg-amber-50'   },
  { id: 'mani_icici',    label: 'MANI ICICI',          icon: Building2,  color: 'text-amber-600',  bg: 'bg-amber-50'   },
  { id: 'other_cash',    label: 'Other Cash',          icon: Banknote,   color: 'text-slate-600',  bg: 'bg-slate-50'   },
  { id: 'other_account', label: 'Other Account',       icon: CreditCard, color: 'text-slate-600',  bg: 'bg-slate-50'   },
];

// ─── Live Balance Hook ────────────────────────────────────────────────────────

export function useFundBalances() {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fund_transactions')
        .select('source_id, type, amount');
      if (error) throw error;

      // Auto-fetch ALL sales from invoices to compute total SBBM revenue
      const { data: salesData, error: salesError } = await supabase
        .from('invoices')
        .select('amount_paid, payment_mode')
        .gt('amount_paid', 0);

      const totals: Record<string, number> = {};
      
      // 1. Apply fund transactions (manual deposits/withdrawals)
      (data || []).forEach(row => {
        if (!totals[row.source_id]) totals[row.source_id] = 0;
        totals[row.source_id] += row.type === 'deposit' ? row.amount : -row.amount;
      });

      // 2. Automatically add Sales collections to SBBM balances
      if (!salesError && salesData) {
        salesData.forEach(sale => {
          const mode = (sale.payment_mode || 'cash').toLowerCase();
          let sourceId = 'sbbm_cash';
          if (mode.includes('upi')) sourceId = 'sbbm_upi';
          if (mode.includes('net') || mode.includes('bank')) sourceId = 'sbbm_netbank';
          
          if (!totals[sourceId]) totals[sourceId] = 0;
          totals[sourceId] += (sale.amount_paid || 0);
        });
      }

      setBalances(totals);
    } catch (err) {
      console.error('Fund balance fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);
  return { balances, loading, refresh: fetch };
}

// ─── FundInflow Entry ─────────────────────────────────────────────────────────

export function FundInflowEntry({ onSuccess }: { onSuccess: () => void }) {
  const [source, setSource] = useState('sbbm_cash');
  const [amount, setAmount] = useState('');
  const [note, setNote]   = useState('');
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const { balances, refresh } = useFundBalances();

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return toast.warning('Enter a valid amount');
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fund_transactions').insert([{
        source_id: source,
        type: 'deposit',
        amount: parseFloat(amount),
        note: note || 'Manual Deposit',
        transaction_date: date,
        created_by: user?.id
      }]);
      if (error) throw error;
      toast.success('Inflow recorded!');
      setAmount(''); setNote('');
      refresh();
      onSuccess();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentSource = FUND_SOURCES.find(s => s.id === source)!;
  const currentBalance = balances[source] ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-[32px] p-8 text-white shadow-2xl shadow-emerald-500/20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-40 h-40 rounded-full bg-white" />
          <div className="absolute -bottom-6 -left-6 w-52 h-52 rounded-full bg-white" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Financial Hub</p>
            <h2 className="text-2xl font-black tracking-tight">Inflow Entry</h2>
            <p className="text-white/70 text-sm font-medium mt-0.5">Record incoming funds per account source</p>
          </div>
        </div>
      </div>

      {/* Source Selection */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Fund Source</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {FUND_SOURCES.map(src => {
            const Icon = src.icon;
            const bal = balances[src.id] ?? 0;
            const active = source === src.id;
            return (
              <button
                key={src.id}
                onClick={() => setSource(src.id)}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  active
                    ? `${src.bg} border-transparent ring-2 ring-inset ring-current ${src.color} shadow-sm`
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? src.color : ''}`} />
                <span className={`text-[10px] font-black uppercase leading-tight ${active ? src.color : ''}`}>{src.label}</span>
                <span className={`text-[9px] font-bold ${bal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  ₹{Math.abs(bal).toLocaleString('en-IN')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount + Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount *</p>
          </div>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all shadow-inner">
            <span className="px-5 py-4 text-xl font-black text-emerald-500 bg-emerald-50/50 border-r border-slate-200">₹</span>
            <input
              type="number" step="0.01" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 px-5 py-4 font-black text-2xl text-slate-900 outline-none bg-transparent placeholder:text-slate-200"
            />
          </div>
          {currentBalance !== 0 && (
            <p className={`text-[10px] font-bold ${currentBalance > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              Current {currentSource.label} Balance: ₹{currentBalance.toLocaleString('en-IN')}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none text-sm"
          />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Note (Optional)</p>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reference or description..."
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none text-sm"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div>
          <p className="text-xs font-black text-slate-500">
            <span className={`font-black ${currentSource.color}`}>{currentSource.label}</span>
            {amount && <span className="text-emerald-600 font-black"> + ₹{parseFloat(amount).toLocaleString('en-IN')}</span>}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Inflow deposit</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !amount}
          className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Record Inflow
        </button>
      </div>
    </div>
  );
}

// ─── Balance Dashboard ────────────────────────────────────────────────────────

export function FundBalanceDashboard() {
  const { balances, loading, refresh } = useFundBalances();

  const total = Object.values(balances).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Available Funds</p>
          <p className={`text-3xl font-black ${total >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            ₹{Math.abs(total).toLocaleString('en-IN')}
          </p>
        </div>
        <button onClick={refresh} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {FUND_SOURCES.map(src => {
          const Icon = src.icon;
          const bal = balances[src.id] ?? 0;
          return (
            <div key={src.id} className={`p-4 rounded-2xl border ${src.bg} border-transparent space-y-2`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${src.color}`} />
                {bal > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : bal < 0
                  ? <TrendingDown className="w-3 h-3 text-rose-500" />
                  : <Wallet className="w-3 h-3 text-slate-300" />
                }
              </div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{src.label}</p>
              <p className={`text-sm font-black ${bal > 0 ? src.color : bal < 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                ₹{Math.abs(bal).toLocaleString('en-IN')}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
