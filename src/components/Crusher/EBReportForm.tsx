import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap, Calendar, AlertTriangle } from 'lucide-react';

interface EBReportFormProps {
  onSuccess: () => void;
}

export function EBReportForm({ onSuccess }: EBReportFormProps) {
  const [loading, setLoading] = useState(false);
  // Removed unused loadingLatestReport state as it's no longer needed
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    starting_reading: {
      kw: '',
      kva: '',
      kvah: '',
      kwh: '',
      pf_c: '',
      pf: ''
    },
    ending_reading: {
      kw: '',
      kva: '',
      kvah: '',
      kwh: '',
      pf_c: '',
      pf: ''
    },
    notes: ''
  });

  useEffect(() => {
    const fetchLatestReport = async () => {
      try {
        const { data, error } = await supabase
          .from('eb_reports')
          .select('ending_reading')
          .order('report_date', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0 && data[0].ending_reading) {
          setFormData(prev => ({
            ...prev,
            starting_reading: data[0].ending_reading,
            ending_reading: data[0].ending_reading // Set both to the same value
          }));
        }
      } catch (error) {
        console.error('Error fetching latest EB report:', error);
      }
    };

    fetchLatestReport();
  }, []);

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
    const startingPF = parseFloat(formData.starting_reading.pf) || 0;
    const endingPF = parseFloat(formData.ending_reading.pf) || 0;

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
      // Check PF values and create notifications if needed
      await checkPFAndNotify();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      // Remove unused variables

      const { error } = await supabase
        .from('eb_reports')
        .insert([{
          user_id: user.id,
          report_date: formData.report_date,
          starting_reading: formData.starting_reading,
          ending_reading: formData.ending_reading,
          notes: formData.notes || null
        }]);

      if (error) throw error;

      alert('EB report submitted successfully!');
      setFormData({
        report_date: new Date().toISOString().split('T')[0],
        starting_reading: {
          kw: '',
          kva: '',
          kvah: '',
          kwh: '',
          pf_c: '',
          pf: ''
        },
        ending_reading: {
          kw: '',
          kva: '',
          kvah: '',
          kwh: '',
          pf_c: '',
          pf: ''
        },
        notes: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const calculateUnits = () => {
    const startKWH = parseFloat(formData.starting_reading.kwh) || 0;
    const endKWH = parseFloat(formData.ending_reading.kwh) || 0;
    return Math.max(0, endKWH - startKWH);
  };

  const calculateCost = () => {
    // Cost calculation removed as cost_per_unit field is removed
    return 0;
  };

  const handleReadingChange = (type: 'starting' | 'ending', field: string, value: string) => {
    setFormData(prev => {
      // If we're updating the starting reading, update both starting and ending readings
      if (type === 'starting') {
        return {
          ...prev,
          starting_reading: {
            ...prev.starting_reading,
            [field]: value
          },
          ending_reading: {
            ...prev.ending_reading,
            [field]: value
          }
        };
      }

      // If we're updating the ending reading, only update the ending reading
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Daily EB Report</h3>
      </div>

      {parseFloat(formData.starting_reading.pf) > 0.95 || parseFloat(formData.ending_reading.pf) > 0.95 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Warning: Power Factor (PF) exceeds 0.95. A notification has been sent to the director.
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">KW</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.starting_reading.kw}
                  onChange={(e) => handleReadingChange('starting', 'kw', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KVA</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.starting_reading.kva}
                  onChange={(e) => handleReadingChange('starting', 'kva', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KVAH</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.starting_reading.kvah}
                  onChange={(e) => handleReadingChange('starting', 'kvah', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KWH</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.starting_reading.kwh}
                  onChange={(e) => handleReadingChange('starting', 'kwh', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">PF C</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.starting_reading.pf_c}
                  onChange={(e) => handleReadingChange('starting', 'pf_c', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">PF</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.starting_reading.pf}
                  onChange={(e) => handleReadingChange('starting', 'pf', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Ending Reading */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-4">Ending Reading</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">KW</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ending_reading.kw}
                  onChange={(e) => handleReadingChange('ending', 'kw', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KVA</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ending_reading.kva}
                  onChange={(e) => handleReadingChange('ending', 'kva', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KVAH</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ending_reading.kvah}
                  onChange={(e) => handleReadingChange('ending', 'kvah', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KWH *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.ending_reading.kwh}
                  onChange={(e) => handleReadingChange('ending', 'kwh', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">PF C</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ending_reading.pf_c}
                  onChange={(e) => handleReadingChange('ending', 'pf_c', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">PF</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ending_reading.pf}
                  onChange={(e) => handleReadingChange('ending', 'pf', e.target.value)}
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
              value={`${calculateUnits().toFixed(2)} kWh`}
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
  );
}
