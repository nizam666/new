import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, User, Phone, Mail, IndianRupee, Calendar, Package, FileText, X } from 'lucide-react';
import { toast } from 'react-toastify';

const MATERIAL_TYPES = [
  'Aggregate 20mm',
  'Aggregate 40mm',
  'GSB (Granular Sub Base)',
  'M-Sand',
  'P-Sand',
  'Dust',
  'Boulders',
  'Others'
];

interface InvestorData {
  id?: string;
  investor_name: string;
  contact_number: string;
  email: string;
  investment_amount: string | number;
  material_type: string;
  investment_date: string;
  notes: string;
  status: 'active' | 'inactive' | 'closed';
}

interface MaterialInvestorsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: InvestorData;
}

export function MaterialInvestorsForm({ onSuccess, onCancel, initialData }: MaterialInvestorsFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!initialData);

  const [formData, setFormData] = useState<InvestorData>({
    investor_name: initialData?.investor_name || '',
    contact_number: initialData?.contact_number || '',
    email: initialData?.email || '',
    investment_amount: initialData?.investment_amount || '',
    material_type: initialData?.material_type || 'Aggregate 20mm',
    investment_date: initialData?.investment_date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    status: initialData?.status || 'active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('User session not found');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        investment_amount: parseFloat(String(formData.investment_amount)) || 0,
        updated_by: user.id
      };

      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from('material_investors')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Investor updated successfully!');
      } else {
        const { error } = await supabase
          .from('material_investors')
          .insert([{ ...payload, created_by: user.id }]);

        if (error) throw error;
        toast.success('Material investor added successfully!');
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error saving investor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Edit Material Investor' : 'Add New Material Investor'}
              </h3>
              <p className="text-sm text-slate-500">Capital investment & material tracking</p>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-8 space-y-8">
          {/* Investor Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Investor Basic Details</h4>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Investor Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={formData.investor_name}
                  onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
                  placeholder="Full name of the investor"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Contact Number <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
                  placeholder="+91 00000 00000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
                  placeholder="investor@example.com"
                />
              </div>
            </div>
          </div>

          {/* Investment Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="md:col-span-2">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Investment & Material</h4>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Investment Amount (₹) <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.investment_amount}
                  onChange={(e) => setFormData({ ...formData, investment_amount: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-900"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Material Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Package className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  value={formData.material_type}
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                  required
                  className="w-full pl-12 pr-10 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900 appearance-none"
                >
                  {MATERIAL_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Investment Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="date"
                  value={formData.investment_date}
                  onChange={(e) => setFormData({ ...formData, investment_date: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Investment Status</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full pl-12 pr-10 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900 appearance-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed / Settled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Additional Notes</label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
              placeholder="Partner details, return terms, or other specific information..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-all active:scale-[0.98]"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {isEditing ? 'Update Investor' : 'Add Investor'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
