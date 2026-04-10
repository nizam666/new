import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, User, Phone, Mail, IndianRupee, Calendar, Package, FileText, X, Settings, ArrowLeft, ChevronDown, Check } from 'lucide-react';
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

const GST_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'GST @ 5%', value: 5 },
  { label: 'GST @ 12%', value: 12 },
  { label: 'GST @ 18%', value: 18 },
  { label: 'GST @ 28%', value: 28 },
  { label: 'Exempted', value: 0 }
];

type ActiveTab = 'Pricing' | 'Stock' | 'Other';

interface InvestorData {
  id?: string;
  item_name: string; // Product Name
  item_type: 'Product' | 'Service';
  investor_name: string;
  contact_number: string;
  email: string;
  quantity_mt: string | number;
  rate_per_mt: string | number; // Purchase Price
  sales_price: string | number;
  gst_rate: number;
  hsn: string;
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('Pricing');
  
  const [formData, setFormData] = useState<InvestorData>({
    item_name: initialData?.product_type || initialData?.item_name || '',
    item_type: initialData?.item_type || 'Product',
    investor_name: initialData?.investor_name || '',
    contact_number: initialData?.contact_number || '',
    email: initialData?.email || '',
    quantity_mt: initialData?.quantity_mt || '',
    rate_per_mt: initialData?.rate_per_mt || '',
    sales_price: initialData?.sales_price || '',
    gst_rate: initialData?.gst_rate || 5,
    hsn: initialData?.hsn || '',
    investment_date: initialData?.investment_date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    status: initialData?.status || 'active'
  });

  const handleSubmit = async (e: React.FormEvent, isSaveAndNew = false) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!formData.item_name) {
      toast.error('Item Name is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        product_type: formData.item_name, // Mapping to original schema
        quantity_mt: parseFloat(String(formData.quantity_mt)) || 0,
        rate_per_mt: parseFloat(String(formData.rate_per_mt)) || 0,
        investment_amount: (parseFloat(String(formData.quantity_mt)) || 0) * (parseFloat(String(formData.rate_per_mt)) || 0) * (1 + formData.gst_rate/100),
        updated_by: user.id
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('material_investors')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase
          .from('material_investors')
          .insert([{ ...payload, created_by: user.id }]);

        if (error) throw error;
        toast.success('Saved successfully');
      }

      if (isSaveAndNew) {
        setFormData({
          item_name: '',
          item_type: 'Product',
          investor_name: '',
          contact_number: '',
          email: '',
          quantity_mt: '',
          rate_per_mt: '',
          sales_price: '',
          gst_rate: 5,
          hsn: '',
          investment_date: new Date().toISOString().split('T')[0],
          notes: '',
          status: 'active'
        });
        setActiveTab('Pricing');
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Pricing':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Unit</label>
              <input
                type="text"
                value="MTON"
                disabled
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors"
                placeholder="Ex: PCS"
              />
            </div>

            {/* Sales Price */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Sales Price</label>
              <div className="flex items-center gap-2 border-b-2 border-slate-200 focus-within:border-indigo-600 transition-colors">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  value={formData.sales_price}
                  onChange={(e) => setFormData({ ...formData, sales_price: e.target.value })}
                  className="flex-1 py-2 bg-transparent text-slate-800 font-medium outline-none"
                  placeholder="0"
                />
                <div className="flex items-center gap-1 text-slate-400 text-xs font-bold px-2 py-1 bg-slate-100 rounded">
                  Without Tax <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Purchase Price */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Purchase Price</label>
              <div className="flex items-center gap-2 border-b-2 border-slate-200 focus-within:border-indigo-600 transition-colors">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  value={formData.rate_per_mt}
                  onChange={(e) => setFormData({ ...formData, rate_per_mt: e.target.value })}
                  className="flex-1 py-2 bg-transparent text-slate-800 font-medium outline-none"
                  placeholder="0"
                />
                <div className="flex items-center gap-1 text-slate-400 text-xs font-bold px-2 py-1 bg-slate-100 rounded">
                  Without Tax <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* GST */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">GST</label>
              <div className="relative border-b-2 border-slate-200 focus-within:border-indigo-600 transition-colors">
                <select
                  value={formData.gst_rate}
                  onChange={(e) => setFormData({ ...formData, gst_rate: parseInt(e.target.value) })}
                  className="w-full py-2 bg-transparent text-slate-800 font-medium outline-none appearance-none"
                >
                  {GST_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* HSN */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">HSN</label>
              <div className="flex items-center border-b-2 border-slate-200 focus-within:border-indigo-600 transition-colors">
                <input
                  type="text"
                  value={formData.hsn}
                  onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                  className="flex-1 py-2 bg-transparent text-slate-800 font-medium outline-none"
                  placeholder="Ex: 6704"
                />
                <Settings className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        );

      case 'Stock':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Opening Stock (MT)</label>
              <input
                type="number"
                value={formData.quantity_mt}
                onChange={(e) => setFormData({ ...formData, quantity_mt: e.target.value })}
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">As of Date</label>
              <input
                type="date"
                value={formData.investment_date}
                onChange={(e) => setFormData({ ...formData, investment_date: e.target.value })}
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors"
              />
            </div>
          </div>
        );

      case 'Other':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Investor Name</label>
              <input
                type="text"
                value={formData.investor_name}
                onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors"
                placeholder="Ex: John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Contact Number</label>
              <input
                type="tel"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors"
                placeholder="+91"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full py-2 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent text-slate-800 font-medium outline-none transition-colors resize-none"
                placeholder="Additional details..."
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 md:flex md:items-center md:justify-center p-0 md:p-10">
      <div className="w-full max-w-lg bg-white min-h-screen md:min-h-[auto] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 p-6 flex items-center justify-between sticky top-0 z-20">
          <button onClick={onCancel} className="p-2 text-indigo-800 hover:bg-slate-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-indigo-900 tracking-tight">Create New Item</h1>
          <button className="p-2 text-indigo-800 hover:bg-slate-50 rounded-full transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        {/* Top Input Area */}
        <div className="p-6 pb-0 space-y-6">
          <div>
            <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-2">Item Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="w-full p-0 text-xl font-bold text-slate-800 border-b-2 border-slate-200 focus:border-indigo-600 bg-transparent outline-none transition-colors pb-1"
              placeholder="Ex: Aggregates 20mm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Item Type</label>
            <div className="flex bg-slate-100 p-1 rounded-full w-fit">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, item_type: 'Product' })}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${
                  formData.item_type === 'Product'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {formData.item_type === 'Product' && <Check className="w-4 h-4" />}
                Product
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, item_type: 'Service' })}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${
                  formData.item_type === 'Service'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {formData.item_type === 'Service' && <Check className="w-4 h-4" />}
                Service
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Selection */}
        <div className="px-2 mt-4 flex border-b border-slate-100 overflow-x-auto no-scrollbar">
          {(['Pricing', 'Stock', 'Other'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${
                activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-400'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6 overflow-y-auto no-scrollbar pb-32">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 p-6 flex items-center justify-between gap-4 z-20">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="text-indigo-700 font-black text-sm uppercase tracking-widest flex flex-col items-start leading-tight"
          >
            <span className="text-lg">Save & New</span>
            <span className="text-[10px] text-slate-400 lowercase italic">Create New Item</span>
          </button>
          
          <button
            onClick={(e) => handleSubmit(e)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-3 px-12 py-4 bg-indigo-600 text-white font-black text-lg uppercase tracking-widest rounded-3xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xl shadow-indigo-200 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
