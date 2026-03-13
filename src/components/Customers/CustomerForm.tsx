import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, User, Building, MapPin, Mail, Phone, Truck } from 'lucide-react';

const customerTypes = [
  'Retail',
  'Wholesale',
  'Contractor',
  'Government',
  'Reseller',
  'Other'
];

const paymentTerms = [
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 60',
  'Due on Receipt',
  'Custom'
];

interface CustomerData {
  id?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_id: string;
  customer_type: string;
  payment_terms: string;
  credit_limit: number | string;
  notes: string;
}

interface CustomerFormProps {
  onSuccess?: () => void;
  initialData?: CustomerData;
}

export function CustomerForm({ onSuccess, initialData }: CustomerFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!initialData);

  const [formData, setFormData] = useState({
    company_name: initialData?.company_name || '',
    contact_person: initialData?.contact_person || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    postal_code: initialData?.postal_code || '',
    country: initialData?.country || 'India',
    tax_id: initialData?.tax_id || '',
    customer_type: initialData?.customer_type || 'Retail',
    payment_terms: initialData?.payment_terms || 'Net 30',
    credit_limit: initialData?.credit_limit || '',
    notes: initialData?.notes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const customerData = {
        ...formData,
        updated_by: user.id,
        credit_limit: parseFloat(String(formData.credit_limit)) || 0,
      };

      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', initialData.id);

        if (error) throw error;
        alert('Customer updated successfully!');
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{ ...customerData, created_by: user.id }]);

        if (error) throw error;
        alert('Customer added successfully!');
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      alert('Error saving customer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-2">
          <h3 className="text-lg font-medium text-slate-800 mb-4">
            {isEditing ? 'Edit Customer' : 'Add New Customer'}
          </h3>
        </div>

        {/* Company Information */}
        <div className="md:col-span-2 border-b border-slate-200 pb-4">
          <h4 className="text-md font-medium text-slate-700 flex items-center">
            <Building className="h-5 w-5 mr-2 text-cyan-600" />
            Company Information
          </h4>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Enter company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer Type
          </label>
          <select
            value={formData.customer_type}
            onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            {customerTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tax ID / GSTIN
          </label>
          <input
            type="text"
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Enter tax ID or GSTIN"
          />
        </div>

        {/* Contact Information */}
        <div className="md:col-span-2 border-b border-slate-200 pb-4 mt-6">
          <h4 className="text-md font-medium text-slate-700 flex items-center">
            <User className="h-5 w-5 mr-2 text-cyan-600" />
            Contact Information
          </h4>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contact Person *
          </label>
          <input
            type="text"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="email@company.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Phone *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>

        {/* Address */}
        <div className="md:col-span-2 border-b border-slate-200 pb-4 mt-6">
          <h4 className="text-md font-medium text-slate-700 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-cyan-600" />
            Address
          </h4>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Street Address
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="123 Business Street"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            City
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="City"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            State
          </label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="State"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Postal Code
          </label>
          <input
            type="text"
            value={formData.postal_code}
            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Postal code"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Country
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Country"
          />
        </div>

        {/* Payment Terms */}
        <div className="md:col-span-2 border-b border-slate-200 pb-4 mt-6">
          <h4 className="text-md font-medium text-slate-700 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-cyan-600" />
            Payment & Credit
          </h4>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Payment Terms
          </label>
          <select
            value={formData.payment_terms}
            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            {paymentTerms.map(term => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Credit Limit (₹)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.credit_limit}
            onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="Any additional notes about this customer..."
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 flex items-center"
        >
          {loading ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Customer' : 'Add Customer'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
