import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Factory, Calendar, Loader2 } from 'lucide-react';

interface CrusherProductionFormProps {
  onSuccess: () => void;
}

export function CrusherProductionForm({ onSuccess }: CrusherProductionFormProps) {
  const [loading, setLoading] = useState(false);
  const [materialSources, setMaterialSources] = useState<{ label: string, value: string }[]>([]);
  const [fetchingSources, setFetchingSources] = useState(true);
  // Fetch material sources from transport operations and auto-select the one with highest quantity
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

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    shift: 'morning',
    crusher_type: 'jaw',
    machine_working_hours: '8.0',
    machine_downtime: '0.0',
    maintenance_hours: '0.0',
    material_source: 'quarry',
    status: 'operational',
    maintenance_notes: '',
    notes: ''
  });

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

      const { error } = await supabase
        .from('production_records')
        .insert([
          {
            date: formData.date,
            shift: formData.shift,
            crusher_type: formData.crusher_type,
            machine_working_hours: parseFloat(formData.machine_working_hours),
            machine_downtime: parseFloat(formData.machine_downtime),
            maintenance_hours: parseFloat(formData.maintenance_hours),
            material_source: formData.material_source,
            status: formData.status,
            maintenance_notes: formData.maintenance_notes,
            notes: formData.notes,
          },
        ]);

      if (error) throw error;

      alert('Crusher production record added successfully!');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        shift: 'morning',
        crusher_type: 'jaw',
        machine_working_hours: '8.0',
        machine_downtime: '0.0',
        maintenance_hours: '0.0',
        material_source: 'quarry',
        status: 'operational',
        maintenance_notes: '',
        notes: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
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
        <h3 className="text-lg font-semibold text-slate-900">Record Crusher Production</h3>
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
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Shift *
          </label>
          <select
            required
            value={formData.shift}
            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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

        {/* Machine Hours Tracking */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Machine Working Hours *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  required
                  value={formData.machine_working_hours}
                  onChange={(e) => setFormData({ ...formData, machine_working_hours: e.target.value })}
                  className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              <p className="text-lg font-semibold">
                {totalHours > 0 ? ((parseFloat(formData.machine_working_hours) / totalHours) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
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
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="maintenance">Maintenance</option>
            <option value="breakdown">Breakdown</option>
          </select>
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
