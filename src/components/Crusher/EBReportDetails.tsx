import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap, Calendar, TrendingUp, DollarSign } from 'lucide-react';

interface EBReport {
  id: string;
  report_date: string;
  meter_reading_start: number;
  meter_reading_end: number;
  units_consumed: number;
  cost_per_unit: number;
  total_cost: number;
  power_cuts: string;
  equipment_status: string;
  notes: string;
  created_at: string;
}

export function EBReportDetails() {
  const [reports, setReports] = useState<EBReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<EBReport | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('eb_reports')
        .select('*')
        .order('report_date', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching EB reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-amber-100 text-amber-800';
      case 'breakdown':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const calculateStats = () => {
    const totalUnits = reports.reduce((sum, r) => sum + r.units_consumed, 0);
    const totalCost = reports.reduce((sum, r) => sum + r.total_cost, 0);
    const avgCostPerUnit = totalUnits > 0 ? totalCost / totalUnits : 0;
    return { totalUnits, totalCost, avgCostPerUnit, reportCount: reports.length };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading EB reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-xs text-yellow-600 font-medium">Total Units</p>
              <p className="text-xl font-bold text-yellow-900">{stats.totalUnits.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-xs text-green-600 font-medium">Total Cost</p>
              <p className="text-xl font-bold text-green-900">₹{stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600 font-medium">Avg Cost/Unit</p>
              <p className="text-xl font-bold text-blue-900">₹{stats.avgCostPerUnit.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-xs text-purple-600 font-medium">Reports</p>
              <p className="text-xl font-bold text-purple-900">{stats.reportCount}</p>
            </div>
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <Zap className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No EB reports found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">EB Reports</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        EB Report - {new Date(report.report_date).toLocaleDateString()}
                      </h4>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(report.report_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.equipment_status)}`}>
                    {report.equipment_status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Start Reading</p>
                    <p className="text-sm font-bold text-slate-900">{report.meter_reading_start}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">End Reading</p>
                    <p className="text-sm font-bold text-slate-900">{report.meter_reading_end}</p>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-600 mb-1">Units Consumed</p>
                    <p className="text-sm font-bold text-yellow-900">{report.units_consumed.toFixed(2)}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-600 mb-1">Total Cost</p>
                    <p className="text-sm font-bold text-green-900">₹{report.total_cost.toFixed(2)}</p>
                  </div>
                </div>

                {selectedReport?.id === report.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div>
                      <span className="text-sm font-medium text-slate-700">Cost per Unit: </span>
                      <span className="text-sm text-slate-900">₹{report.cost_per_unit.toFixed(2)}</span>
                    </div>

                    {report.power_cuts && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Power Cuts: </span>
                        <p className="text-sm text-slate-600 mt-1">{report.power_cuts}</p>
                      </div>
                    )}

                    {report.notes && (
                      <div>
                        <span className="text-sm font-medium text-slate-700">Notes: </span>
                        <p className="text-sm text-slate-600 mt-1">{report.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
