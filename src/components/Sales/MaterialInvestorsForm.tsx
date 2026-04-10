import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, ArrowLeft, ChevronDown, Package, IndianRupee, Weight, Info, Calendar, User, Phone } from 'lucide-react';
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
  { label: 'GST @ 5%', value: 5 }
];

interface InvestorData {
  id?: string;
  product_type: string;
  investor_name: string;
  contact_number: string;
  email: string;
  quantity_mt: string | number;
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
  
  const [formData, setFormData] = useState<InvestorData>({
    product_type: initialData?.product_type || PRODUCT_TYPES[0],
    investor_name: initialData?.investor_name || '',
    contact_number: initialData?.contact_number || '',
    email: initialData?.email || '',
    quantity_mt: initialData?.quantity_mt || '',
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

    if (!formData.product_type) {
      toast.error('Product Type is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        quantity_mt: parseFloat(String(formData.quantity_mt)) || 0,
        investment_amount: (parseFloat(String(formData.quantity_mt)) || 0) * (parseFloat(String(formData.sales_price)) || 0) * (1 + formData.gst_rate/100),
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
          product_type: PRODUCT_TYPES[0],
          investor_name: '',
          contact_number: '',
          email: '',
          quantity_mt: '',
          sales_price: '',
          gst_rate: 5,
          hsn: '',
          investment_date: new Date().toISOString().split('T')[0],
          notes: '',
          status: 'active'
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateGrandTotal = () => {
    const qty = parseFloat(String(formData.quantity_mt)) || 0;
    const rate = parseFloat(String(formData.sales_price)) || 0;
    const net = qty * rate;
    const tax = (net * formData.gst_rate) / 100;
    return net + tax;
  };

  return (
    <div className="min-h-[90vh] bg-slate-100/30 flex flex-col p-4 md:p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={onCancel} 
              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-100/50 hover:bg-indigo-50 transition-all active:scale-95 border border-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-indigo-950 tracking-tight">Material Inventory</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Add Product & Investment Details</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
              <button className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-lg hover:text-indigo-600 transition-all border border-slate-100">
                <Settings className="w-5 h-5" />
              </button>
          </div>
        </div>

        {/* Dashboard Form Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <div className="lg:col-span-8 space-y-8">
            {/* Product Header Card */}
            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 transition-all group-within:bg-indigo-600" />
              <div className="relative z-10">
                <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 font-black">Select Product / Material <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={formData.product_type}
                    onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                    className="w-full p-0 text-4xl font-black text-indigo-950 bg-transparent outline-none appearance-none cursor-pointer pr-10"
                  >
                    {PRODUCT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 text-indigo-200 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Main Information Sections */}
            <div className="grid grid-cols-1 gap-8">
              {/* Pricing & GST Section */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-white">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-black text-indigo-950 tracking-tight">Pricing & Taxes</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Sales Price</label>
                    <div className="flex items-center gap-3 border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all group">
                      <span className="text-xl font-bold text-slate-400 group-focus-within:text-indigo-600 transition-colors">₹</span>
                      <input
                        type="number"
                        value={formData.sales_price}
                        onChange={(e) => setFormData({ ...formData, sales_price: e.target.value })}
                        className="flex-1 py-3 bg-transparent text-xl font-bold text-slate-800 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">GST Rate (Standard)</label>
                    <div className="relative border-b-2 border-slate-100 bg-slate-50/50 px-2 rounded-t-lg">
                      <select
                        value={formData.gst_rate}
                        disabled
                        className="w-full py-3 bg-transparent text-lg font-bold text-slate-500 outline-none appearance-none cursor-not-allowed"
                      >
                        {GST_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Unit</label>
                    <div className="flex items-center border-b-2 border-slate-100">
                      <input
                        type="text"
                        value="MTON (Metric Tons)"
                        disabled
                        className="flex-1 py-3 bg-transparent text-lg font-bold text-slate-400 outline-none"
                      />
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">HSN Code</label>
                    <div className="flex items-center border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all">
                      <input
                        type="text"
                        value={formData.hsn}
                        onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                        className="flex-1 py-3 bg-transparent text-lg font-bold text-slate-800 outline-none"
                        placeholder="Ex: 2517"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Details Section */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-white">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Weight className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-black text-indigo-950 tracking-tight">Inventory & Stock</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Opening Stock Quantity</label>
                    <div className="flex items-center gap-3 border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all group">
                      <input
                        type="number"
                        value={formData.quantity_mt}
                        onChange={(e) => setFormData({ ...formData, quantity_mt: e.target.value })}
                        className="flex-1 py-3 bg-transparent text-xl font-bold text-slate-800 outline-none"
                        placeholder="0.00"
                      />
                      <span className="text-lg font-black text-indigo-400">MT</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">As of Date</label>
                    <div className="flex items-center border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all">
                      <input
                        type="date"
                        value={formData.investment_date}
                        onChange={(e) => setFormData({ ...formData, investment_date: e.target.value })}
                        className="flex-1 py-3 bg-transparent text-lg font-bold text-slate-800 outline-none"
                      />
                      <Calendar className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Investor Details Section */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-white">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-xl font-black text-indigo-950 tracking-tight">Partner / Investor Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Investor Name</label>
                    <input
                      type="text"
                      value={formData.investor_name}
                      onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                      className="w-full py-3 border-b-2 border-slate-100 focus:border-indigo-600 bg-transparent text-lg font-bold text-slate-800 outline-none transition-all"
                      placeholder="Name of the capital provider"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Investor Phone</label>
                    <div className="flex items-center border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all">
                      <input
                        type="tel"
                        value={formData.contact_number}
                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                        className="flex-1 py-3 bg-transparent text-lg font-bold text-slate-800 outline-none"
                        placeholder="+91"
                      />
                      <Phone className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Additional Remarks</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full py-4 border-2 border-slate-50 bg-slate-50/50 rounded-2xl focus:border-indigo-600 focus:bg-white text-lg font-medium text-slate-800 outline-none transition-all resize-none px-4 shadow-inner"
                      placeholder="Specify return terms or material grade specifics..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
            {/* Asset Summary Card */}
            <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-900/30 relative overflow-hidden group">
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl transition-all group-hover:scale-110" />
              
              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between opacity-60">
                  <span className="text-[10px] font-black uppercase tracking-widest">Inventory Asset Audit</span>
                  <Info className="w-4 h-4 cursor-pointer" />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest">Total Valuation</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tighter">₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
                  </div>
                  <p className="text-[10px] font-bold text-indigo-400 bg-indigo-950/40 w-fit px-3 py-1 rounded-full border border-indigo-500/20">Includes 5% Standard GST</p>
                </div>

                <div className="pt-8 border-t border-indigo-500/30 space-y-4">
                  <div className="flex justify-between items-center bg-indigo-950/40 p-5 rounded-2xl border border-indigo-800/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                        <Weight className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Net Quantity</span>
                    </div>
                    <span className="text-xl font-black">{parseFloat(String(formData.quantity_mt)) || 0} MT</span>
                  </div>

                  <div className="flex justify-between items-center bg-indigo-950/40 p-5 rounded-2xl border border-indigo-800/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg">
                        <IndianRupee className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Market Rate</span>
                    </div>
                    <span className="text-xl font-black">₹{parseFloat(String(formData.sales_price)) || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/50 border border-white flex flex-col gap-3">
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={loading}
                className="w-full py-6 bg-indigo-600 text-white font-black text-lg uppercase tracking-widest rounded-3xl hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-4 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-6 h-6 transition-transform group-hover:scale-125" />
                    Save Product
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="w-full py-5 bg-slate-50 text-indigo-700 font-black text-sm uppercase tracking-widest rounded-3xl hover:bg-indigo-50 transition-all border border-slate-100 flex items-center justify-center gap-3"
              >
                Save & Create Another
              </button>
              
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Save(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
