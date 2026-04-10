import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, User, Phone, Mail, IndianRupee, Calendar, Package, FileText, X, Weight, Percent } from 'lucide-react';
import { toast } from 'react-toastify';

const PRODUCT_TYPES = [
  'Aggregate 20mm',
  'Aggregate 40mm',
  'GSB (Granular Sub Base)',
  'M-Sand',
  'P-Sand',
  'Dust',
  'Boulders',
  'Others'
];

const QUALITY_GRADES = [
  'Premium',
  'Standard',
  'Economy',
  'Grade A',
  'Grade B',
  'Others'
];

interface InvestorData {
  id?: string;
  investor_name: string;
  contact_number: string;
  email: string;
  quantity_mt: string | number;
  rate_per_mt: string | number;
  gst_rate: number;
  gst_amount: number;
  total_amount_with_gst: number;
  product_type: string;
  quality_grade: string;
  location: string;
  investment_date: string;
  notes: string;
  status: 'active' | 'inactive' | 'closed';
}

interface MaterialInvestorsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: any;
}

export function MaterialInvestorsForm({ onSuccess, onCancel, initialData }: MaterialInvestorsFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!initialData);

  const [formData, setFormData] = useState<InvestorData>({
    investor_name: initialData?.investor_name || '',
    contact_number: initialData?.contact_number || '',
    email: initialData?.email || '',
    quantity_mt: initialData?.quantity_mt || '',
    rate_per_mt: initialData?.rate_per_mt || '',
    gst_rate: initialData?.gst_rate || 5,
    gst_amount: initialData?.gst_amount || 0,
    total_amount_with_gst: initialData?.total_amount_with_gst || 0,
    product_type: initialData?.product_type || initialData?.material_type || PRODUCT_TYPES[0],
    quality_grade: initialData?.quality_grade || QUALITY_GRADES[0],
    location: initialData?.location || '',
    investment_date: initialData?.investment_date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    status: initialData?.status || 'active'
  });

  // Auto-calculate GST and Total
  useEffect(() => {
    const qty = parseFloat(String(formData.quantity_mt)) || 0;
    const rate = parseFloat(String(formData.rate_per_mt)) || 0;
    const netTotal = qty * rate;
    const gstAmt = (netTotal * formData.gst_rate) / 100;
    const grandTotal = netTotal + gstAmt;

    setFormData(prev => ({
      ...prev,
      gst_amount: gstAmt,
      total_amount_with_gst: grandTotal
    }));
  }, [formData.quantity_mt, formData.rate_per_mt, formData.gst_rate]);

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
        quantity_mt: parseFloat(String(formData.quantity_mt)) || 0,
        rate_per_mt: parseFloat(String(formData.rate_per_mt)) || 0,
        investment_amount: formData.total_amount_with_gst, // Keep legacy field in sync
        updated_by: user.id
      };

      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from('material_investors')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Investor inventory updated successfully!');
      } else {
        const { error } = await supabase
          .from('material_investors')
          .insert([{ ...payload, created_by: user.id }]);

        if (error) throw error;
        toast.success('New material investor record saved!');
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
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Edit Investor Inventory' : 'Add Investor Inventory'}
              </h3>
              <p className="text-sm text-slate-500">Track capital investment with 5% GST logic</p>
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
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Investor Contact Details</h4>
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

          {/* Product Inventory Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="md:col-span-2">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Product & Inventory Tracking</h4>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Product Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Package className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  required
                  className="w-full pl-12 pr-10 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900 appearance-none"
                >
                  {PRODUCT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Quality Grade <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  value={formData.quality_grade}
                  onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
                  required
                  className="w-full pl-12 pr-10 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900 appearance-none"
                >
                  {QUALITY_GRADES.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Quantity (MT) <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Weight className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity_mt}
                  onChange={(e) => setFormData({ ...formData, quantity_mt: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-900"
                  placeholder="Quantity in Metric Tons"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Rate per MT (₹) <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate_per_mt}
                  onChange={(e) => setFormData({ ...formData, rate_per_mt: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-900"
                  placeholder="Rate per Metric Ton"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Storage Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-900"
                placeholder="e.g., Yard A, Section 2"
              />
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
          </div>

          {/* Tax summary visualization */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-blue-600/20" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs font-black uppercase tracking-[0.2em]">Investment Summary</span>
                <div className="flex items-center gap-2">
                  <Percent className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">GST: {formData.gst_rate}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tax Amount (GST)</p>
                  <p className="text-xl font-black text-white">₹ {formData.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Payble</p>
                  <p className="text-3xl font-black text-blue-400">₹ {formData.total_amount_with_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
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
                {isEditing ? 'Update Inventory' : 'Save Investment'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
