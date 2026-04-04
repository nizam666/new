import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap, Calendar, AlertTriangle } from 'lucide-react';

interface EBReportFormProps {
  onSuccess: () => void;
}

export function EBReportForm({ onSuccess }: EBReportFormProps) {
  const [loading, setLoading] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().substring(0, 7));
  const [totalUnits, setTotalUnits] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    starting_reading: {
      'KW CH': '',
      'PFC': '',
      'KW UC': ''
    },
    ending_reading: {
      'KW CH': '',
      'PFC': '',
      'KW UC': ''
    },
    notes: ''
  });

  const [summaryReading, setSummaryReading] = useState({ start: '-', end: '-' });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data, error } = await supabase
          .from('eb_reports')
          .select('meter_reading_start, meter_reading_end, starting_reading, ending_reading')
          .gte('report_date', `${summaryMonth}-01`)
          .lte('report_date', `${summaryMonth}-31`)
          .order('created_at', { ascending: true }); // Need chronological order to determine daily start/end properly

        if (error) throw error;

        if (data && data.length > 0) {
          const sum = data.reduce((acc, row) => acc + ((row.meter_reading_end || 0) - (row.meter_reading_start || 0)), 0);
          setTotalUnits(sum);

          // Get start from the first record, and end from the last record for that day
          const firstRecord = data[0];
          const lastRecord = data[data.length - 1];

          setSummaryReading({
            start: firstRecord.starting_reading?.['KW CH'] || '-',
            end: lastRecord.ending_reading?.['KW CH'] || '-'
          });
        } else {
          setTotalUnits(null);
          setSummaryReading({ start: '', end: '' });
        }
      } catch (error) {
        console.error('Error fetching summary:', error);
      }
    };
    fetchSummary();
  }, [summaryMonth, formData]); // Reacts to date picker change or form submission reset

  useEffect(() => {
    const fetchLatestReport = async () => {
      try {
        // Get the current user to confirm identity in the log
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[EB] Fetching previous records for user:', user?.id);

        // --- Check if a KW UC Reset was recorded after the last EB report ---
        const { data: resetData } = await supabase
          .from('eb_bill_records')
          .select('kw_uc_reset, kw_uc_reset_value, created_at')
          .eq('kw_uc_reset', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: lastReportData } = await supabase
          .from('eb_reports')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // If a reset exists and is NEWER than the last EB report → KW UC starts from reset value
        const resetIsActive =
          resetData &&
          resetData.kw_uc_reset === true &&
          (!lastReportData || new Date(resetData.created_at) > new Date(lastReportData.created_at));

        if (resetIsActive) {
          console.log('[EB] KW UC Reset detected! Starting KW UC →', resetData.kw_uc_reset_value);
        }

        const { data, error } = await supabase
          .from('eb_reports')
          .select('ending_reading, created_at, user_id')
          .not('ending_reading', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[EB] RLS or query error:', error);
          throw error;
        }

        console.log('[EB] Fetched previous EB reports:', data);

        // Find the most recent record that has a complete ending_reading
        const validRecord = data?.find(r =>
          r.ending_reading &&
          (r.ending_reading['KW CH'] !== undefined ||
            r.ending_reading['KW UC'] !== undefined)
        );

        if (validRecord && validRecord.ending_reading) {
          console.log('[EB] Using validRecord ending_reading:', validRecord.ending_reading);
          // Normalize values to strings (they may be stored as numbers in JSONB)
          const normalized = {
            'KW CH': String(validRecord.ending_reading['KW CH'] ?? ''),
            'PFC': String(validRecord.ending_reading['PFC'] ?? ''),
            // If KW UC Reset was applied, override KW UC with the reset value (usually 0)
            'KW UC': resetIsActive
              ? String(resetData!.kw_uc_reset_value ?? 0)
              : String(validRecord.ending_reading['KW UC'] ?? ''),
          };
          setFormData(prev => ({
            ...prev,
            starting_reading: normalized
          }));
        } else {
          console.warn('[EB] No valid previous record found. Starting reading will be empty.');
          setFormData(prev => ({
            ...prev,
            starting_reading: {
              'KW CH': '',
              'PFC': '',
              // If a reset exists even with no prior EB report, apply the reset value
              'KW UC': resetIsActive ? String(resetData!.kw_uc_reset_value ?? 0) : ''
            }
          }));
        }
      } catch (error) {
        console.error('[EB] Error fetching latest EB report:', error);
      }
    };

    fetchLatestReport();
  }, [formData.report_date]);

  const createNotification = async (title: string, message: string, metadata: Record<string, unknown> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .insert([{
        user_id: user.id,
        type: 'pf_warning',
        title,
        message,
        metadata: { ...metadata, report_date: formData.report_date }
      }]);
  };

  const checkPFAndNotify = async () => {
    const startingPF = parseFloat(formData.starting_reading['PFC']) || 0;
    const endingPF = parseFloat(formData.ending_reading['PFC']) || 0;

    if (startingPF > 0.95) {
      await createNotification(
        'High Power Factor Warning',
        `Starting PF (${startingPF}) exceeds 0.95`,
        { pf_value: startingPF, reading_type: 'starting' }
      );
    }

    if (endingPF > 0.95) {
      await createNotification(
        'High Power Factor Warning',
        `Ending PF (${endingPF}) exceeds 0.95`,
        { pf_value: endingPF, reading_type: 'ending' }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const startKWUC = parseFloat(formData.starting_reading['KW UC']) || 0;
      const endKWUC = parseFloat(formData.ending_reading['KW UC']) || 0;

      if (endKWUC < startKWUC) {
        throw new Error('Ending KW UC must be equal to or greater than Starting KW UC.');
      }

      await checkPFAndNotify();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('eb_reports')
        .insert([{
          user_id: user.id,
          report_date: formData.report_date,
          starting_reading: formData.starting_reading,
          ending_reading: formData.ending_reading,
          meter_reading_start: parseFloat(formData.starting_reading['KW CH']) * 40 || 0,
          meter_reading_end: parseFloat(formData.ending_reading['KW CH']) * 40 || 0,
          notes: formData.notes || null
        }]);

      if (error) throw error;

      alert('EB report submitted successfully!');
      setFormData({
        report_date: new Date().toISOString().split('T')[0],
        starting_reading: formData.ending_reading, // Retain what was just submitted as the future starting point!
        ending_reading: {
          'KW CH': '',
          'PFC': '',
          'KW UC': '',
        },
        notes: ''
      });
      onSuccess();
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(error?.message || error?.details || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const calculateUnits = () => {
    const startKWCH = parseFloat(formData.starting_reading['KW CH']) || 0;
    const endKWCH = parseFloat(formData.ending_reading['KW CH']) || 0;
    return Math.max(0, (endKWCH - startKWCH) * 40);
  };

  const calculateCost = () => {
    return 0;
  };

  const handleReadingChange = (type: 'starting' | 'ending', field: string, value: string) => {
    setFormData(prev => {
      if (type === 'starting') {
        return {
          ...prev,
          starting_reading: {
            ...prev.starting_reading,
            [field]: value
          }
        };
      }

      return {
        ...prev,
        ending_reading: {
          ...prev.ending_reading,
          [field]: value
        }
      };
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Daily EB Report</h3>
        </div>

        {(parseFloat(formData.starting_reading['PFC']) > 0.95 || parseFloat(formData.ending_reading['PFC']) > 0.95) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Warning: Power Factor (PFC) exceeds 0.95. A notification has been sent to the director.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-6">
          {/* Report Date */}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Report Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="date"
                required
                value={formData.report_date}
                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Meter Readings - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Starting Reading */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-4">Starting Reading</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">KW CH</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={formData.starting_reading['KW CH']}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500 cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">PFC</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={formData.starting_reading['PFC']}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500 cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">KW UC *</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={formData.starting_reading['KW UC']}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500 cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Ending Reading */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-4">Ending Reading</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">KW CH</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ending_reading['KW CH']}
                    onChange={(e) => handleReadingChange('ending', 'KW CH', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">PFC</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ending_reading['PFC']}
                    onChange={(e) => handleReadingChange('ending', 'PFC', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">KW UC *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.ending_reading['KW UC']}
                    onChange={(e) => handleReadingChange('ending', 'KW UC', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-sm font-medium text-slate-600 mb-1">Units Consumed</div>
              <input
                type="text"
                value={calculateUnits().toFixed(2)}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-semibold mt-2"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Total Cost
              </label>
              <input
                type="text"
                value={'₹' + calculateCost().toFixed(2)}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-green-700 font-semibold mt-2"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Any other observations or remarks..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-slate-400 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit EB Report'}
          </button>
        </div>
      </form>

      {/* Monthly Units Summary Widget */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Monthly Units Summary Report</h3>
          <input
            type="month"
            value={summaryMonth}
            onChange={(e) => setSummaryMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm w-40"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 font-medium">Start Reading (KW CH)</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{summaryReading.start}</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 font-medium">End Reading (KW CH)</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{summaryReading.end}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex flex-col justify-center">
            <span className="text-yellow-800 font-medium text-sm">Total Consumed Units</span>
            <span className="text-2xl font-bold text-yellow-700 mt-1">
              {totalUnits !== null ? totalUnits.toFixed(2) : '0.00'} Units
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
