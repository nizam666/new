import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Wrench, Clock, Camera, Save, X, Loader2 } from 'lucide-react';

export function CrusherMaintenanceForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState<{ id: string, name: string }[]>([]);
  const [fetchingEquipment, setFetchingEquipment] = useState(true);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [formData, setFormData] = useState({
    equipment_id: '',
    maintenance_type: 'routine',
    description: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
  });

  // Fetch or create crusher equipment
  useEffect(() => {
    const fetchOrCreateEquipment = async () => {
      try {
        const crusherNames = ['Jaw Crusher', 'VSI'];
        const { data: existing, error: fetchError } = await supabase
          .from('equipment')
          .select('id, name')
          .eq('type', 'crusher');
        
        if (fetchError) throw fetchError;

        const results: { id: string, name: string }[] = [...(existing || [])];
        const missingNames = crusherNames.filter(name => !results.some(e => e.name === name));

        if (missingNames.length > 0) {
          const { data: created, error: createError } = await supabase
            .from('equipment')
            .insert(missingNames.map(name => ({
              name,
              type: 'crusher',
              status: 'operational'
            })))
            .select('id, name');
          
          if (createError) {
            console.warn('Could not create missing equipment (likely permission error). Using existing if any.');
          } else if (created) {
            results.push(...created);
          }
        }
        
        // Filter to only show Jaw Crusher and VSI specifically
        const filtered = results.filter(e => crusherNames.includes(e.name));
        setEquipment(filtered);

        if (filtered.length > 0) {
          setFormData(prev => ({ ...prev, equipment_id: filtered[0].id }));
        }
      } catch (error) {
        console.error('Error fetching/creating equipment:', error);
      } finally {
        setFetchingEquipment(false);
      }
    };
    fetchOrCreateEquipment();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles];

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large (max 10MB)`);
        return;
      }
      newFiles.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setSelectedFiles(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...previews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSetTime = (field: 'start_time' | 'end_time') => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    setFormData(prev => ({ ...prev, [field]: timeString }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // 1. Insert maintenance record
      const { data: maintenanceRecord, error: maintenanceError } = await supabase
        .from('machine_maintenance')
        .insert([{
          equipment_id: formData.equipment_id,
          maintenance_type: formData.maintenance_type,
          description: formData.description,
          performed_by: user.id,
          scheduled_date: formData.scheduled_date,
          completed_date: formData.end_time ? formData.scheduled_date : null,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null
        }])
        .select()
        .single();

      if (maintenanceError) throw maintenanceError;

      // 2. Upload photos if any
      if (selectedFiles.length > 0) {
        setUploadingMedia(true);
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

          // 3. Insert media record using record_id link
          const { error: mediaError } = await supabase
            .from('media_uploads')
            .insert([{
              user_id: user.id,
              record_type: 'maintenance',
              record_id: maintenanceRecord.id,
              file_url: data.publicUrl,
              file_type: 'photo',
              description: `Maintenance photo for ${formData.maintenance_type}`
            }]);

          if (mediaError) throw mediaError;
        }
      }

      alert('Maintenance report saved successfully!');
      
      // Reset form
      setFormData({
        equipment_id: equipment[0]?.id || '',
        maintenance_type: 'routine',
        description: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
      });
      setSelectedFiles([]);
      setPreviews([]);
      
      if (onSuccess) onSuccess();

    } catch (error: any) {
      console.error('Error saving maintenance report:', error);
      alert(error.message || 'Unknown error');
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Wrench className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Crusher Maintenance Report</h3>
          <p className="text-sm text-slate-600">Document machine maintenance, timing, and photos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Machine *
          </label>
          <select
            required
            value={formData.equipment_id}
            onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            disabled={fetchingEquipment}
          >
            {fetchingEquipment ? (
              <option>Loading machines...</option>
            ) : (
              equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maintenance Type *
          </label>
          <select
            required
            value={formData.maintenance_type}
            onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="routine">Routine Maintenance</option>
            <option value="preventive">Preventive Maintenance</option>
            <option value="breakdown">Breakdown Repair</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maintenance Date *
          </label>
          <input
            type="date"
            required
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Timing Section */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Start Time
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSetTime('start_time')}
                className="px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                Set Now
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Time
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSetTime('end_time')}
                className="px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                Set Now
              </button>
            </div>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maintenance Photos
          </label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
            {previews.map((url, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img src={url} className="w-full h-full object-cover rounded-lg border border-slate-200" alt="Preview" />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full shadow-sm hover:bg-red-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Camera className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs font-medium text-slate-600">Add Photos</span>
            </label>
          </div>
          <p className="text-xs text-slate-500">Capture or upload photos documenting the maintenance work.</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description of Work
          </label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Detailed description of the maintenance activities, parts replaced, etc..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {uploadingMedia ? 'Uploading Photos...' : 'Saving Report...'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Maintenance Report
            </>
          )}
        </button>
      </div>
    </form>
  );
}
