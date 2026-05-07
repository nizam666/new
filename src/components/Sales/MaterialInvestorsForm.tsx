import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, ArrowLeft, ChevronDown, Package, IndianRupee, Info } from 'lucide-react';
import { toast } from 'react-toastify';

const PRODUCT_TYPES = [
  'Aggregate 20mm',
  'Aggregate 40mm',
  'Aggregate 12mm',
  'Aggregate 6mm',
  'GSB (Granular Sub Base)',
  'M-Sand',
  'P-Sand',
  'Dust',
  'All mix',
  'Wet mix',
  'Q-Boulders',
  'S-boulders'
];

const GST_OPTIONS = [
  { label: 'GST @ 5%', value: 5 }
];

interface InvestorData {
  id?: string;
  product_type: string;
  sales_price: string | number;
  is_tax_inclusive: boolean;
  gst_rate: number;
  hsn: string;
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
    sales_price: initialData?.sales_price || '',
    is_tax_inclusive: initialData?.is_tax_inclusive || false, // Default to Excluding GST
    gst_rate: initialData?.gst_rate || 5,
    hsn: initialData?.hsn || '',
    status: initialData?.status || 'active'
  });

  const calculateRates = () => {
    const enteredPrice = parseFloat(String(formData.sales_price)) || 0;
    const gstRate = formData.gst_rate / 100;

    let basePrice = 0;
    let totalPrice = 0;

    if (formData.is_tax_inclusive) {
      // Entered Price is the Total (Inclusive)
      totalPrice = enteredPrice;
      basePrice = enteredPrice / (1 + gstRate);
    } else {
      // Entered Price is the Base (Exclusive)
      basePrice = enteredPrice;
      totalPrice = enteredPrice * (1 + gstRate);
    }

    return { basePrice, totalPrice };
  };

  const handleSubmit = async (e: React.FormEvent, isSaveAndNew = false) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!formData.product_type) {
      toast.error('Product Type is required');
      return;
    }

    const { totalPrice, basePrice } = calculateRates();
    console.log('Final Rates calculated:', { totalPrice, basePrice });

    setLoading(true);
    try {
      const payload = {
        product_type: formData.product_type,
        material_type: formData.product_type, // Sync legacy column
        sales_price: parseFloat(String(formData.sales_price)) || 0,
        is_tax_inclusive: formData.is_tax_inclusive,
        gst_rate: formData.gst_rate,
        hsn: formData.hsn,
        investment_amount: totalPrice, // Total inclusive for legacy column
        status: formData.status,
        updated_by: user.id
      };

      console.log('Submitting payload to material_investors:', payload);

      if (initialData?.id) {
        const { error } = await supabase
          .from('material_investors')
          .update(payload)
          .eq('id', initialData.id);

        if (error) {
          console.error('Supabase Update Error:', error);
          throw error;
        }
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase
          .from('material_investors')
          .insert([{ ...payload, created_by: user.id }]);

        if (error) {
          console.error('Supabase Insert Error:', error);
          throw error;
        }
        toast.success('Saved successfully');
      }

      if (isSaveAndNew) {
        setFormData({
          product_type: PRODUCT_TYPES[0],
          sales_price: '',
          is_tax_inclusive: false,
          gst_rate: 5,
          hsn: '',
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

  const rates = calculateRates();

  return (
    <div className="min-h-[90vh] bg-slate-100/30 flex flex-col p-3 md:p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 md:gap-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={onCancel}
              className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-100/50 hover:bg-indigo-50 transition-all active:scale-95 border border-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-indigo-950 tracking-tight">Price Master</h1>
              <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Configure Product Rates & Taxes</p>
            </div>
          </div>
        </div>

        {/* Dashboard Form Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <div className="lg:col-span-8 space-y-8">
            {/* Product Header Card */}
            <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-indigo-50 rounded-bl-full -mr-12 md:-mr-16 -mt-12 md:-mt-16 transition-all group-within:bg-indigo-600" />
              <div className="relative z-10">
                <label className="block text-[10px] md:text-xs font-black text-indigo-500 uppercase tracking-widest mb-2 md:mb-4">Product / Material <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={formData.product_type}
                    onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                    className="w-full p-0 text-2xl md:text-4xl font-black text-indigo-950 bg-transparent outline-none appearance-none cursor-pointer pr-10"
                  >
                    {PRODUCT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 text-indigo-200 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Pricing & GST Section */}
            <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/50 border border-white">
              <div className="flex items-center gap-3 mb-6 md:mb-8 border-b border-slate-50 pb-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="text-lg md:text-xl font-black text-indigo-950 tracking-tight">Pricing & Taxes</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {/* Sales Rate Input with Inclusive/Exclusive Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase tracking-widest">Sales Rate</label>

                    {/* Tax Inclusive Toggle Buttons */}
                    <div className="flex bg-slate-100 p-1 rounded-full scale-90 sm:scale-100 origin-left sm:origin-right self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_tax_inclusive: false })}
                        className={`px-3 md:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!formData.is_tax_inclusive
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        Excluding GST
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_tax_inclusive: true })}
                        className={`px-3 md:px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${formData.is_tax_inclusive
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        Including GST
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-b-2 border-slate-100 focus-within:border-indigo-600 transition-all group">
                    <span className="text-lg md:text-xl font-bold text-slate-400 group-focus-within:text-indigo-600 transition-colors">₹</span>
                    <input
                      type="number"
                      value={formData.sales_price}
                      onChange={(e) => setFormData({ ...formData, sales_price: e.target.value })}
                      className="flex-1 py-3 bg-transparent text-lg md:text-xl font-bold text-slate-800 outline-none"
                      placeholder="0.00"
                    />
                    <div className="hidden sm:flex items-center gap-2 text-indigo-600 text-[10px] font-black uppercase tracking-tight px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                      {formData.is_tax_inclusive ? 'Tax Inclusive' : 'Tax Exclusive'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">GST Rate (Fixed)</label>
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
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Standard Unit</label>
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
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">HSN / SAC Code</label>
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
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
            {/* Unit Price Audit Card */}
            <div className="bg-indigo-900 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl shadow-indigo-900/30 relative overflow-hidden group">
              <div className="absolute -bottom-20 -right-20 w-48 md:w-64 h-48 md:h-64 bg-indigo-500/20 rounded-full blur-3xl transition-all group-hover:scale-110" />

              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between opacity-60">
                  <span className="text-[10px] font-black uppercase tracking-widest">Pricing Audit</span>
                  <Info className="w-4 h-4 cursor-pointer" />
                </div>

                  <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] md:text-sm font-bold text-indigo-300 uppercase tracking-widest">Bill Amount (With Tax)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl md:text-5xl font-black tracking-tighter">₹{rates.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs md:text-sm font-bold text-indigo-400 uppercase">/ MT</span>
                    </div>
                  </div>

                  <div className="space-y-1 opacity-80 pt-4 border-t border-indigo-800">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Tax Breakdown (5%)</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-indigo-400">Net Rate:</span>
                      <span className="font-black text-white">₹{rates.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-indigo-400">GST Amount:</span>
                      <span className="font-black text-emerald-400">+ ₹{(rates.totalPrice - rates.basePrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/50 border border-white flex flex-col gap-3">
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={loading}
                className="w-full py-4 md:py-6 bg-indigo-600 text-white font-black text-sm md:text-lg uppercase tracking-widest rounded-xl md:rounded-3xl hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-4 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:scale-125" />
                    Save Pricing
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="w-full py-4 bg-slate-50 text-indigo-700 font-black text-[10px] md:text-sm uppercase tracking-widest rounded-xl md:rounded-3xl hover:bg-indigo-50 transition-all border border-slate-100 flex items-center justify-center gap-3"
              >
                Save & Add Next
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
