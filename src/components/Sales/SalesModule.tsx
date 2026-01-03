import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, FileText, Users } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetails } from './InvoiceDetails';

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
}

export function SalesModule() {
  useAuth(); // We need the auth context but not the user object directly
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers'>('invoices');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);

  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers();
    }
  }, [activeTab]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (showNewInvoice) {
    return (
      <div className="space-y-6">
        <InvoiceForm
          onSuccess={() => {
            setShowNewInvoice(false);
            window.location.reload();
          }}
          onCancel={() => setShowNewInvoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sales Management</h2>
          <p className="text-slate-600 mt-1">Manage invoices and customers</p>
        </div>
        <button
          onClick={() => setShowNewInvoice(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'invoices'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices
              </div>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'customers'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Customers
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'invoices' && (
            <InvoiceDetails />
          )}

          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <button 
                  onClick={() => (window.location.hash = 'customer-form')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Add New Customer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-600">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">No customers found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                    >
                      <h4 className="font-semibold text-slate-900">{customer.name}</h4>
                      {customer.company && (
                        <p className="text-sm text-slate-600 mt-1">{customer.company}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {customer.email && (
                          <p className="text-xs text-slate-500">{customer.email}</p>
                        )}
                        {customer.phone && (
                          <p className="text-xs text-slate-500">{customer.phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
