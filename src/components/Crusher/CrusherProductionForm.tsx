import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Factory, Calendar, Loader2, Clock } from 'lucide-react';

interface CrusherProductionFormProps {
  onSuccess: () => void;
}

export function CrusherProductionForm({ onSuccess }: CrusherProductionFormProps) {
  const [loading, setLoading] = useState(false);
  const [materialSources, setMaterialSources] = useState<{ label: string, value: string }[]>([]);
  const [fetchingSources, setFetchingSources] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    shift: 'morning',
    crusher_type: 'jaw',
    machine_start_time: '',
    machine_end_time: '',
    machine_working_hours: '0.0', // Changed default to 0.0 as it will be calculated
    machine_downtime: '0.0',
    maintenance_hours: '0.0',
    material_source: 'quarry',
    status: 'completed',
    maintenance_notes: '',
    notes: ''
  });

  // Fetch material sources
  useEffect(() => {
    const fetchMaterialSources = async () => {
      try {
        // First, get the latest transport records with quantities
        const { data: transportData, error: transportError } = await supabase
          .from('transport_records')
          .select('material_transported, quantity, date')
          .not('material_transported', 'is', null)
          .not('quantity', 'is', null)
          .gt('quantity', 0) // Only consider records with available quantity
          .order('date', { ascending: false })
          .limit(100); // Limit to most recent 100 records for performance

        if (transportError) throw transportError;

        if (!transportData || transportData.length === 0) {
          // If no transport records found, use default options
          setMaterialSources([
            { label: 'Quarry', value: 'quarry' },
            { label: 'Stockyard', value: 'stockyard' }
          ]);
          setFetchingSources(false);
          return;
        }

        // Find the most recent material with available quantity
        const mostRecentMaterial = transportData.find(record =>
          record.material_transported && (record.quantity || 0) > 0
        );

        // Group by material and sum quantities
        const materialMap = new Map<string, { quantity: number, latestDate: string }>();

        transportData.forEach(record => {
          if (record.material_transported) {
            const current = materialMap.get(record.material_transported) ||
              { quantity: 0, latestDate: '1970-01-01' };

            materialMap.set(record.material_transported, {
              quantity: current.quantity + (record.quantity || 0),
              latestDate: record.date > current.latestDate ? record.date : current.latestDate
            });
          }
        });

        // Convert to array and sort by latest date first, then by quantity
        const sources = Array.from(materialMap.entries())
          .sort((a, b) => {
            // First sort by date (newest first)
            const dateDiff = new Date(b[1].latestDate).getTime() - new Date(a[1].latestDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            // If same date, sort by quantity (highest first)
            return b[1].quantity - a[1].quantity;
          })
          .map(([material, data]) => ({
            label: `${material} (${data.quantity.toFixed(1)} tons)`,
            value: material
          }));

        setMaterialSources(sources);

        // Auto-select the material with the latest date and available quantity
        if (mostRecentMaterial) {
          setFormData(prev => ({
            ...prev,
            material_source: mostRecentMaterial.material_transported || 'quarry'
          }));
        }
      } catch (error) {
        console.error('Error fetching material sources:', error);
        // Fallback to default options if there's an error
        setMaterialSources([
          { label: 'Quarry', value: 'quarry' },
          { label: 'Stockyard', value: 'stockyard' }
        ]);
      } finally {
        setFetchingSources(false);
      }
    };

    fetchMaterialSources();
  }, []);

  // Update current time every minute for the live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Auto-resume active shift on mount
  useEffect(() => {
    // Only resume if we haven't already interacted with this session's form
    // and we don't have an active record ID yet
    if (activeRecordId) return;

    const resumeActiveShift = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('production_records')
          .select('*')
          .eq('manager_id', user.id)
          .eq('status', 'completed')
          .eq('date', today) 
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const record = data[0];
          
          // Don't resume if they just finished this specific record in this session
          if (sessionStorage.getItem(`finished_${record.id}`)) return;

          setActiveRecordId(record.id);
          setFormData({
            date: record.date,
            shift: record.shift || 'morning',
            crusher_type: record.crusher_type || 'jaw',
            machine_start_time: record.machine_start_time || '',
            machine_end_time: record.machine_end_time || '',
            machine_working_hours: record.working_hours?.toString() || '0.0',
            machine_downtime: record.downtime_hours?.toString() || '0.0',
            maintenance_hours: record.maintenance_hours?.toString() || '0.0',
            material_source: record.material_source || 'quarry',
            status: record.status || 'in_progress',
            maintenance_notes: record.maintenance_notes || '',
            notes: record.notes || ''
          });
        } else {
          // If no active shift today, fetch defaults from the MOST RECENT record overall
          const { data: recent, error: recentError } = await supabase
            .from('production_records')
            .select('crusher_type, shift, downtime_hours, maintenance_hours, material_source')
            .eq('manager_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!recentError && recent && recent.length > 0) {
            setFormData(prev => ({
              ...prev,
              crusher_type: recent[0].crusher_type || prev.crusher_type,
              shift: recent[0].shift || prev.shift,
              machine_downtime: recent[0].downtime_hours?.toString() || '0.0',
              maintenance_hours: recent[0].maintenance_hours?.toString() || '0.0',
              material_source: recent[0].material_source || prev.material_source
            }));
          }
        }
      } catch (error) {
        console.error('Error resuming active shift or fetching defaults:', error);
      }
    };

    resumeActiveShift();
  }, []);

  // Auto-calculate working hours when start or end time changes
  useEffect(() => {
    if (!formData.machine_start_time) {
      setFormData(prev => ({
        ...prev,
        machine_working_hours: '0.0'
      }));
      return;
    }

    // Use current time if machine_end_time is not yet set
    const endTimeValue = formData.machine_end_time || `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

    const start = new Date(`2000-01-01T${formData.machine_start_time}:00`);
    const end = new Date(`2000-01-01T${endTimeValue}:00`);

    // Handle overnight shifts (end time < start time)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    setFormData(prev => ({
      ...prev,
      machine_working_hours: diffHours.toFixed(2)
    }));
  }, [formData.machine_start_time, formData.machine_end_time, currentTime]);

  const handleSetCurrentTime = (field: 'machine_start_time' | 'machine_end_time') => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    setFormData(prev => ({
      ...prev,
      [field]: timeString,
      // Automatically set status to completed
      status: 'completed'
    }));
  };

  const calculateTotalHours = () => {
    const working = parseFloat(formData.machine_working_hours) || 0;
    const downtime = parseFloat(formData.machine_downtime) || 0;
    const maintenance = parseFloat(formData.maintenance_hours) || 0;

    // Calculate total shift hours (sum of all time components)
    const totalHours = working + downtime + maintenance;

    // Calculate efficiency percentage
    const efficiency = totalHours > 0 ? (working / totalHours) * 100 : 0;

    return { totalHours, efficiency };
  };

  const { totalHours, efficiency } = calculateTotalHours();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      let finalStatus = formData.status;

      const recordData = {
        manager_id: user.id,
        date: formData.date,
        shift: formData.shift,
        crusher_type: formData.crusher_type,
        machine_start_time: formData.machine_start_time || null,
        machine_end_time: formData.machine_end_time || null,
        working_hours: parseFloat(formData.machine_working_hours),
        downtime_hours: parseFloat(formData.machine_downtime),
        maintenance_hours: parseFloat(formData.maintenance_hours),
        material_source: formData.material_source,
        status: finalStatus,
        maintenance_notes: formData.maintenance_notes,
        notes: formData.notes,
      };

      const { error } = activeRecordId
        ? await supabase
          .from('production_records')
          .update(recordData)
          .eq('id', activeRecordId)
        : await supabase
          .from('production_records')
          .insert([recordData]);

      if (error) throw error;

      alert(activeRecordId ? 'Crusher production record updated successfully!' : 'Crusher production record added successfully!');
      
      // If we were resuming a shift and we finished it, mark it as finished in session
      if (activeRecordId) {
        sessionStorage.setItem(`finished_${activeRecordId}`, 'true');
      }

      // Reset form and active record ID
      setActiveRecordId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        shift: 'morning',
        crusher_type: 'jaw',
        machine_start_time: '',
        machine_end_time: '',
        machine_working_hours: '0.0',
        machine_downtime: '0.0',
        maintenance_hours: '0.0',
        material_source: 'quarry',
        status: 'completed',
        maintenance_notes: '',
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

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Factory className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900">
              {formData.machine_end_time && activeRecordId 
                ? 'Finalize & Save Completed Shift'
                : activeRecordId 
                  ? 'Resume Active Production Shift' 
                  : 'Record Crusher Production'}
            </h3>
            {activeRecordId && (
              <button 
                type="button"
                onClick={() => {
                  if (activeRecordId) {
                    sessionStorage.setItem(`finished_${activeRecordId}`, 'true');
                  }
                  setActiveRecordId(null);
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    shift: 'morning',
                    crusher_type: 'jaw',
                    machine_start_time: '',
                    machine_end_time: '',
                    machine_working_hours: '0.0',
                    machine_downtime: '0.0',
                    maintenance_hours: '0.0',
                    material_source: 'quarry',
                    status: 'completed',
                    maintenance_notes: '',
                    notes: ''
                  });
                }}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium underline text-left"
              >
                Discard active shift and start new record
              </button>
            )}
          </div>
          {formData.machine_start_time && !formData.machine_end_time && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-green-600 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-wider">Shift Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date *
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="date"
              required
              readOnly={!!formData.machine_start_time}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                formData.machine_start_time ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Shift *
          </label>
          <select
            required
            disabled={!!formData.machine_start_time}
            value={formData.shift}
            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              formData.machine_start_time ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300'
            }`}
          >
            <option value="morning">Morning Shift</option>
            <option value="night">Night Shift</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Crusher Type *
          </label>
          <select
            required
            value={formData.crusher_type}
            onChange={(e) => setFormData({ ...formData, crusher_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="jaw">Jaw Crusher</option>
            <option value="vsi">VSI</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Source *
            {fetchingSources && (
              <span className="ml-2 inline-flex items-center text-xs text-slate-500">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading latest materials...
              </span>
            )}
            {!fetchingSources && materialSources.length > 0 && (
              <span className="ml-2 text-xs text-green-600">
                ✓ Auto-selected latest material
              </span>
            )}
          </label>
          <select
            required
            value={formData.material_source}
            onChange={(e) => setFormData({ ...formData, material_source: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={fetchingSources}
          >
            {materialSources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
            {materialSources.length === 0 && !fetchingSources && (
              <>
                <option value="quarry">Quarry (No transport data)</option>
                <option value="stockyard">Stockyard (No transport data)</option>
              </>
            )}
          </select>
          {!fetchingSources && materialSources.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Showing materials from latest transport operations with quantities
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="maintenance">Maintenance</option>
            <option value="breakdown">Breakdown</option>
          </select>
        </div>

        {/* Machine Hours Tracking */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Machine Start Time *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    required
                    readOnly={!!formData.machine_start_time}
                    value={formData.machine_start_time}
                    onChange={(e) => setFormData({ ...formData, machine_start_time: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      formData.machine_start_time ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300'
                    }`}
                  />
                </div>
                {!formData.machine_start_time && (
                  <button
                    type="button"
                    onClick={() => handleSetCurrentTime('machine_start_time')}
                    className="px-3 py-2 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 border border-orange-200 transition-colors"
                  >
                    Set Now
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Machine End Time
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={formData.machine_end_time}
                    onChange={(e) => setFormData({ ...formData, machine_end_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSetCurrentTime('machine_end_time')}
                  className="px-3 py-2 text-xs font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 border border-orange-200"
                >
                  Set Now
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Machine Working Hours (Auto)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="24"
                  required
                  readOnly
                  value={formData.machine_working_hours}
                  className="w-full pl-4 pr-10 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed"
                />
                <span className="absolute right-3 top-2 text-slate-500">hrs</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Machine Downtime
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  value={formData.machine_downtime}
                  onChange={(e) => setFormData({ ...formData, machine_downtime: e.target.value })}
                  className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2 text-slate-500">hrs</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maintenance Hours
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  value={formData.maintenance_hours}
                  onChange={(e) => setFormData({ ...formData, maintenance_hours: e.target.value })}
                  className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2 text-slate-500">hrs</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-slate-500">Total Shift Hours</p>
              <p className="text-lg font-semibold">{totalHours.toFixed(1)} hrs</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Machine Efficiency</p>
              <p className="text-lg font-semibold">{efficiency.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Uptime</p>
              <p className={`text-lg font-semibold ${formData.machine_start_time && !formData.machine_end_time ? 'text-green-600' : ''}`}>
                {totalHours > 0 ? ((parseFloat(formData.machine_working_hours) / totalHours) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
        </div>


        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maintenance Notes
          </label>
          <textarea
            value={formData.maintenance_notes}
            onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Any maintenance activities performed..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="General observations or remarks..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Saving...' : 'Save Production Record'}
        </button>
      </div>
    </form>
  );
}
