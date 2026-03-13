import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Save, X } from 'lucide-react';

const incidentTypes = [
  'Near Miss',
  'Minor Injury',
  'Major Injury',
  'Equipment Damage',
  'Environmental',
  'Fire',
  'Chemical Spill',
  'Other'
];

const severityLevels = [
  'Low',
  'Medium',
  'High',
  'Critical'
];

export function SafetyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [images, setImages] = useState<{ url: string, name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;

      const files = Array.from(e.target.files);
      const newImages: { url: string, name: string }[] = [];

      for (const file of files) {
        setUploading(true);
        setUploadProgress(0);

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `safety-incidents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('safety-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('safety-images')
          .getPublicUrl(filePath);

        newImages.push({
          url: publicUrl,
          name: file.name
        });
      }

      setImages(prev => [...prev, ...newImages]);
      setUploading(false);

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    incident_type: '',
    severity: '',
    description: '',
    people_involved: '',
    witnesses: '',
    immediate_action: '',
    corrective_action: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('safety_incidents')
        .insert([
          {
            reported_by: user.id,
            date: formData.date,
            time: formData.time,
            location: formData.location,
            incident_type: formData.incident_type,
            severity: formData.severity,
            description: formData.description,
            people_involved: formData.people_involved,
            witnesses: formData.witnesses,
            immediate_action: formData.immediate_action,
            corrective_action: formData.corrective_action,
            status: 'reported',
            image_urls: images.map(img => img.url)
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        location: '',
        incident_type: '',
        severity: '',
        description: '',
        people_involved: '',
        witnesses: '',
        immediate_action: '',
        corrective_action: ''
      });
      setImages([]);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Safety incident reported successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error reporting incident: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Report Safety Incident</h3>
          <p className="text-sm text-slate-600">Document incidents and near misses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Time
          </label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Where did this occur?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Incident Type
          </label>
          <select
            value={formData.incident_type}
            onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Select incident type</option>
            {incidentTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Severity Level
          </label>
          <div className="grid grid-cols-4 gap-3">
            {severityLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFormData({ ...formData, severity: level })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${formData.severity === level
                  ? level === 'Critical'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : level === 'High'
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : level === 'Medium'
                        ? 'border-amber-600 bg-amber-50 text-amber-700'
                        : 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-300 hover:border-slate-400'
                  }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Describe what happened in detail..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Incident Photos (Optional)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg">
            <div className="space-y-1 text-center">
              <div className="flex text-sm text-slate-600 justify-center">
                <label
                  className="relative cursor-pointer bg-white rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none"
                >
                  <span>Upload photos</span>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-500">
                PNG, JPG, GIF up to 5MB
              </p>
              {uploading && (
                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-red-600 h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>

          {images.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Attached Photos ({images.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-slate-100">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-full w-full object-cover object-center"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {img.name.length > 20 ? `${img.name.substring(0, 17)}...` : img.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            People Involved
          </label>
          <input
            type="text"
            value={formData.people_involved}
            onChange={(e) => setFormData({ ...formData, people_involved: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Names of people involved"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Witnesses
          </label>
          <input
            type="text"
            value={formData.witnesses}
            onChange={(e) => setFormData({ ...formData, witnesses: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Names of witnesses"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Immediate Action Taken
          </label>
          <textarea
            value={formData.immediate_action}
            onChange={(e) => setFormData({ ...formData, immediate_action: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="What actions were taken immediately after the incident?"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Recommended Corrective Action
          </label>
          <textarea
            value={formData.corrective_action}
            onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="What should be done to prevent this from happening again?"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Reporting...' : 'Report Incident'}
        </button>
      </div>
    </form>
  );
}
