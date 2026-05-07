import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, User, Building, MapPin, Phone, CheckSquare, Square, FileText } from 'lucide-react';

interface CustomerData {
  id?: string;
  contact_person: string;
  company_name: string;
  is_gst_registered: boolean;
  tax_id: string; // GST No
  phone: string;
  billing_address: string;
  delivery_address: string;
}

interface CustomerFormProps {
  onSuccess?: () => void;
  initialData?: any;
}

export function CustomerForm({ onSuccess, initialData }: CustomerFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!initialData);
  const [copyBillingToDelivery, setCopyBillingToDelivery] = useState(false);

  const [formData, setFormData] = useState<CustomerData>({
    contact_person: initialData?.contact_person || initialData?.name || '',
    company_name: initialData?.company_name || initialData?.company || '',
    is_gst_registered: initialData ? initialData?.is_gst_registered !== false : true,
    tax_id: initialData?.tax_id || initialData?.gst_number || '',
    phone: initialData?.phone || '',
    billing_address: initialData?.billing_address || initialData?.address || '',
    delivery_address: initialData?.delivery_address || initialData?.address || ''
  });

  const handleAddressCopy = () => {
    const nextCopyState = !copyBillingToDelivery;
    setCopyBillingToDelivery(nextCopyState);
    if (nextCopyState) {
      setFormData(prev => ({
        ...prev,
        delivery_address: prev.billing_address
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Map form data fields onto the database column names
      const payload = {
        name: formData.contact_person, 
        company: formData.company_name,
        is_gst_registered: formData.is_gst_registered,
        gst_number: formData.is_gst_registered ? formData.tax_id : null,
        phone: formData.phone,
        billing_address: formData.billing_address,
        address: formData.billing_address, 
        delivery_address: copyBillingToDelivery ? formData.billing_address : formData.delivery_address
      };

      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        alert('Customer updated successfully!');
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);

        if (error) throw error;
        alert('Customer added successfully!');
      }

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Supabase Error Details:', error);
      alert('Error saving customer: ' + (error?.message || error?.details || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100">
        <div>
          <h3 className="text-2xl font-black text-slate-800">
            {isEditing ? 'Edit Customer Profile' : 'New Customer Profile'}
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-1">Manage essential business and contact details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        
        {/* Core Identity */}
        <div className="md:col-span-2 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100/50">
           <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 sm:mb-6 flex items-center">
             <User className="h-4 w-4 mr-2" /> Basic Identity
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium text-base"
                  placeholder="e.g. Mani"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Mobile Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="pl-11 w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium text-base"
                    placeholder="Enter 10-digit number"
                  />
                </div>
              </div>
           </div>
        </div>

        {/* Business & Tax Details */}
        <div className="md:col-span-2 bg-cyan-50/30 p-4 sm:p-6 rounded-2xl border border-cyan-100/50">
           <h4 className="text-sm font-black uppercase tracking-widest text-cyan-600 mb-4 sm:mb-6 flex items-center">
             <Building className="h-4 w-4 mr-2" /> Business Details
           </h4>
           
           <div className="space-y-6">
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-cyan-200/50 rounded-xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium text-base"
                  placeholder="Business or Trading Name"
                />
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-xl border border-cyan-100 shadow-sm">
                 <div className="flex flex-col md:flex-row md:items-start lg:items-center gap-6">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tax Status</label>
                      <p className="text-xs text-slate-500 mb-3">Select whether the customer is registered for GST.</p>
                      <div className="flex flex-col sm:flex-row items-center gap-3 sm:space-x-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_gst_registered: true })}
                          className={`w-full sm:flex-1 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${formData.is_gst_registered ? 'bg-white text-cyan-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          GST Registered
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_gst_registered: false, tax_id: '' })}
                          className={`w-full sm:flex-1 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${!formData.is_gst_registered ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          URP (Unregistered)
                        </button>
                      </div>
                    </div>

                    {formData.is_gst_registered && (
                      <div className="flex-1 w-full animate-in fade-in slide-in-from-right-4 duration-300">
                        <label className="block text-sm font-bold text-cyan-800 mb-2">
                          GST Number *
                        </label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <FileText className="h-4 w-4 text-cyan-600/50" />
                           </div>
                           <input
                            type="text"
                            value={formData.tax_id}
                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value.toUpperCase() })}
                            required={formData.is_gst_registered}
                            className="pl-10 w-full px-4 py-3 bg-cyan-50/50 border-2 border-cyan-200 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-600 transition-all font-bold text-cyan-900 uppercase placeholder-cyan-300/60 text-base"
                            placeholder="Enter 15-digit GSTIN"
                          />
                        </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Address Information */}
        <div className="md:col-span-2">
           <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 sm:mb-6 flex items-center">
             <MapPin className="h-4 w-4 mr-2" /> Locations
           </h4>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                   Billing Address *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.billing_address}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium resize-none shadow-inner text-base"
                  placeholder="Primary billing address..."
                />
              </div>

              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-bold text-slate-700">
                     Delivery Address *
                  </label>
                  <button 
                    type="button" 
                    onClick={handleAddressCopy}
                    className="flex items-center text-xs font-bold text-cyan-600 hover:text-cyan-800 transition-colors"
                  >
                    {copyBillingToDelivery ? <CheckSquare className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />}
                    Same as Billing
                  </button>
                </div>
                <textarea
                  required
                  rows={4}
                  disabled={copyBillingToDelivery}
                  value={copyBillingToDelivery ? formData.billing_address : formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 transition-all font-medium resize-none flex-1 text-base ${copyBillingToDelivery ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed hidden' : 'bg-white border-slate-200 focus:ring-cyan-500/10 focus:border-cyan-500 shadow-inner'}`}
                  placeholder="Primary site delivery location..."
                />
                {copyBillingToDelivery && (
                  <div className="flex-1 flex items-center justify-center bg-cyan-50/50 border-2 border-dashed border-cyan-200 rounded-xl">
                     <p className="text-sm font-bold text-cyan-600">Using Billing Address</p>
                  </div>
                )}
              </div>
           </div>
        </div>

      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-slate-100 mt-8">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="w-full sm:w-auto px-6 py-3 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all text-center"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center"
        >
          {loading ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              {isEditing ? 'Save Changes' : 'Create Profile'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
