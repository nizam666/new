import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText, Plus, Search, Pencil, Trash2, Save, X, ChevronDown,
  Calendar, Hash, RefreshCw, Filter
} from 'lucide-react';
import { toast } from 'react-toastify';

interface SecurityPaper {
  id: string;
  serial_number: string;
  company_name: string;
  paper_type: string;
  issue_date: string;
  used_date: string | null;
  status: 'available' | 'used' | 'damaged' | 'expired';
  linked_invoice: string | null;
  linked_permit_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

const COMPANY_OPTIONS = [
  { value: 'sri_baba_blue_metals', label: 'Sri Baba Blue Metals' },
  { value: 'kvss', label: 'KVSS' },
];

const PAPER_TYPES = [
  'Transport Permit',
  'Royalty Challan',
  'Delivery Challan',
  'Other',
];

const STATUS_OPTIONS: { value: SecurityPaper['status']; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'used', label: 'Used', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'damaged', label: 'Damaged', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'expired', label: 'Expired', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const getStatusBadge = (status: string) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return opt || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
};

interface SecurityPapersFormProps {
  onSuccess?: () => void;
}

export function SecurityPapersForm({ onSuccess }: SecurityPapersFormProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<SecurityPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SecurityPaper | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');

  const [formData, setFormData] = useState({
    serial_number: '',
    company_name: '',
    paper_type: 'Transport Permit',
    issue_date: new Date().toISOString().split('T')[0],
    used_date: '',
    status: 'available' as SecurityPaper['status'],
    linked_invoice: '',
    linked_permit_id: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      serial_number: '',
      company_name: '',
      paper_type: 'Transport Permit',
      issue_date: new Date().toISOString().split('T')[0],
      used_date: '',
      status: 'available',
      linked_invoice: '',
      linked_permit_id: '',
      notes: '',
    });
    setEditingRecord(null);
  };

  const loadRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      console.error('Failed to load security papers:', err);
      toast.error('Failed to load security papers');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.serial_number.trim()) {
      toast.error('Serial number is required');
      return;
    }
    if (!formData.company_name) {
      toast.error('Company is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        serial_number: formData.serial_number.trim().toUpperCase(),
        company_name: formData.company_name,
        paper_type: formData.paper_type,
        issue_date: formData.issue_date || null,
        used_date: formData.used_date || null,
        status: formData.status,
        linked_invoice: formData.linked_invoice.trim() || null,
        linked_permit_id: formData.linked_permit_id.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('security_papers')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Security paper updated successfully');
      } else {
        const { error } = await supabase
          .from('security_papers')
          .insert([{ ...payload, created_by: user.id }]);
        if (error) {
          if (error.code === '23505') {
            toast.error(`Serial number ${payload.serial_number} already exists`);
            return;
          }
          throw error;
        }
        toast.success('Security paper added successfully');
      }

      resetForm();
      setShowForm(false);
      loadRecords();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: SecurityPaper) => {
    setEditingRecord(record);
    setFormData({
      serial_number: record.serial_number,
      company_name: record.company_name,
      paper_type: record.paper_type,
      issue_date: record.issue_date || '',
      used_date: record.used_date || '',
      status: record.status,
      linked_invoice: record.linked_invoice || '',
      linked_permit_id: record.linked_permit_id || '',
      notes: record.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this security paper record?')) return;
    try {
      const { error } = await supabase.from('security_papers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      loadRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.linked_invoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesCompany = filterCompany === 'all' || r.company_name === filterCompany;
    return matchesSearch && matchesStatus && matchesCompany;
  });

  const stats = {
    total: records.length,
    available: records.filter((r) => r.status === 'available').length,
    used: records.filter((r) => r.status === 'used').length,
    damaged: records.filter((r) => r.status === 'damaged').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Security Papers</h2>
          <p className="text-slate-600 mt-1">Track and manage security paper inventory</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Close Form' : 'Add Security Paper'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Available</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.available}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Used</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.used}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Damaged</p>
          <p className="text-2xl font-black text-red-700 mt-1">{stats.damaged}</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-top duration-300">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {editingRecord ? 'Edit Security Paper' : 'Add Security Paper'}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Serial Number */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Serial Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SP-2024-001"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.toUpperCase() })}
                    className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold uppercase tracking-wider text-sm"
                  />
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Company *
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm appearance-none"
                  >
                    <option value="">Select Company</option>
                    {COMPANY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Paper Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Paper Type
                </label>
                <div className="relative">
                  <select
                    value={formData.paper_type}
                    onChange={(e) => setFormData({ ...formData, paper_type: e.target.value })}
                    className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm appearance-none"
                  >
                    {PAPER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Issue Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm"
                  />
                </div>
              </div>

              {/* Used Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Used Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={formData.used_date}
                    onChange={(e) => setFormData({ ...formData, used_date: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as SecurityPaper['status'] })}
                    className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm appearance-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Linked Invoice */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Linked Invoice No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBBM-2024-001"
                  value={formData.linked_invoice}
                  onChange={(e) => setFormData({ ...formData, linked_invoice: e.target.value })}
                  className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm"
                />
              </div>

              {/* Linked Permit ID */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Linked Permit ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. PRM-001"
                  value={formData.linked_permit_id}
                  onChange={(e) => setFormData({ ...formData, linked_permit_id: e.target.value })}
                  className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={1}
                  className="block w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-sm resize-none"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 text-sm"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingRecord ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search serial no., invoice, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-9 pr-8 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium appearance-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-4 pr-8 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium appearance-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              >
                <option value="all">All Companies</option>
                {COMPANY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={loadRecords}
              className="px-3 py-2.5 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-bold text-sm">No security papers found</p>
            <p className="text-xs mt-1">Add your first security paper to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial No.</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Used Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Invoice</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const badge = getStatusBadge(record.status);
                  const companyLabel = COMPANY_OPTIONS.find((c) => c.value === record.company_name)?.label || record.company_name;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-sm text-slate-900 tracking-wide">{record.serial_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-600">{companyLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{record.paper_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{record.issue_date || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{record.used_date || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{record.linked_invoice || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
