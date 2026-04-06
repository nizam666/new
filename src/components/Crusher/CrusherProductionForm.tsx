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
} from 'lucide-react';

interface CrusherProductionFormProps {
  onSuccess: () => void;
}

type SessionMode = 'idle' | 'production' | 'breakdown';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function diffHours(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

export function CrusherProductionForm({ onSuccess }: CrusherProductionFormProps) {
  // ─── Session State ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<SessionMode>('idle');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [crusherType, setCrusherType] = useState<'jaw' | 'vsi'>('jaw');
  const [materialSource, setMaterialSource] = useState('quarry');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timestamps stored as Date objects
  const productionStartRef = useRef<Date | null>(null);
  const productionEndRef   = useRef<Date | null>(null);
  const breakdownStartRef  = useRef<Date | null>(null);

  // Elapsed seconds for live timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ─── Material Sources ─────────────────────────────────────────────────────
  const [materialSources, setMaterialSources] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const fetchMaterialSources = async () => {
      try {
        const { data } = await supabase
          .from('transport_records')
          .select('material_transported, quantity, date')
          .not('material_transported', 'is', null)
          .gt('quantity', 0)
          .order('date', { ascending: false })
          .limit(100);

        if (!data || data.length === 0) {
          setMaterialSources([
            { label: 'Quarry', value: 'quarry' },
            { label: 'Stockyard', value: 'stockyard' },
          ]);
          return;
        }

        const materialMap = new Map<string, { quantity: number; latestDate: string }>();
        data.forEach((r) => {
          if (r.material_transported) {
            const cur = materialMap.get(r.material_transported) || { quantity: 0, latestDate: '1970-01-01' };
            materialMap.set(r.material_transported, {
              quantity: cur.quantity + (r.quantity || 0),
              latestDate: r.date > cur.latestDate ? r.date : cur.latestDate,
            });
          }
        });

        const sources = Array.from(materialMap.entries())
          .sort((a, b) => new Date(b[1].latestDate).getTime() - new Date(a[1].latestDate).getTime())
          .map(([mat, d]) => ({ label: `${mat} (${d.quantity.toFixed(1)} t)`, value: mat }));

        setMaterialSources(sources);
        if (sources.length > 0) setMaterialSource(sources[0].value);
      } catch {
        setMaterialSources([
          { label: 'Quarry', value: 'quarry' },
          { label: 'Stockyard', value: 'stockyard' },
        ]);
      }
    };
    fetchMaterialSources();
  }, []);

  // ─── Live Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'idle') {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleProductionClick = () => {
    if (mode !== 'idle') return;
    productionStartRef.current = new Date();
    productionEndRef.current   = null;
    breakdownStartRef.current  = null;
    setMode('production');
  };

  const handleBreakdownClick = () => {
    if (mode === 'breakdown') return;
    const now = new Date();
    if (mode === 'production') {
      // End production, start breakdown
      productionEndRef.current  = now;
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
        const pe = now;
        working_hours = diffHours(ps, pe);
        machine_start_time = `${String(ps.getHours()).padStart(2,'0')}:${String(ps.getMinutes()).padStart(2,'0')}`;
        machine_end_time   = `${String(pe.getHours()).padStart(2,'0')}:${String(pe.getMinutes()).padStart(2,'0')}`;
      } else if (mode === 'breakdown') {
        const bs = breakdownStartRef.current!;
        downtime_hours = diffHours(bs, now);
        if (productionStartRef.current && productionEndRef.current) {
          working_hours = diffHours(productionStartRef.current, productionEndRef.current);
          machine_start_time = `${String(productionStartRef.current.getHours()).padStart(2,'0')}:${String(productionStartRef.current.getMinutes()).padStart(2,'0')}`;
          machine_end_time   = `${String(productionEndRef.current.getHours()).padStart(2,'0')}:${String(productionEndRef.current.getMinutes()).padStart(2,'0')}`;
        } else {
          // Pure breakdown from idle
          machine_start_time = `${String(bs.getHours()).padStart(2,'0')}:${String(bs.getMinutes()).padStart(2,'0')}`;
          machine_end_time   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        }
      }

      const recordData = {
        manager_id: user.id,
        date,
        shift: 'morning',
        crusher_type: crusherType,
        machine_start_time,
        machine_end_time,
        working_hours: parseFloat(working_hours.toFixed(2)),
        downtime_hours: parseFloat(downtime_hours.toFixed(2)),
        maintenance_hours: 0,
        material_source: materialSource,
        status: 'completed',
        maintenance_notes: '',
        notes,
      };

      const { error } = await supabase.from('production_records').insert([recordData]);
      if (error) throw error;

      alert('Production record saved successfully!');
      // Reset
      productionStartRef.current = null;
      productionEndRef.current   = null;
      breakdownStartRef.current  = null;
      setMode('idle');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      onSuccess();
    } catch (err: any) {
      alert(err?.message || 'Unknown error saving record');
    } finally {
      setSaving(false);
    }
  };

  // ─── Monthly Summary ──────────────────────────────────────────────────────
  const nowDate = new Date();
  const [summaryMonth, setSummaryMonth] = useState(nowDate.getMonth());
  const [summaryYear, setSummaryYear] = useState(nowDate.getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);

  interface DailyProductionSummary {
    date: string;
    workingTime: number;
    maintenanceTime: number;
    breakdownTime: number;
    totalTime: number;
  }
  const [monthlySummaries, setMonthlySummaries] = useState<DailyProductionSummary[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState({
    workingTime: 0, maintenanceTime: 0, breakdownTime: 0, totalTime: 0,
  });

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
          .select('date, working_hours, downtime_hours, maintenance_hours')
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const grouped: Record<string, DailyProductionSummary> = {};
          let tw = 0, tm = 0, tb = 0;

          for (const row of data) {
            const d = row.date;
            if (!grouped[d]) grouped[d] = { date: d, workingTime: 0, maintenanceTime: 0, breakdownTime: 0, totalTime: 0 };
            const w = parseFloat(row.working_hours) || 0;
            const dt= parseFloat(row.downtime_hours) || 0;
            const mt= parseFloat(row.maintenance_hours) || 0;
            grouped[d].workingTime     += w;
            grouped[d].breakdownTime   += dt;
            grouped[d].maintenanceTime += mt;
            grouped[d].totalTime       += w + dt + mt;
            tw += w; tb += dt; tm += mt;
          }

          setMonthlySummaries(Object.values(grouped));
          setMonthlyTotals({ workingTime: tw, maintenanceTime: tm, breakdownTime: tb, totalTime: tw + tm + tb });
        } else {
          setMonthlySummaries([]);
          setMonthlyTotals({ workingTime: 0, maintenanceTime: 0, breakdownTime: 0, totalTime: 0 });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchSummary();
  }, [summaryMonth, summaryYear, mode]); // refresh on mode change (after save)

  const isRunning = mode !== 'idle';
  const modeColor = mode === 'production' ? 'green' : mode === 'breakdown' ? 'red' : 'slate';

  return (
    <div className="space-y-6">

      {/* ── Control Panel ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Factory className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Crusher Control Panel</h3>
            <p className="text-xs text-slate-500">Select crusher type and start production or mark breakdown</p>
          </div>
          {isRunning && (
            <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              mode === 'production'
                ? 'bg-green-100 text-green-700 animate-pulse'
                : 'bg-red-100 text-red-700 animate-pulse'
            }`}>
              <span className={`w-2 h-2 rounded-full ${mode === 'production' ? 'bg-green-500' : 'bg-red-500'}`} />
              {mode === 'production' ? 'Running' : 'Breakdown'}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">

          {/* ── Date ──────────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</p>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => !isRunning && setShowDatePicker((v) => !v)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                isRunning
                  ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  : 'border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              })}
            </button>
            {showDatePicker && !isRunning && (
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
                className="mt-2 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            )}
          </div>

          {/* ── Crusher Type ───────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Crusher Type</p>
            <div className="flex gap-3">
              {(['jaw', 'vsi'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={isRunning}
                  onClick={() => !isRunning && setCrusherType(type)}
                  className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    crusherType === type
                      ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                      : isRunning
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {type === 'jaw' ? 'Jaw Crusher' : 'VSI'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mode Buttons ──────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Action</p>
            <div className="flex gap-3">

              {/* Production */}
              <button
                type="button"
                disabled={mode === 'production'}
                onClick={handleProductionClick}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-bold text-sm transition-all ${
                  mode === 'production'
                    ? 'border-green-500 bg-green-500 text-white cursor-not-allowed shadow-lg shadow-green-200'
                    : mode === 'breakdown'
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-500 hover:shadow-md'
                }`}
              >
                <Play className="w-5 h-5" fill={mode === 'production' ? 'white' : 'currentColor'} />
                Production
              </button>

              {/* Breakdown */}
              <button
                type="button"
                disabled={mode === 'breakdown'}
                onClick={handleBreakdownClick}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-bold text-sm transition-all ${
                  mode === 'breakdown'
                    ? 'border-red-500 bg-red-500 text-white cursor-not-allowed shadow-lg shadow-red-200'
                    : mode === 'idle'
                      ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-500 hover:shadow-md'
                      : 'border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-500 hover:shadow-md'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
                {mode === 'production' ? 'Switch to Breakdown' : 'Breakdown'}
              </button>
            </div>
          </div>

          {/* ── Live Status Card ──────────────────────────────────────────── */}
          {isRunning && (
            <div className={`rounded-xl p-4 border-2 ${
              mode === 'production'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${
                    mode === 'production' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {mode === 'production' ? '⚙️ Machine Running' : '🔧 Breakdown in Progress'}
                  </p>
                  <p className={`text-3xl font-mono font-bold mt-1 ${
                    mode === 'production' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {formatElapsed(elapsed)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Started at{' '}
                    {mode === 'production'
                      ? productionStartRef.current
                        ? `${String(productionStartRef.current.getHours()).padStart(2,'0')}:${String(productionStartRef.current.getMinutes()).padStart(2,'0')}`
                        : '--:--'
                      : breakdownStartRef.current
                        ? `${String(breakdownStartRef.current.getHours()).padStart(2,'0')}:${String(breakdownStartRef.current.getMinutes()).padStart(2,'0')}`
                        : '--:--'}
                    {mode === 'breakdown' && productionStartRef.current && productionEndRef.current && (
                      <span className="ml-3 text-slate-400">
                        · Production: {diffHours(productionStartRef.current, productionEndRef.current).toFixed(2)} hrs
                      </span>
                    )}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center animate-pulse ${
                  mode === 'production'
                    ? 'border-green-400 bg-green-100'
                    : 'border-red-400 bg-red-100'
                }`}>
                  {mode === 'production'
                    ? <Play className="w-6 h-6 text-green-600" fill="currentColor" />
                    : <AlertTriangle className="w-6 h-6 text-red-600" />
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── Notes / Material (collapsible) ───────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span>Material & Notes (optional)</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showNotes ? 'rotate-90' : ''}`} />
            </button>
            {showNotes && (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                <div className="pt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Material Source</label>
                  <select
                    value={materialSource}
                    onChange={(e) => setMaterialSource(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {materialSources.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                    {materialSources.length === 0 && (
                      <>
                        <option value="quarry">Quarry</option>
                        <option value="stockyard">Stockyard</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="General observations, remarks…"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── STOP Button ───────────────────────────────────────────────── */}
        {isRunning && (
          <div className="px-6 pb-6">
            <button
              type="button"
              disabled={saving}
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-slate-900 text-white font-bold text-base hover:bg-slate-800 active:scale-95 transition-all shadow-lg disabled:bg-slate-400"
            >
              <Square className="w-5 h-5" fill="white" />
              {saving ? 'Saving Record…' : 'STOP & Save Record'}
            </button>
          </div>
        )}
      </div>

      {/* ── Monthly Production Summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-900">Monthly Production Report</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {summaryLoading ? (
          <div className="py-12 text-center text-slate-500">
            <Factory className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p>Loading monthly summary…</p>
          </div>
        ) : monthlySummaries.length === 0 ? (
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Work Time (hrs)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Breakdown (hrs)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-orange-700 uppercase tracking-wider">Total (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlySummaries.map((row, idx) => (
                  <tr key={row.date} className={`hover:bg-slate-50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                      {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{row.workingTime.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{row.breakdownTime.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-orange-700">{row.totalTime.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 border-t-2 border-orange-200">
                  <td className="px-4 py-4 text-sm font-bold text-orange-900 text-left">MONTHLY TOTAL</td>
                  <td className="px-4 py-4 text-sm font-bold text-orange-800 text-right">{monthlyTotals.workingTime.toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm font-bold text-red-700 text-right">{monthlyTotals.breakdownTime.toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm font-bold text-orange-900 text-right">{monthlyTotals.totalTime.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
