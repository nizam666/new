import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, AlertCircle, HardHat } from 'lucide-react';
import { toast } from 'react-toastify';

export function JCBOperationsForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    operator_name: '',
    vehicle_number: '',
    start_time: '',
    end_time: '',
    total_hours: '',
    fuel_consumed: '',
    work_description: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const parseTime = (timeStr: string): number | null => {
    // Try to parse time in HH:MM format (24-hour)
    const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
      const hours = parseInt(time24Match[1], 10);
      const minutes = parseInt(time24Match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours + minutes / 60;
      }
    }
    
    // Try to parse time in H:MM AM/PM format (12-hour)
    const time12Match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
    if (time12Match) {
      let hours = parseInt(time12Match[1], 10);
      const minutes = parseInt(time12Match[2], 10);
      const period = (time12Match[3] || '').toLowerCase();
      
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours + minutes / 60;
      }
    }
    
    return null;
  };

  const calculateHours = () => {
    if (formData.start_time && formData.end_time) {
      const startHours = parseTime(formData.start_time);
      const endHours = parseTime(formData.end_time);
      
      if (startHours !== null && endHours !== null) {
        let diffHours = endHours - startHours;
        if (diffHours < 0) {
          diffHours += 24; // Add 24 hours if end time is on the next day
        }
        
        setFormData(prev => ({
          ...prev,
          total_hours: diffHours.toFixed(2)
        }));
      } else {
        // If time format is invalid, clear the total hours
        setFormData(prev => ({
          ...prev,
          total_hours: ''
        }));
      }
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.operator_name) {
      errors.push('Operator name is required');
    }
    if (!formData.vehicle_number) {
      errors.push('Driver name is required');
    }
    if (!formData.start_time) {
      errors.push('Start time is required');
    }
    if (!formData.end_time) {
      errors.push('End time is required');
    }
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const jcbData = {
        user_id: user?.id,
        date: formData.date,
        operator_name: formData.operator_name,
        vehicle_number: formData.vehicle_number,
        start_time: formData.start_time,
        end_time: formData.end_time,
        total_hours: parseFloat(formData.total_hours) || 0,
        fuel_consumed: parseFloat(formData.fuel_consumed) || 0,
        work_description: formData.work_description || null,
        notes: formData.notes || null,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('jcb_operations')
        .insert([jcbData]);

      if (error) throw error;

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        operator_name: '',
        vehicle_number: '',
        start_time: '',
        end_time: '',
        total_hours: '',
        fuel_consumed: '',
        work_description: '',
        notes: ''
      });

      toast.success('JCB operation recorded successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving JCB operation:', error);
      setError(error instanceof Error ? error.message : 'Failed to save JCB operation');
      toast.error('Failed to save JCB operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">JCB Operations</h3>
          <p className="text-sm text-slate-600">Record JCB operations and maintenance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Work Type
          </label>
          <select
            name="operator_name"
            value={formData.operator_name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Select work type</option>
            <option value="Good borders loading">Good borders loading</option>
            <option value="Material loading">Material loading</option>
            <option value="Bunker works">Bunker works</option>
            <option value="Crusher works">Crusher works</option>
            <option value="Quarry works">Quarry works</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Driver Name
          </label>
          <input
            type="text"
            name="driver_name"
            value={formData.vehicle_number}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Enter driver name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Start Time
          </label>
          <input
            type="text"
            name="start_time"
            value={formData.start_time}
            onChange={handleChange}
            onBlur={calculateHours}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g., 9:00 AM or 14:30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            End Time
          </label>
          <input
            type="text"
            name="end_time"
            value={formData.end_time}
            onChange={handleChange}
            onBlur={calculateHours}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g., 5:30 PM or 17:30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Total Hours
          </label>
          <input
            type="number"
            name="total_hours"
            value={formData.total_hours}
            readOnly
            className="w-full px-4 py-2 border border-slate-300 bg-slate-50 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Fuel Consumed (Liters)
          </label>
          <input
            type="number"
            name="fuel_consumed"
            value={formData.fuel_consumed}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="0.0"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Work Description
          </label>
          <input
            type="text"
            name="work_description"
            value={formData.work_description}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="E.g., Loading, Leveling, Excavation, etc."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Any additional notes or observations..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
