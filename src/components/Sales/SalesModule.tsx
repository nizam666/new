import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, FileText, Users, User, TrendingUp, Truck, Clock, Trash2, ArrowRight } from 'lucide-react';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetails } from './InvoiceDetails';
import { MaterialInvestorsForm } from './MaterialInvestorsForm';
import { MaterialInvestorsDetails } from './MaterialInvestorsDetails';
import { CustomerVehicleForm } from '../Customers/CustomerVehicleForm';
import { CustomerVehicleDetails } from '../Customers/CustomerVehicleDetails';
import { CustomerDriverForm } from '../Customers/CustomerDriverForm';
import { CustomerDriverDetails } from '../Customers/CustomerDriverDetails';
import { CustomerDetails } from '../Customers/CustomerDetails';

const TEMP_KEY = 'sribaba_temp_invoices';

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

  // ── Temporary Invoices ──────────────────────────────────────────────────────
  const [tempInvoices, setTempInvoices] = useState<any[]>([]);

  const loadTempInvoices = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(TEMP_KEY) || '[]');
      setTempInvoices(stored);
    } catch {
      setTempInvoices([]);
    }
  }, []);

  useEffect(() => { loadTempInvoices(); }, [loadTempInvoices]);

  const deleteTemp = (id: string) => {
    const updated = tempInvoices.filter(t => t.id !== id);
    localStorage.setItem(TEMP_KEY, JSON.stringify(updated));
    setTempInvoices(updated);
  };

  const loadTemp = (draft: any) => {
    const data = { ...draft.formData, _tempId: draft.id, _payments: draft.payments };
    setEditingInvoice(data);
    deleteTemp(draft.id);
  };

  // Group by vehicle number
  const tempByVehicle: Record<string, any[]> = {};
  tempInvoices.forEach(t => {
    const veh = t.formData?.vehicle_no || '(No Vehicle)';
    if (!tempByVehicle[veh]) tempByVehicle[veh] = [];
    tempByVehicle[veh].push(t);
  });

  // ── Hash navigation ──────────────────────────────────────────────────────────
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

  const handleEditInvestor = (investor: any) => {
    setEditingInvestor(investor);
    setShowInvestorForm(true);
  };

  // ── Sub-form views ───────────────────────────────────────────────────────────
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
          onSaveTemp={loadTempInvoices}
        />
      </div>
    );
  }

  if (showInvestorForm) {
    return (
      <div className="space-y-6">
        <MaterialInvestorsForm
          initialData={editingInvestor}
          onSuccess={() => { setShowInvestorForm(false); setEditingInvestor(null); }}
          onCancel={() => { setShowInvestorForm(false); setEditingInvestor(null); }}
        />
      </div>
    );
  }

  if (showVehicleForm) {
    return (
      <div className="space-y-6">
        <CustomerVehicleForm
          initialData={editingVehicle}
          onSuccess={() => { setShowVehicleForm(false); setEditingVehicle(null); }}
          onCancel={() => { setShowVehicleForm(false); setEditingVehicle(null); }}
        />
      </div>
    );
  }

  if (showDriverForm) {
    return (
      <div className="space-y-6">
        <CustomerDriverForm
          initialData={editingDriver}
          onSuccess={() => { setShowDriverForm(false); setEditingDriver(null); }}
          onCancel={() => { setShowDriverForm(false); setEditingDriver(null); }}
        />
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Sales &amp; Operations</h2>
          <p className="text-xs md:text-sm text-slate-600 mt-1">Manage invoices, customers, and price master</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'investors' ? (
            <button onClick={() => setShowInvestorForm(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
              <Plus className="w-4 h-4" /> Add Rate
            </button>
          ) : activeTab === 'vehicles' ? (
            <button onClick={() => { setEditingVehicle(null); setShowVehicleForm(true); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
              <Plus className="w-4 h-4" /> Register Vehicle
            </button>
          ) : activeTab === 'drivers' ? (
            <button onClick={() => { setEditingDriver(null); setShowDriverForm(true); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#4B6B9E] text-white text-xs md:text-sm font-bold rounded-lg hover:bg-[#3d5782] transition-colors shadow-lg">
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          ) : activeTab === 'invoices' ? (
            <button onClick={() => setShowNewInvoice(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              <Plus className="w-4 h-4" /> New Invoice
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Temporary Drafts Panel ── */}
      {activeTab === 'invoices' && tempInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Temporary Drafts</p>
              <p className="text-[10px] text-amber-600 font-bold">
                {tempInvoices.length} draft{tempInvoices.length > 1 ? 's' : ''} saved locally — click Resume to continue
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(tempByVehicle).map(([vehicleNo, drafts]) => (
              <div key={vehicleNo} className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                {/* Vehicle group header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 border-b border-amber-100">
                  <Truck className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-xs font-black text-amber-800 uppercase tracking-widest">{vehicleNo}</span>
                  <span className="ml-auto text-[10px] font-bold text-amber-500">
                    {drafts.length} draft{drafts.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Draft rows */}
                {drafts.map(draft => (
                  <div key={draft.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-amber-50 last:border-0 hover:bg-amber-50/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">
                        {draft.formData?.customer_name || 'Unknown Customer'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {draft.formData?.invoice_number}
                        {' • '}
                        {new Date(draft.savedAt).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                        {draft.formData?.delivery_location ? ` · ${draft.formData.delivery_location}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => loadTemp(draft)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-all shadow-sm">
                      Resume <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteTemp(draft.id)}
                      title="Delete draft"
                      className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Tab Panel ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex overflow-x-auto">
            {[
              { id: 'invoices', label: 'Invoices', Icon: FileText },
              { id: 'customers', label: 'Customers', Icon: Users },
              { id: 'vehicles', label: 'Vehicles', Icon: Truck },
              { id: 'drivers', label: 'Drivers', Icon: User },
              { id: 'investors', label: 'Rates', Icon: TrendingUp },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`px-4 md:px-6 py-3 md:py-4 font-bold text-[10px] md:text-sm uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === id
                    ? id === 'drivers'
                      ? 'text-[#4B6B9E] border-b-2 border-[#4B6B9E] bg-white'
                      : 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6">
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
              onEdit={(v) => { setEditingVehicle(v); setShowVehicleForm(true); }}
              onAddNew={() => { setEditingVehicle(null); setShowVehicleForm(true); }}
            />
          )}
          {activeTab === 'drivers' && (
            <CustomerDriverDetails
              onEdit={(d) => { setEditingDriver(d); setShowDriverForm(true); }}
              onAddNew={() => { setEditingDriver(null); setShowDriverForm(true); }}
            />
          )}
          {activeTab === 'customers' && <CustomerDetails />}
        </div>
      </div>
    </div>
  );
}
