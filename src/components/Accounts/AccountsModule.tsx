import { useState, useEffect } from 'react';
import {
  History,
  PieChart,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AccountsForm } from './AccountsForm';
import { AccountsDetails } from './AccountsDetails';
import { AccountingReportModule } from '../Reports/AccountingReportModule';
import { FundInflowEntry } from './FundAccounts';

type ViewType = 'ledger' | 'inflow' | 'add' | 'report';

export function AccountsModule() {
  const [activeView, setActiveView] = useState<ViewType>('ledger');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('accounts')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) throw error;

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const NavItem = ({ id, label, icon: Icon }: { id: ViewType, label: string, icon: any }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.12em] transition-all duration-300 ${activeView === id
          ? 'bg-slate-900 text-white shadow-2xl shadow-slate-300 translate-y-[-2px]'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
        }`}
    >
      <Icon className={`w-5 h-5 ${activeView === id ? 'text-indigo-400' : ''}`} />
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-100 shadow-sm animate-pulse">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">Synchronizing Ledger...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">

      {/* ── Header Section ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Financial Hub</h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Live Accounting System
          </p>
        </div>

        <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[22px] border border-slate-100 shadow-sm overflow-x-auto gap-1">
          <NavItem id="ledger" label="Ledger" icon={History} />
          <NavItem id="inflow" label="Inflow" icon={TrendingUp} />
          <NavItem id="add" label="Outflow" icon={TrendingDown} />
          <NavItem id="report" label="Reports" icon={PieChart} />
        </div>
      </div>

      {activeView === 'ledger' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AccountsDetails />
        </div>
      )}

      {activeView === 'inflow' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FundInflowEntry onSuccess={() => { }} />
        </div>
      )}

      {activeView === 'add' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AccountsForm onSuccess={() => {
            fetchDashboardData();
            setActiveView('ledger');
          }} />
        </div>
      )}

      {activeView === 'report' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AccountingReportModule />
        </div>
      )}

    </div>
  );
}
