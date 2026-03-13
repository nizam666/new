import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Drill, Factory, Truck, TrendingUp } from 'lucide-react';

interface DrillingRecord {
  id: string;
  date: string;
  holes_drilled: number;
  depth: number;
}

interface BlastingRecord {
  id: string;
  date: string;
  quantity: number;
}

interface LoadingRecord {
  id: string;
  date: string;
  quantity: number;
}

interface TransportRecord {
  id: string;
  date: string;
  quantity: number;
}

export function QuarryProductionReportModule() {
  const [drilling, setDrilling] = useState<DrillingRecord[]>([]);
  const [blasting, setBlasting] = useState<BlastingRecord[]>([]);
  const [loading, setLoading] = useState<LoadingRecord[]>([]);
  const [transport, setTransport] = useState<TransportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchQuarryData = useCallback(async () => {
    try {
      const queries = [];

      let drillingQuery = supabase
        .from('drilling')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) drillingQuery = drillingQuery.gte('date', startDate);
      if (endDate) drillingQuery = drillingQuery.lte('date', endDate);
      queries.push(drillingQuery);

      let blastingQuery = supabase
        .from('blasting')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) blastingQuery = blastingQuery.gte('date', startDate);
      if (endDate) blastingQuery = blastingQuery.lte('date', endDate);
      queries.push(blastingQuery);

      let loadingQuery = supabase
        .from('loading')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) loadingQuery = loadingQuery.gte('date', startDate);
      if (endDate) loadingQuery = loadingQuery.lte('date', endDate);
      queries.push(loadingQuery);

      let transportQuery = supabase
        .from('transport')
        .select('*')
        .order('date', { ascending: false });
      if (startDate) transportQuery = transportQuery.gte('date', startDate);
      if (endDate) transportQuery = transportQuery.lte('date', endDate);
      queries.push(transportQuery);

      const [drillingRes, blastingRes, loadingRes, transportRes] = await Promise.all(queries);

      if (drillingRes.error) throw drillingRes.error;
      if (blastingRes.error) throw blastingRes.error;
      if (loadingRes.error) throw loadingRes.error;
      if (transportRes.error) throw transportRes.error;

      setDrilling(drillingRes.data || []);
      setBlasting(blastingRes.data || []);
      setLoading(loadingRes.data || []);
      setTransport(transportRes.data || []);
    } catch (error) {
      console.error('Error fetching quarry data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchQuarryData();
  }, [fetchQuarryData]);

  const calculateSummary = () => {
    const totalHolesDrilled = drilling.reduce((sum, d) => sum + (d.holes_drilled || 0), 0);
    const totalDepthDrilled = drilling.reduce((sum, d) => sum + (d.depth || 0) * (d.holes_drilled || 0), 0);
    const totalBlasted = blasting.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const totalLoaded = loading.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const totalTransported = transport.reduce((sum, t) => sum + (t.quantity || 0), 0);

    return {
      totalHolesDrilled,
      totalDepthDrilled,
      totalBlasted,
      totalLoaded,
      totalTransported
    };
  };

  const summary = calculateSummary();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading quarry production report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Drill className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Quarry Production Report</h3>
            <p className="text-sm text-slate-600">Operations summary by contractor</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <Drill className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Drilling</p>
                <p className="text-2xl font-bold text-blue-900">{summary.totalHolesDrilled}</p>
                <p className="text-xs text-blue-600">Holes ({summary.totalDepthDrilled.toFixed(1)}m)</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-3">
              <Factory className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xs text-orange-600 font-medium">Blasting</p>
                <p className="text-2xl font-bold text-orange-900">{summary.totalBlasted.toFixed(2)}</p>
                <p className="text-xs text-orange-600">Cubic Meters</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Loading</p>
                <p className="text-2xl font-bold text-green-900">{summary.totalLoaded.toFixed(2)}</p>
                <p className="text-xs text-green-600">Tons</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Transport</p>
                <p className="text-2xl font-bold text-purple-900">{summary.totalTransported.toFixed(2)}</p>
                <p className="text-xs text-purple-600">Tons</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Drilling Summary</h4>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Records:</span>
                  <span className="text-sm font-semibold text-slate-900">{drilling.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Holes:</span>
                  <span className="text-sm font-semibold text-slate-900">{summary.totalHolesDrilled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Depth:</span>
                  <span className="text-sm font-semibold text-slate-900">{summary.totalDepthDrilled.toFixed(2)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Avg per Record:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {drilling.length > 0 ? (summary.totalHolesDrilled / drilling.length).toFixed(1) : 0} holes
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Blasting Summary</h4>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Records:</span>
                  <span className="text-sm font-semibold text-slate-900">{blasting.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Blasted:</span>
                  <span className="text-sm font-semibold text-slate-900">{summary.totalBlasted.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Avg per Blast:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {blasting.length > 0 ? (summary.totalBlasted / blasting.length).toFixed(2) : 0} m³
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Loading Summary</h4>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Records:</span>
                  <span className="text-sm font-semibold text-slate-900">{loading.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Loaded:</span>
                  <span className="text-sm font-semibold text-slate-900">{summary.totalLoaded.toFixed(2)} tons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Avg per Record:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {loading.length > 0 ? (summary.totalLoaded / loading.length).toFixed(2) : 0} tons
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Transport Summary</h4>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Records:</span>
                  <span className="text-sm font-semibold text-slate-900">{transport.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Total Transported:</span>
                  <span className="text-sm font-semibold text-slate-900">{summary.totalTransported.toFixed(2)} tons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Avg per Trip:</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {transport.length > 0 ? (summary.totalTransported / transport.length).toFixed(2) : 0} tons
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
