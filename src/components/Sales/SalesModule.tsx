import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, FileText, Users, TrendingUp, Mail, Phone } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetails } from './InvoiceDetails';
import { MaterialInvestorsForm } from './MaterialInvestorsForm';
import { MaterialInvestorsDetails } from './MaterialInvestorsDetails';
import { CustomerVehicleForm } from '../Customers/CustomerVehicleForm';
import { CustomerVehicleDetails } from '../Customers/CustomerVehicleDetails';

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
}

export function SalesModule() {
  useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'investors' | 'vehicles'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'material-investors') return 'investors';
    if (hash === 'customers') return 'customers';
    if (hash === 'vehicles') return 'vehicles';
    return 'invoices';
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<any>(null);
  
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'material-investors') setActiveTab('investors');
      else if (hash === 'customers') setActiveTab('customers');
      else if (hash === 'vehicles') setActiveTab('vehicles');
      else if (hash === 'sales') setActiveTab('invoices');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

  const handleEditInvestor = (investor: any) => {
    setEditingInvestor(investor);
    setShowInvestorForm(true);
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

  if (showInvestorForm) {
    return (
      <div className="space-y-6">
        <MaterialInvestorsForm
          initialData={editingInvestor}
          onSuccess={() => {
            setShowInvestorForm(false);
            setEditingInvestor(null);
          }}
          onCancel={() => {
            setShowInvestorForm(false);
            setEditingInvestor(null);
          }}
        />
      </div>
    );
  }

  if (showVehicleForm) {
    return (
      <div className="space-y-6">
        <CustomerVehicleForm
          initialData={editingVehicle}
          onSuccess={() => {
            setShowVehicleForm(false);
            setEditingVehicle(null);
          }}
          onCancel={() => {
            setShowVehicleForm(false);
            setEditingVehicle(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sales & Operations</h2>
          <p className="text-slate-600 mt-1">Manage invoices, customers, and material price master</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'investors' ? (
            <button
              onClick={() => setShowInvestorForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <Plus className="w-5 h-5" />
              Add New Rate
            </button>
          ) : activeTab === 'vehicles' ? (
            <button
              onClick={() => {
                setEditingVehicle(null);
                setShowVehicleForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <Plus className="w-5 h-5" />
              Register Vehicle
            </button>
          ) : activeTab === 'invoices' ? (
            <button
              onClick={() => setShowNewInvoice(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <Plus className="w-5 h-5" />
              New Invoice
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-4 font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'invoices'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices
              </div>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-4 font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'customers'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Customers
              </div>
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-6 py-4 font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'vehicles'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Vehicles
              </div>
            </button>
            <button
              onClick={() => setActiveTab('investors')}
              className={`px-6 py-4 font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'investors'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Price Master
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'invoices' && (
            <InvoiceDetails />
          )}

          {activeTab === 'investors' && (
            <MaterialInvestorsDetails
              onEdit={handleEditInvestor}
              onAddNew={() => setShowInvestorForm(true)}
            />
          )}

          {activeTab === 'vehicles' && (
            <CustomerVehicleDetails
              onEdit={(v) => {
                setEditingVehicle(v);
                setShowVehicleForm(true);
              }}
              onAddNew={() => {
                setEditingVehicle(null);
                setShowVehicleForm(true);
              }}
            />
          )}

          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    className="w-full pl-10 pr-4 py-2 border-2 border-slate-50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
                <button
                  onClick={() => (window.location.hash = 'customer-form')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  title="Add New Customer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 font-bold">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No customers found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="group bg-white border-2 border-slate-50 rounded-2xl p-5 hover:border-blue-500/20 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-300">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{customer.name}</h4>
                      {customer.company && (
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{customer.company}</p>
                      )}
                      <div className="mt-6 space-y-3">
                        {customer.email && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {customer.phone}
                          </div>
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
