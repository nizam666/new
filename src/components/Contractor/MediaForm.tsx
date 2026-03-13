import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, Save, Video, Upload, X } from 'lucide-react';

const recordTypes = [
  { value: 'drilling', label: 'Drilling' },
  { value: 'blasting', label: 'Blasting' },
  { value: 'loading', label: 'Breaking/Loading' },
  { value: 'transport', label: 'Transport' },
  { value: 'general', label: 'General' }
];

const mediaTypes = [
  { value: 'photo', label: 'Photo', icon: Camera },
  { value: 'video', label: 'Video', icon: Video }
];

export function MediaForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    record_type: '',
    media_type: 'photo',
    title: '',
    description: '',
    location: '',
    date_taken: new Date().toISOString().split('T')[0]
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 50MB');
      return;
    }

    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

    if (formData.media_type === 'photo' && !validImageTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    if (formData.media_type === 'video' && !validVideoTypes.includes(file.type)) {
      alert('Please select a valid video file (MP4, MOV, AVI)');
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl('');
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const uploadFile = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      const mediaUrl = await uploadFile(selectedFile);

      const dateTaken = new Date(formData.date_taken).toISOString();

      const { error } = await supabase
        .from('media_records')
        .insert([
          {
            user_id: user.id,
            record_type: formData.record_type,
            media_type: formData.media_type,
            media_url: mediaUrl,
            title: formData.title,
            description: formData.description,
            location: formData.location,
            date_taken: dateTaken
          }
        ]);

      if (error) throw error;

      setFormData({
        record_type: '',
        media_type: 'photo',
        title: '',
        description: '',
        location: '',
        date_taken: new Date().toISOString().split('T')[0]
      });
      setSelectedFile(null);
      setPreviewUrl('');

      alert('Media uploaded successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error uploading media: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
          <Camera className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Upload Photo/Video</h3>
          <p className="text-sm text-slate-600">Upload and document site media from your device</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Media Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {mediaTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, media_type: type.value });
                    removeFile();
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${formData.media_type === type.value
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-slate-300 hover:border-slate-400'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Category
          </label>
          <select
            value={formData.record_type}
            onChange={(e) => setFormData({ ...formData, record_type: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="">Select category</option>
            {recordTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Upload {formData.media_type === 'photo' ? 'Photo' : 'Video'}
          </label>

          {!selectedFile ? (
            <div className="relative">
              <input
                type="file"
                accept={formData.media_type === 'photo' ? 'image/*' : 'video/*'}
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-700">
                  Click to upload {formData.media_type === 'photo' ? 'photo' : 'video'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  {formData.media_type === 'photo' ? 'JPEG, PNG, GIF, WebP' : 'MP4, MOV, AVI'} (Max 50MB)
                </span>
              </label>
            </div>
          ) : (
            <div className="relative border-2 border-pink-500 rounded-lg p-4">
              {previewUrl && formData.media_type === 'photo' && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {formData.media_type === 'photo' ? (
                    <Camera className="w-5 h-5 text-pink-600" />
                  ) : (
                    <Video className="w-5 h-5 text-pink-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="Brief title for this media"
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="Where was this taken?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date Taken
          </label>
          <input
            type="date"
            value={formData.date_taken}
            onChange={(e) => setFormData({ ...formData, date_taken: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="Describe what this photo/video shows..."
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading || !selectedFile}
          className="flex items-center gap-2 px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Upload Media
            </>
          )}
        </button>
      </div>
    </form>
  );
}
