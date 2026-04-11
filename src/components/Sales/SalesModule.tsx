import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, FileText, Users, User, TrendingUp, Truck } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetails } from './InvoiceDetails';
import { MaterialInvestorsForm } from './MaterialInvestorsForm';
import { MaterialInvestorsDetails } from './MaterialInvestorsDetails';
import { CustomerVehicleForm } from '../Customers/CustomerVehicleForm';
import { CustomerVehicleDetails } from '../Customers/CustomerVehicleDetails';
import { CustomerDriverForm } from '../Customers/CustomerDriverForm';
import { CustomerDriverDetails } from '../Customers/CustomerDriverDetails';
import { CustomerDetails } from '../Customers/CustomerDetails';

export function SalesModule() {
  useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'investors' | 'vehicles' | 'drivers'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'material-investors') return 'investors';
    if (hash === 'customers') return 'customers';
    if (hash === 'vehicles') return 'vehicles';
    if (hash === 'drivers') return 'drivers';
    return 'invoices';
  });

  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);

  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<any>(null);
  
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'material-investors') setActiveTab('investors');
      else if (hash === 'customers') setActiveTab('customers');
      else if (hash === 'vehicles') setActiveTab('vehicles');
      else if (hash === 'drivers') setActiveTab('drivers');
      else if (hash === 'sales') setActiveTab('invoices');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    // Customers handled by CustomerDetails component
  }, [activeTab]);

  const handleEditInvestor = (investor: any) => {
    setEditingInvestor(investor);
    setShowInvestorForm(true);
  };

  if (showNewInvoice || editingInvoice || viewingInvoice) {
    return (
      <div className="space-y-6">
        <InvoiceForm
          initialData={editingInvoice || viewingInvoice}
          isReadOnly={!!viewingInvoice}
          onSuccess={() => {
            setShowNewInvoice(false);
            setEditingInvoice(null);
            setViewingInvoice(null);
            window.location.reload();
          }}
          onCancel={() => {
            setShowNewInvoice(false);
            setEditingInvoice(null);
            setViewingInvoice(null);
          }}
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

  if (showDriverForm) {
    return (
      <div className="space-y-6">
        <CustomerDriverForm
          initialData={editingDriver}
          onSuccess={() => {
            setShowDriverForm(false);
            setEditingDriver(null);
          }}
          onCancel={() => {
            setShowDriverForm(false);
            setEditingDriver(null);
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
          ) : activeTab === 'drivers' ? (
            <button
              onClick={() => {
                setEditingDriver(null);
                setShowDriverForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#4B6B9E] text-white rounded-lg hover:bg-[#3d5782] transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Driver
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
              onClick={() => setActiveTab('drivers')}
              className={`px-6 py-4 font-bold text-sm uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'drivers'
                  ? 'text-[#4B6B9E] border-b-2 border-[#4B6B9E] bg-white'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Drivers
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
            <InvoiceDetails 
              onEdit={(inv) => setEditingInvoice(inv)}
              onView={(inv) => setViewingInvoice(inv)}
            />
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

          {activeTab === 'drivers' && (
            <CustomerDriverDetails
              onEdit={(d) => {
                setEditingDriver(d);
                setShowDriverForm(true);
              }}
              onAddNew={() => {
                setEditingDriver(null);
                setShowDriverForm(true);
              }}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerDetails />
          )}
        </div>
      </div>
    </div>
  );
}
