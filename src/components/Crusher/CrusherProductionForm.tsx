import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Factory,
  ChevronDown,
  Play,
  Square,
  AlertTriangle,
  ChevronRight,
  CalendarDays,
  Zap,
  Settings,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function diffHours(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

function toHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionMode = 'idle' | 'production' | 'breakdown';

interface MachinePanelProps {
  type: 'jaw' | 'vsi';
  date: string;
  materialSources: { label: string; value: string }[];
  onSaved: () => void;
}

// ─── MachinePanel ─────────────────────────────────────────────────────────────

function MachinePanel({ type, date, materialSources, onSaved }: MachinePanelProps) {
  const [mode, setMode] = useState<SessionMode>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [materialSource, setMaterialSource] = useState(
    materialSources[0]?.value ?? 'quarry'
  );
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const productionStartRef = useRef<Date | null>(null);
  const productionEndRef   = useRef<Date | null>(null);
  const breakdownStartRef  = useRef<Date | null>(null);
  const timerRef           = useRef<number | null>(null);

  // Sync materialSource when sources load
  useEffect(() => {
    if (materialSources.length > 0 && !materialSources.find(s => s.value === materialSource)) {
      setMaterialSource(materialSources[0].value);
    }
  }, [materialSources]);

  // Live timer
  useEffect(() => {
    if (mode !== 'idle') {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode]);

  const handleProduction = () => {
    if (mode !== 'idle') return;
    productionStartRef.current = new Date();
    productionEndRef.current   = null;
    breakdownStartRef.current  = null;
    setMode('production');
  };

  const handleBreakdown = () => {
    if (mode === 'breakdown') return;
    const now = new Date();
    if (mode === 'production') {
      productionEndRef.current = now;
    }
    breakdownStartRef.current = now;
    setMode('breakdown');
  };

  const handleStop = async () => {
    setSaving(true);
    try {
      const now = new Date();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert('You must be logged in'); return; }

      let working_hours = 0;
      let downtime_hours = 0;
      let machine_start_time: string | null = null;
      let machine_end_time: string | null = null;

      if (mode === 'production') {
        const ps = productionStartRef.current!;
        working_hours      = diffHours(ps, now);
        machine_start_time = toHHMM(ps);
        machine_end_time   = toHHMM(now);
      } else if (mode === 'breakdown') {
        const bs = breakdownStartRef.current!;
        downtime_hours = diffHours(bs, now);
        if (productionStartRef.current && productionEndRef.current) {
          working_hours      = diffHours(productionStartRef.current, productionEndRef.current);
          machine_start_time = toHHMM(productionStartRef.current);
          machine_end_time   = toHHMM(productionEndRef.current);
        } else {
          machine_start_time = toHHMM(bs);
          machine_end_time   = toHHMM(now);
        }
      }

      const { error } = await supabase.from('production_records').insert([{
        manager_id:        user.id,
        date,
        shift:             'morning',
        crusher_type:      type,
        machine_start_time,
        machine_end_time,
        working_hours:    parseFloat(working_hours.toFixed(2)),
        downtime_hours:   parseFloat(downtime_hours.toFixed(2)),
        maintenance_hours: 0,
        material_source:  materialSource,
        status:           'completed',
        maintenance_notes: '',
        notes,
      }]);

      if (error) throw error;

      alert(`${type === 'jaw' ? 'Jaw Crusher' : 'VSI'} record saved!`);
      productionStartRef.current = null;
      productionEndRef.current   = null;
      breakdownStartRef.current  = null;
      setMode('idle');
      setNotes('');
      onSaved();
    } catch (err: any) {
      alert(err?.message || 'Error saving record');
    } finally {
      setSaving(false);
    }
  };

  const isRunning   = mode !== 'idle';
  const label       = type === 'jaw' ? 'Jaw Crusher' : 'VSI';
  const Icon        = type === 'jaw' ? Factory : Zap;
  const accentColor = type === 'jaw' ? 'orange' : 'blue';

  const accentClasses = {
    headerBg:       type === 'jaw' ? 'bg-orange-100' : 'bg-blue-100',
    headerIcon:     type === 'jaw' ? 'text-orange-600' : 'text-blue-600',
    badge:          type === 'jaw' ? 'bg-orange-500' : 'bg-blue-500',
    prodActive:     type === 'jaw'
      ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-200'
      : 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-200',
    prodIdle:       type === 'jaw'
      ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-500 hover:shadow-md'
      : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-500 hover:shadow-md',
    brkActive:      'border-red-500 bg-red-500 text-white shadow-lg shadow-red-200',
    brkIdle:        'border-red-400 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-500 hover:shadow-md',
    brkSwitch:      'border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-500',
    ring:           type === 'jaw' ? 'focus:ring-orange-500' : 'focus:ring-blue-500',
  };

  return (
    <div className={`flex flex-col rounded-2xl border-2 overflow-hidden transition-all ${
      isRunning
        ? mode === 'production'
          ? 'border-green-300 shadow-lg shadow-green-100'
          : 'border-red-300 shadow-lg shadow-red-100'
        : type === 'jaw'
          ? 'border-orange-200'
          : 'border-blue-200'
    }`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${accentClasses.headerBg}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/60`}>
          <Icon className={`w-4 h-4 ${accentClasses.headerIcon}`} />
        </div>
        <span className={`font-bold text-sm ${accentClasses.headerIcon}`}>{label}</span>
        {isRunning && (
          <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse ${
            mode === 'production' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${mode === 'production' ? 'bg-green-500' : 'bg-red-500'}`} />
            {mode === 'production' ? 'Running' : 'Breakdown'}
          </div>
        )}
      </div>

      <div className="flex-1 bg-white p-4 space-y-4">

        {/* Live Timer */}
        {isRunning && (
          <div className={`rounded-xl p-3 border ${
            mode === 'production' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
              mode === 'production' ? 'text-green-600' : 'text-red-600'
            }`}>
              {mode === 'production' ? '⚙️ In Production' : '🔧 Breakdown'}
            </p>
            <p className={`text-2xl font-mono font-bold ${
              mode === 'production' ? 'text-green-800' : 'text-red-800'
            }`}>
              {formatElapsed(elapsed)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Started at{' '}
              {mode === 'production'
                ? productionStartRef.current ? toHHMM(productionStartRef.current) : '--:--'
                : breakdownStartRef.current ? toHHMM(breakdownStartRef.current) : '--:--'}
              {mode === 'breakdown' && productionStartRef.current && productionEndRef.current && (
                <span className="ml-2 text-slate-400">
                  · Prod: {diffHours(productionStartRef.current, productionEndRef.current).toFixed(2)} hrs
                </span>
              )}
            </p>
          </div>
        )}

        {/* Production Button */}
        <button
          type="button"
          disabled={mode === 'production'}
          onClick={handleProduction}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 font-bold text-sm transition-all ${
            mode === 'production'
              ? accentClasses.prodActive
              : mode === 'breakdown'
                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                : accentClasses.prodIdle
          }`}
        >
          <Play className="w-4 h-4" fill={mode === 'production' ? 'white' : 'currentColor'} />
          Production
        </button>

        {/* Breakdown / Maintenance Button */}
        <button
          type="button"
          disabled={mode === 'breakdown'}
          onClick={handleBreakdown}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 font-bold text-sm transition-all ${
            mode === 'breakdown'
              ? accentClasses.brkActive
              : mode === 'production'
                ? accentClasses.brkSwitch
                : accentClasses.brkIdle
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          {mode === 'production' ? 'Switch → Breakdown' : 'Breakdown / Maintenance'}
        </button>

        {/* Notes (collapsible) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowNotes(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <span>Material &amp; Notes</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showNotes ? 'rotate-90' : ''}`} />
          </button>
          {showNotes && (
            <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Material Source</label>
                <select
                  value={materialSource}
                  onChange={e => setMaterialSource(e.target.value)}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 ${accentClasses.ring} focus:border-transparent`}
                >
                  {materialSources.length > 0
                    ? materialSources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)
                    : (<><option value="quarry">Quarry</option><option value="stockyard">Stockyard</option></>)
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 ${accentClasses.ring} focus:border-transparent`}
                  placeholder="Observations…"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STOP Button */}
      {isRunning && (
        <div className="px-4 pb-4 bg-white">
          <button
            type="button"
            disabled={saving}
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all shadow-md disabled:bg-slate-400"
          >
            <Square className="w-4 h-4" fill="white" />
            {saving ? 'Saving…' : 'STOP & Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface CrusherProductionFormProps {
  onSuccess: () => void;
}

export function CrusherProductionForm({ onSuccess }: CrusherProductionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [materialSources, setMaterialSources] = useState<{ label: string; value: string }[]>([]);

  // Fetch material sources once
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('transport_records')
          .select('material_transported, quantity, date')
          .not('material_transported', 'is', null)
          .gt('quantity', 0)
          .order('date', { ascending: false })
          .limit(100);

        if (!data || data.length === 0) {
          setMaterialSources([{ label: 'Quarry', value: 'quarry' }, { label: 'Stockyard', value: 'stockyard' }]);
          return;
        }

        const map = new Map<string, { quantity: number; latestDate: string }>();
        data.forEach(r => {
          if (r.material_transported) {
            const cur = map.get(r.material_transported) || { quantity: 0, latestDate: '1970-01-01' };
            map.set(r.material_transported, {
              quantity: cur.quantity + (r.quantity || 0),
              latestDate: r.date > cur.latestDate ? r.date : cur.latestDate,
            });
          }
        });

        const sources = Array.from(map.entries())
          .sort((a, b) => new Date(b[1].latestDate).getTime() - new Date(a[1].latestDate).getTime())
          .map(([mat, d]) => ({ label: `${mat} (${d.quantity.toFixed(1)} t)`, value: mat }));

        setMaterialSources(sources);
      } catch {
        setMaterialSources([{ label: 'Quarry', value: 'quarry' }, { label: 'Stockyard', value: 'stockyard' }]);
      }
    };
    fetch();
  }, []);

  // ── Monthly Summary ────────────────────────────────────────────────────────
  const nowDate = new Date();
  const [summaryMonth, setSummaryMonth] = useState(nowDate.getMonth());
  const [summaryYear, setSummaryYear]   = useState(nowDate.getFullYear());
  const [summaryLoading, setSummaryLoading]   = useState(false);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  interface SummaryRow {
    date: string;
    crusher_type: string;
    workingTime: number;
    breakdownTime: number;
    totalTime: number;
  }
  const [summaryRows, setSummaryRows]   = useState<SummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState({ jaw_work: 0, jaw_bd: 0, vsi_work: 0, vsi_bd: 0, total: 0 });

  useEffect(() => {
    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        const firstDay = new Date(summaryYear, summaryMonth, 1);
        const lastDay  = new Date(summaryYear, summaryMonth + 1, 0);
        const from = firstDay.toISOString().split('T')[0];
        const to   = lastDay.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('production_records')
          .select('date, crusher_type, working_hours, downtime_hours')
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: true })
          .order('crusher_type', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          // Group by date + crusher_type
          const grouped: Record<string, SummaryRow> = {};
          let jaw_work = 0, jaw_bd = 0, vsi_work = 0, vsi_bd = 0;

          for (const row of data) {
            const key = `${row.date}_${row.crusher_type}`;
            if (!grouped[key]) {
              grouped[key] = { date: row.date, crusher_type: row.crusher_type || 'jaw', workingTime: 0, breakdownTime: 0, totalTime: 0 };
            }
            const w  = parseFloat(row.working_hours)  || 0;
            const bd = parseFloat(row.downtime_hours) || 0;
            grouped[key].workingTime   += w;
            grouped[key].breakdownTime += bd;
            grouped[key].totalTime     += w + bd;

            if ((row.crusher_type || 'jaw') === 'jaw') { jaw_work += w; jaw_bd += bd; }
            else { vsi_work += w; vsi_bd += bd; }
          }

          setSummaryRows(Object.values(grouped));
          setSummaryTotals({ jaw_work, jaw_bd, vsi_work, vsi_bd, total: jaw_work + jaw_bd + vsi_work + vsi_bd });
        } else {
          setSummaryRows([]);
          setSummaryTotals({ jaw_work: 0, jaw_bd: 0, vsi_work: 0, vsi_bd: 0, total: 0 });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchSummary();
  }, [summaryMonth, summaryYear, summaryRefreshKey]);

  const handleSaved = () => {
    setSummaryRefreshKey(k => k + 1);
    onSuccess();
  };

  return (
    <div className="space-y-6">

      {/* ── Date Selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowDatePicker(v => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:border-slate-400 hover:bg-slate-50 transition-all"
        >
          <CalendarDays className="w-4 h-4 text-slate-500" />
          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
          })}
        </button>
        {showDatePicker && (
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setShowDatePicker(false); }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Jaw Crusher
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> VSI
          </span>
        </div>
      </div>

      {/* ── Dual Machine Panels ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MachinePanel
          type="jaw"
          date={date}
          materialSources={materialSources}
          onSaved={handleSaved}
        />
        <MachinePanel
          type="vsi"
          date={date}
          materialSources={materialSources}
          onSaved={handleSaved}
        />
      </div>

      {/* ── Monthly Production Summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Monthly Production Report</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={summaryMonth}
                onChange={e => setSummaryMonth(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={summaryYear}
                onChange={e => setSummaryYear(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {summaryLoading ? (
          <div className="py-12 text-center text-slate-500">
            <Factory className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p>Loading summary…</p>
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Factory className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No records found for this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Machine</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Work (hrs)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Breakdown (hrs)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-orange-700 uppercase tracking-wider">Total (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryRows.map((row, idx) => (
                  <tr key={`${row.date}_${row.crusher_type}`} className={`hover:bg-slate-50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short', day: '2-digit', month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.crusher_type === 'jaw'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {row.crusher_type === 'jaw' ? '⚙ Jaw Crusher' : '⚡ VSI'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{row.workingTime.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{row.breakdownTime.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-orange-700">{row.totalTime.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 border-t-2 border-orange-200">
                  <td colSpan={2} className="px-4 py-3 text-xs font-bold text-orange-900">
                    MONTHLY TOTALS
                  </td>
                  <td className="px-4 py-3 text-right" colSpan={3}>
                    <div className="flex flex-wrap justify-end gap-4">
                      <span className="text-xs font-semibold text-orange-800">
                        <span className="text-orange-500">Jaw</span> Work: {summaryTotals.jaw_work.toFixed(2)} &nbsp;|&nbsp; BD: {summaryTotals.jaw_bd.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-blue-800">
                        <span className="text-blue-500">VSI</span> Work: {summaryTotals.vsi_work.toFixed(2)} &nbsp;|&nbsp; BD: {summaryTotals.vsi_bd.toFixed(2)}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Total: {summaryTotals.total.toFixed(2)} hrs
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
