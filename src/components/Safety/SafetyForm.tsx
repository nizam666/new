import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Shield, Loader2, X, MapPin, Clock,
  Users, AlertTriangle, Zap, Flame, Droplets,
  Wrench, Activity, HelpCircle, ImagePlus, CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

const INCIDENT_TYPES = [
  { value: 'Near Miss',         icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { value: 'Minor Injury',      icon: Activity,      color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 'Major Injury',      icon: Zap,           color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
  { value: 'Equipment Damage',  icon: Wrench,        color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { value: 'Fire',              icon: Flame,         color: 'text-rose-500',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  { value: 'Chemical Spill',    icon: Droplets,      color: 'text-teal-500',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  { value: 'Environmental',     icon: Activity,      color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-200' },
  { value: 'Other',             icon: HelpCircle,    color: 'text-slate-400',  bg: 'bg-slate-50',  border: 'border-slate-200' },
];

const SEVERITY_LEVELS = [
  { value: 'Low',      bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400', desc: 'Minimal impact' },
  { value: 'Medium',   bg: 'bg-amber-500',   text: 'text-white', ring: 'ring-amber-400',   desc: 'Action required' },
  { value: 'High',     bg: 'bg-orange-500',  text: 'text-white', ring: 'ring-orange-400',  desc: 'Urgent response' },
  { value: 'Critical', bg: 'bg-rose-600',    text: 'text-white', ring: 'ring-rose-400',    desc: 'Emergency!' },
];

export function SafetyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    corrective_action: '',
  });

  const update = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const newImages: { url: string; name: string }[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `safety-incidents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('safety-images').upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('safety-images').getPublicUrl(path);
        newImages.push({ url: publicUrl, name: file.name });
      }
      setImages(prev => [...prev, ...newImages]);
      toast.success(`${newImages.length} photo${newImages.length > 1 ? 's' : ''} attached`);
    } catch (err) {
      toast.error('Failed to upload photo');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.incident_type) return toast.warning('Please select an incident type');
    if (!formData.severity) return toast.warning('Please select a severity level');

    setLoading(true);
    try {
      const { error } = await supabase.from('safety_incidents').insert([{
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
        image_urls: images.map(img => img.url),
      }]);
      if (error) throw error;

      toast.success('Incident reported successfully');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        location: '', incident_type: '', severity: '', description: '',
        people_involved: '', witnesses: '', immediate_action: '', corrective_action: '',
      });
      setImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const selectedSeverity = SEVERITY_LEVELS.find(s => s.value === formData.severity);

  return (
    <div className="space-y-5 pb-24">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-700 via-red-600 to-orange-500 rounded-3xl md:rounded-[40px] p-8 md:p-12 text-white shadow-2xl shadow-red-500/30">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-40 h-40 rounded-full bg-white" />
          <div className="absolute -bottom-6 -left-6 w-52 h-52 rounded-full bg-white" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Safety Management</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Report Incident</h2>
            <p className="text-white/70 text-sm font-medium mt-0.5">Document incidents and near misses immediately</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Date, Time, Location ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">When & Where</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date *</label>
              <input type="date" required value={formData.date} onChange={(e) => update('date', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-rose-500/10" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Time *</label>
              <input type="time" required value={formData.time} onChange={(e) => update('time', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-rose-500/10" />
            </div>
            <div className="col-span-2 md:col-span-1 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> Location *</label>
              <input type="text" required placeholder="Where did this occur?" value={formData.location} onChange={(e) => update('location', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-rose-500/10 placeholder:text-slate-300" />
            </div>
          </div>
        </div>

        {/* ── Incident Type ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Incident Type *</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INCIDENT_TYPES.map(({ value, icon: Icon, color, bg, border }) => {
              const selected = formData.incident_type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('incident_type', value)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                    selected
                      ? `${bg} ${border} scale-[1.02] shadow-md`
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-2 ${selected ? color : 'text-slate-300'}`} />
                  <p className={`font-black text-xs ${selected ? 'text-slate-900' : 'text-slate-500'}`}>{value}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Severity ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Severity Level *</h3>
            {selectedSeverity && (
              <span className={`px-4 py-1.5 rounded-full text-xs font-black ${selectedSeverity.bg} ${selectedSeverity.text}`}>
                {selectedSeverity.value} — {selectedSeverity.desc}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SEVERITY_LEVELS.map(({ value, bg, text, desc }) => {
              const selected = formData.severity === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('severity', value)}
                  className={`py-5 rounded-2xl font-black text-sm transition-all duration-200 ${
                    selected
                      ? `${bg} ${text} shadow-lg scale-[1.04] ring-4 ring-offset-2`
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  } ${selected ? (value === 'Low' ? 'ring-emerald-300' : value === 'Medium' ? 'ring-amber-300' : value === 'High' ? 'ring-orange-300' : 'ring-rose-300') : ''}`}
                >
                  {value}
                  <p className={`text-[10px] font-medium mt-0.5 ${selected ? 'text-white/70' : 'text-slate-300'}`}>{desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Description ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Incident Details</h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description *</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Describe what happened in detail…"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm text-slate-800 placeholder:text-slate-300 focus:ring-4 focus:ring-rose-500/10 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Users className="h-3 w-3" /> People Involved</label>
              <input type="text" placeholder="Names of people involved" value={formData.people_involved}
                onChange={(e) => update('people_involved', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm placeholder:text-slate-300 focus:ring-4 focus:ring-rose-500/10" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Witnesses</label>
              <input type="text" placeholder="Names of witnesses" value={formData.witnesses}
                onChange={(e) => update('witnesses', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm placeholder:text-slate-300 focus:ring-4 focus:ring-rose-500/10" />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Response & Prevention</h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Immediate Action Taken</label>
            <textarea
              rows={3}
              value={formData.immediate_action}
              onChange={(e) => update('immediate_action', e.target.value)}
              placeholder="What actions were taken immediately after the incident?"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm placeholder:text-slate-300 focus:ring-4 focus:ring-rose-500/10 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corrective Action Recommended</label>
            <textarea
              rows={3}
              value={formData.corrective_action}
              onChange={(e) => update('corrective_action', e.target.value)}
              placeholder="What should be done to prevent recurrence?"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm placeholder:text-slate-300 focus:ring-4 focus:ring-rose-500/10 resize-none"
            />
          </div>
        </div>

        {/* ── Photos ── */}
        <div className="bg-white rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-xl border border-slate-100 space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Incident Photos</h3>

          {/* Upload Zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border-2 border-dashed border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 transition-all group"
          >
            {uploading
              ? <Loader2 className="h-8 w-8 text-rose-400 animate-spin" />
              : <ImagePlus className="h-8 w-8 text-slate-300 group-hover:text-rose-400 transition-colors" />
            }
            <div className="text-center">
              <p className="font-black text-slate-500 group-hover:text-rose-500 text-sm transition-colors">
                {uploading ? 'Uploading…' : 'Tap to attach photos'}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">PNG, JPG up to 5MB each</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </button>

          {/* Image Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 animate-in fade-in duration-300">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-2xl overflow-hidden bg-slate-100 aspect-square">
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-[9px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-3xl md:rounded-[40px] p-5 md:p-8 shadow-xl border border-slate-100">
          {formData.severity && formData.incident_type ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-black text-sm text-slate-900">{formData.incident_type}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formData.severity} Severity · {formData.location || 'Location TBD'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-medium">Fill in incident type and severity to continue</p>
          )}

          <button
            type="submit"
            disabled={loading || !formData.incident_type || !formData.severity}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-sm text-white bg-rose-600 shadow-xl shadow-rose-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
          >
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Reporting…</>
              : <><Shield className="h-5 w-5" /> REPORT INCIDENT</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
