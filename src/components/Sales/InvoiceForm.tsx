import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Printer, AlertCircle, X, Search, ChevronDown, Tag, Clock } from 'lucide-react';
import { printThermalInvoice } from '../../utils/thermalPrinter';
import { toast } from 'react-toastify';

interface Customer {
  id: string;
  name: string;
  company: string;
  delivery_address: string;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
}

interface PriceMaster {
  id: string;
  product_type: string;
  sales_price: number;
}

interface LineItem {
  id: string;
  material_name: string;
  material_rate: string;
  empty_weight: string;
  gross_weight: string;
}

interface Payment {
  id: string;
  amount: string;
  payment_mode: string;
  payment_date: string;
  notes: string;
}

interface InvoiceFormProps {
  initialData?: any;
  isReadOnly?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onSaveTemp?: () => void; // callback to refresh temp list in parent
}

export function InvoiceForm({ initialData, isReadOnly, onSuccess, onCancel, onSaveTemp }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [generatingInvoiceNumber, setGeneratingInvoiceNumber] = useState(true);
  const [error, setError] = useState('');
  const shouldPrintRef = useRef(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [priceMaster, setPriceMaster] = useState<PriceMaster[]>([]);
  const [customerPricing, setCustomerPricing] = useState<{ product_name: string; price_per_unit: number; unit: string }[]>([]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    delivery_location: '',
    vehicle_no: '',
    bill_type: 'non-gst' as 'gst' | 'non-gst',
    items: [] as LineItem[]
  });

  const [payments, setPayments] = useState<Payment[]>([
    {
      id: crypto.randomUUID(),
      amount: '',
      payment_mode: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    }
  ]);

  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [globalLocations, setGlobalLocations] = useState<string[]>([]);
  const [updateProfile, setUpdateProfile] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [bata, setBata] = useState(''); // Bata expense — saved to accounts, not invoice

  // Derived state calculations
  const calculateItemNet = (item: LineItem) => {
    const e = parseFloat(item.empty_weight) || 0;
    const g = parseFloat(item.gross_weight) || 0;
    const net = g - e;
    return net > 0 ? parseFloat(net.toFixed(3)) : 0;
  };

  const calculateItemTotal = (item: LineItem) => {
    const net = calculateItemNet(item);
    const rate = parseFloat(item.material_rate) || 0;
    return parseFloat((net * rate).toFixed(2));
  };

  const totalAmount = parseFloat(formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0).toFixed(2));
  const totalNetWeight = parseFloat(formData.items.reduce((sum, item) => sum + calculateItemNet(item), 0).toFixed(3));
  
  const tax_rate = formData.bill_type === 'gst' ? 5 : 0;
  
  // GST Inclusive Math: Total = Subtotal + (Subtotal * 0.05)
  // => Subtotal = Total / 1.05
  const subtotal = tax_rate > 0 
    ? parseFloat((totalAmount / (1 + tax_rate/100)).toFixed(2)) 
    : totalAmount;
  const tax_amount = parseFloat((totalAmount - subtotal).toFixed(2));

  const totalCalculatedPaid = payments.reduce((sum, p) => {
    if (p.payment_mode === 'credit') return sum;
    return sum + (parseFloat(p.amount) || 0);
  }, 0);

  const balanceDue = totalAmount - totalCalculatedPaid;

  useEffect(() => {
    fetchDropdownData();
    fetchRecentLocations(); // Global fetch
    if (initialData) {
      let parsedItems: LineItem[] = [];
      if (initialData.items) {
        try {
          const itemsData = typeof initialData.items === 'string' 
            ? JSON.parse(initialData.items) 
            : initialData.items;
          
          if (Array.isArray(itemsData)) {
            parsedItems = itemsData.map((item: any) => ({
              id: item.id || crypto.randomUUID(),
              material_name: item.material || item.material_name || '',
              material_rate: item.rate?.toString() || item.material_rate?.toString() || '0',
              empty_weight: item.empty_weight?.toString() || '0',
              gross_weight: item.gross_weight?.toString() || item.quantity?.toString() || '0'
            }));
          }
        } catch (e) {
          console.error('Error parsing items:', e);
        }
      }

      // Fallback for legacy single-item invoices
      if (parsedItems.length === 0 && initialData.material_name) {
        parsedItems = [{
          id: crypto.randomUUID(),
          material_name: initialData.material_name,
          material_rate: initialData.material_rate?.toString() || '0',
          empty_weight: initialData.empty_weight?.toString() || '0',
          gross_weight: initialData.gross_weight?.toString() || '0'
        }];
      }

      setFormData({
        invoice_number: initialData.invoice_number || '',
        invoice_date: initialData.invoice_date || new Date().toISOString().split('T')[0],
        customer_name: initialData.customer_name || '',
        delivery_location: initialData.delivery_location || '',
        vehicle_no: initialData.vehicle_no || '',
        bill_type: (initialData.tax_rate > 0) ? 'gst' : 'non-gst',
        items: parsedItems
      });

      // Restore payments from temp draft if available
      const paymentSource = initialData._payments || initialData.payment_history;
      if (paymentSource) {
        try {
          const history = typeof paymentSource === 'string'
            ? JSON.parse(paymentSource)
            : paymentSource;

          if (Array.isArray(history) && history.length > 0) {
            setPayments(history.map((p: any) => ({
              id: p.id || crypto.randomUUID(),
              amount: p.amount?.toString() || '',
              payment_mode: p.payment_mode || 'cash',
              payment_date: p.payment_date || new Date().toISOString().split('T')[0],
              notes: p.notes || ''
            })));
          }
        } catch (e) {
          console.error('Error parsing payment history:', e);
        }
      }

      // Restore bata from temp draft
      if (initialData.bata !== undefined) {
        setBata(initialData.bata?.toString() || '');
      }

      setGeneratingInvoiceNumber(false);

    } else {
      generateInvoiceNumber();
      setFormData(prev => ({
        ...prev,
        items: [{
          id: crypto.randomUUID(),
          material_name: '',
          material_rate: '',
          empty_weight: '',
          gross_weight: ''
        }]
      }));
    }
  }, [initialData]);

  // Sync selected customer ID when customers load or name changes (important for editing)
  useEffect(() => {
    if (formData.customer_name) {
      const customer = customers.find(c => c.name === formData.customer_name);
      if (customer) {
        setSelectedCustomerId(customer.id);
        fetchRecentLocations(formData.customer_name);
        fetchCustomerPricing(customer.id);
      }
    } else {
      setCustomerPricing([]);
    }
  }, [formData.customer_name, customers]);

  const fetchDropdownData = async () => {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, name, company, delivery_address')
        .order('name');
      
      const { data: vehicleData } = await supabase
        .from('customer_vehicles')
        .select('id, vehicle_number')
        .order('vehicle_number');

      const { data: priceData } = await supabase
        .from('material_investors')
        .select('id, product_type, sales_price')
        .eq('status', 'active')
        .order('product_type');

      if (customerData) setCustomers(customerData);
      if (vehicleData) setVehicles(vehicleData);
      if (priceData) setPriceMaster(priceData);
    } catch (err) {
      console.error('Error fetching dropdown references:', err);
    }
  };

  const fetchCustomerPricing = async (customerId: string) => {
    try {
      const { data } = await supabase
        .from('customer_pricing')
        .select('product_name, price_per_unit, unit')
        .eq('customer_id', customerId);
      setCustomerPricing(data || []);
    } catch (err) {
      console.error('Error fetching customer pricing:', err);
      setCustomerPricing([]);
    }
  };

  const generateInvoiceNumber = async (isRetry = false) => {
    try {
      const currentYear = new Date().getFullYear();

      // Sort by invoice_number DESC to get the absolute highest value in the sequence
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `INV-${currentYear}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastInvoice = data[0].invoice_number;
        const parts = lastInvoice.split('-');
        if (parts.length === 3) {
          const lastNumber = parseInt(parts[2]);
          nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
        }
      }

      const invoiceNumber = `INV-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
      if (!isRetry) {
        setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
      }
      return invoiceNumber;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return `INV-${new Date().getFullYear()}-001`; // Fallback
    } finally {
      if (!isRetry) setGeneratingInvoiceNumber(false);
    }
  };

  const addItem = () => {
    const lastItem = formData.items[formData.items.length - 1];
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          material_name: '',
          material_rate: '',
          empty_weight: lastItem ? lastItem.gross_weight : '',
          gross_weight: ''
        }
      ]
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setFormData(prev => {
      const newItems = prev.items.map(item => item.id === id ? { ...item, ...updates } : item);
      
      // Reactive linking: If an item's gross weight changes, update the next item's empty weight
      if (updates.gross_weight !== undefined) {
        const index = newItems.findIndex(item => item.id === id);
        if (index !== -1 && index < newItems.length - 1) {
          newItems[index + 1] = {
            ...newItems[index + 1],
            empty_weight: updates.gross_weight
          };
        }
      }
      
      return { ...prev, items: newItems };
    });
  };

  const addPayment = () => {
    setPayments([...payments, {
      id: crypto.randomUUID(),
      amount: '',
      payment_mode: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    }]);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const fetchRecentLocations = async (customerName?: string) => {
    try {
      let query = supabase
        .from('invoices')
        .select('delivery_location')
        .not('delivery_location', 'is', null)
        .order('created_at', { ascending: false });
      
      if (customerName) {
        query = query.eq('customer_name', customerName);
      }
      
      const { data } = await query.limit(200);
      
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.delivery_location)));
        if (customerName) {
          setRecentLocations(unique.slice(0, 20));
        } else {
          setGlobalLocations(unique.slice(0, 100));
        }
      }
    } catch (err) {
      console.error('Error fetching recent locations:', err);
    }
  };

  const updatePayment = (id: string, field: keyof Payment, value: string) => {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Safety validity checks
    if (!formData.customer_name.trim()) { setError("Customer Name is required."); return; }
    if (formData.items.length === 0) { setError("At least one item is required."); return; }
    
    for (const item of formData.items) {
      if (!item.material_name.trim()) { setError("Material name is required for all items."); return; }
      if (calculateItemNet(item) <= 0) { setError(`Net Weight must be greater than zero for ${item.material_name}.`); return; }
      if (parseFloat(item.material_rate) <= 0) { setError(`Material Rate must be greater than zero for ${item.material_name}.`); return; }
    }

    setLoading(true);

    try {
      // Create detailed items format for print layouts
      const detailedItems = formData.items.map(item => ({
        material: item.material_name,
        quantity: calculateItemNet(item),
        rate: parseFloat(item.material_rate) || 0,
        amount: calculateItemTotal(item),
        empty_weight: parseFloat(item.empty_weight) || 0,
        gross_weight: parseFloat(item.gross_weight) || 0
      }));

      // Calculate final status
      let status = 'unpaid';
      if (totalCalculatedPaid >= totalAmount && totalAmount > 0) {
        status = 'paid';
      } else if (totalCalculatedPaid > 0) {
        status = 'partial';
      }

      const paymentHistory = payments.map(p => ({
        amount: parseFloat(p.amount) || 0,
        payment_mode: p.payment_mode,
        payment_date: p.payment_date,
        notes: p.notes,
        recorded_at: new Date().toISOString()
      })).filter(p => p.amount > 0);

      let currentInvoiceNumber = formData.invoice_number;

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        const firstItem = formData.items[0];
        const materialNames = formData.items.map(i => i.material_name).filter(Boolean).join(', ');

        const payload = {
          invoice_number: currentInvoiceNumber,
          invoice_date: formData.invoice_date,
          customer_id: selectedCustomerId,
          customer_name: formData.customer_name,
          delivery_location: formData.delivery_location || null,
          vehicle_no: formData.vehicle_no || null,
          
          // Primary item details (for legacy columns)
          material_name: materialNames,
          material_rate: parseFloat(firstItem.material_rate) || 0,
          empty_weight: parseFloat(firstItem.empty_weight) || 0,
          gross_weight: parseFloat(firstItem.gross_weight) || 0,
          net_weight: totalNetWeight,
          
          subtotal: subtotal,
          tax_rate: tax_rate,
          tax_amount: tax_amount,
          total_amount: totalAmount,
          
          // Payment logistics:
          amount_paid: totalCalculatedPaid,
          status: status,
          payment_history: paymentHistory.length > 0 ? JSON.stringify(paymentHistory) : '[]',
          payment_mode: paymentHistory.length > 0 ? paymentHistory[0].payment_mode : null,
          payment_date: paymentHistory.length > 0 ? paymentHistory[0].payment_date : null,

          // Backwards compatibility & detailed data:
          due_date: formData.invoice_date,
          items: JSON.stringify(detailedItems)
        };

        const query = initialData?.id 
          ? supabase.from('invoices').update(payload).eq('id', initialData.id)
          : supabase.from('invoices').insert([payload]);

        const { error: insertError } = await query;

        if (insertError) {
          if (insertError.code === '23505' && attempts < maxAttempts - 1) {
            currentInvoiceNumber = await generateInvoiceNumber(true);
            attempts++;
            continue;
          }
          throw insertError;
        }

        break;
      }

      // ── Save Bata as an Accounts Expense ──────────────────────────────────────
      const bataAmount = parseFloat(bata) || 0;
      if (bataAmount > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('accounts').insert([{
          transaction_type: 'expense',
          category: 'misc',
          customer_name: formData.vehicle_no || formData.customer_name,
          amount: 0,
          amount_given: bataAmount,
          reason: `Vehicle Bata — ${formData.vehicle_no || formData.customer_name}`,
          transaction_date: formData.invoice_date,
          payment_method: 'cash',
          status: 'paid',
          notes: `Company: KVSS | Dept: Sales | Item: Bata | Ref: ${currentInvoiceNumber}`,
          created_by: user?.id ?? null
        }]);
      }

      // Update customer profile if requested
      if (updateProfile && selectedCustomerId && formData.delivery_location) {
        const { error: profileError } = await supabase
          .from('customers')
          .update({ delivery_address: formData.delivery_location })
          .eq('id', selectedCustomerId);
        
        if (profileError) console.error('Error updating customer profile:', profileError);
      }

      if (shouldPrintRef.current) {
        printThermalInvoice({
          invoice_number: currentInvoiceNumber,
          customer_name: formData.customer_name,
          vehicle_no: formData.vehicle_no,
          invoice_date: formData.invoice_date,
          due_date: formData.invoice_date,
          items: detailedItems,
          subtotal: subtotal,
          tax_rate: tax_rate,
          tax_amount: tax_amount,
          total_amount: totalAmount,
          status: status,
          amount_paid: totalCalculatedPaid,
          empty_weight: parseFloat(formData.items[0].empty_weight) || 0,
          gross_weight: parseFloat(formData.items[0].gross_weight) || 0,
          net_weight: totalNetWeight,
          delivery_location: formData.delivery_location,
          notes: undefined
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Invoice creation error:', error);
      setError(error.message || 'Unknown database error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemp = () => {
    const draft = {
      id: initialData?._tempId || `temp_${Date.now()}`,
      savedAt: new Date().toISOString(),
      formData,
      payments,
      bata
    };
    try {
      const existing: any[] = JSON.parse(localStorage.getItem('sribaba_temp_invoices') || '[]');
      // Replace if same temp id, else add
      const updated = existing.filter(d => d.id !== draft.id);
      updated.unshift(draft);
      localStorage.setItem('sribaba_temp_invoices', JSON.stringify(updated));
      toast.success(`Draft saved for ${formData.vehicle_no || 'Unknown Vehicle'}`);
      onSaveTemp?.();
    } catch (e) {
      toast.error('Could not save draft to local storage.');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-5xl mx-auto">
      <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 transform -rotate-6">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {isReadOnly ? 'View Dispatch Ticket' : initialData ? 'Update Dispatch Ticket' : 'Weighbridge Dispatch Ticket'}
            </h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Digital Weighbridge System • {formData.invoice_number}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        <fieldset disabled={isReadOnly} className="contents space-y-8">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {/* 1. Header Information */}
          <div className="mb-8">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">1. Document Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-bold text-slate-600"
                  placeholder="Auto-generated"
                  readOnly={generatingInvoiceNumber}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.invoice_date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* 2. Logistics & Route */}
          <div className="mb-8">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">2. Dispatch Routing</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">Customer Name *</label>
                <SearchableSelect
                  disabled={isReadOnly}
                  options={customers.map(c => ({
                    value: c.name || c.company,
                    label: `${c.name} ${c.company ? `(${c.company})` : ''}`,
                    original: c
                  }))}
                  value={formData.customer_name}
                  placeholder="Search customer..."
                  onSelect={(val, original) => {
                    const cust = original as Customer;
                    setFormData({ 
                      ...formData, 
                      customer_name: val,
                      delivery_location: cust?.delivery_address || ''
                    });
                    setSelectedCustomerId(cust?.id || null);
                    fetchRecentLocations(val);
                    setUpdateProfile(false);
                  }}
                />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-700">Delivery Location</label>
                  {formData.delivery_location && !isReadOnly && (
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={updateProfile}
                        onChange={(e) => setUpdateProfile(e.target.checked)}
                        className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">Save as Default</span>
                    </label>
                  )}
                </div>
                <SearchableSelect
                  disabled={isReadOnly}
                  options={[
                    ...(customers.find(c => c.id === selectedCustomerId)?.delivery_address ? [{
                      value: customers.find(c => c.id === selectedCustomerId)!.delivery_address,
                      label: `Primary: ${customers.find(c => c.id === selectedCustomerId)!.delivery_address}`
                    }] : []),
                    ...Array.from(new Set([...recentLocations, ...globalLocations])).map(loc => ({
                      value: loc,
                      label: loc
                    }))
                  ]}
                  value={formData.delivery_location}
                  placeholder="Destination site"
                  onSelect={(val) => setFormData({ ...formData, delivery_location: val })}
                  allowCustom={true}
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">Vehicle No</label>
                <SearchableSelect
                   disabled={isReadOnly}
                   options={vehicles.map(v => ({
                     value: v.vehicle_number,
                     label: v.vehicle_number
                   }))}
                   value={formData.vehicle_no}
                   placeholder="Search vehicle..."
                   onSelect={(val) => setFormData({ ...formData, vehicle_no: val })}
                />
              </div>
            </div>
          </div>          {/* 3. Item Details */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">3. Item Details</h4>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg"
                >
                  <Tag className="w-3.5 h-3.5" />
                  + Add Another Material
                </button>
              )}
            </div>

            <div className="space-y-6">
              {formData.items.map((item) => {
                const itemNet = calculateItemNet(item);
                const itemTotal = calculateItemTotal(item);
                
                return (
                  <div key={item.id} className="relative bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-in slide-in-from-left-2 duration-300">
                    {!isReadOnly && formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-slate-200 text-red-400 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center shadow-sm transition-all z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Material Selection (Left Column) */}
                      <div className="lg:col-span-5 space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Material *</label>
                          <div className="flex flex-wrap gap-2">
                            {priceMaster.map((m) => {
                              const customerRate = customerPricing.find(
                                cp => cp.product_name.toLowerCase() === m.product_type.toLowerCase()
                              );
                              const isSelected = item.material_name === m.product_type;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    const rate = customerRate ? customerRate.price_per_unit : m.sales_price;
                                    updateItem(item.id, { 
                                      material_name: m.product_type,
                                      material_rate: String(rate)
                                    });
                                  }}
                                  className={`relative px-3 py-2 rounded-xl font-bold text-xs transition-all border-2 ${
                                    isSelected
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                      : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                                  }`}
                                >
                                  {m.product_type}
                                </button>
                              );
                            })}
                          </div>

                          {/* Price Source Toggle for this item */}
                          {(() => {
                            const customerRate = customerPricing.find(
                              cp => cp.product_name.toLowerCase() === item.material_name.toLowerCase()
                            );
                            const catalogueRate = priceMaster.find(m => m.product_type === item.material_name)?.sales_price;
                            if (!customerRate || !item.material_name) return null;
                            const usingCustomer = parseFloat(item.material_rate) === customerRate.price_per_unit;
                            return (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateItem(item.id, { material_rate: String(customerRate.price_per_unit) })}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                    usingCustomer
                                      ? 'bg-cyan-600 text-white shadow-sm'
                                      : 'bg-white border border-cyan-200 text-cyan-700'
                                  }`}
                                >
                                  Cust Price: ₹{customerRate.price_per_unit}
                                </button>
                                {catalogueRate !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => updateItem(item.id, { material_rate: String(catalogueRate) })}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                      !usingCustomer
                                        ? 'bg-slate-800 text-white shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    Mkt Price: ₹{catalogueRate}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Weight Data (Middle Column) */}
                      <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Empty (Tons)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={item.empty_weight}
                            onChange={(e) => updateItem(item.id, { empty_weight: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Gross (Tons)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={item.gross_weight}
                            onChange={(e) => updateItem(item.id, { gross_weight: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-sm bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                           <div className="flex items-center justify-between px-3 py-2 bg-cyan-100/50 border border-cyan-200 rounded-lg">
                             <span className="text-[10px] font-black text-cyan-700 uppercase tracking-widest">Net Weight</span>
                             <span className="text-sm font-black text-cyan-900">{itemNet.toFixed(3)} TONS</span>
                           </div>
                        </div>
                      </div>

                      {/* Rate & Total (Right Column) */}
                      <div className="lg:col-span-3 space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Rate (₹/Ton)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.material_rate}
                            onChange={(e) => updateItem(item.id, { material_rate: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-4 focus:ring-indigo-500/10 font-black text-sm text-indigo-600 bg-white"
                          />
                        </div>
                        <div className="p-3 bg-indigo-900 rounded-xl text-white text-right">
                          <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Item Total</p>
                          <p className="text-lg font-black leading-none">₹{itemTotal.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GST Toggle */}
            <div className="mt-8 bg-white p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-700">Billing Compliance</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Taxes are calculated on the aggregate total</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setFormData({ ...formData, bill_type: 'non-gst' })}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    formData.bill_type === 'non-gst'
                      ? 'bg-slate-800 text-white shadow-lg'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Non-GST Bill
                </button>
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setFormData({ ...formData, bill_type: 'gst' })}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    formData.bill_type === 'gst'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  GST Bill (5%)
                </button>
              </div>
            </div>
          </div>

          {/* 5. Payment Details Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">5. Payment Information</h4>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addPayment}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg"
                >
                  + Add Payment Mode
                </button>
              )}
            </div>

            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm font-bold text-slate-400">No payments added yet. Full amount will show as Unpaid.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 border-2 border-slate-50 rounded-2xl overflow-hidden divide-y divide-slate-50">
                  {payments.map((p, index) => (
                    <div key={p.id} className={`p-5 flex flex-col md:flex-row gap-4 items-start ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <div className="w-full md:w-32">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Mode</label>
                        <select
                          value={p.payment_mode}
                          onChange={(e) => updatePayment(p.id, 'payment_mode', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-bold border-2 border-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="card">Card</option>
                          <option value="netbanking">Netbanking</option>
                          <option value="cheque">Cheque</option>
                          <option value="credit">Credit (Uncollected)</option>
                        </select>
                      </div>

                      <div className="w-full md:w-40">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={p.amount}
                          onChange={(e) => updatePayment(p.id, 'amount', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-black border-2 border-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-full md:w-40">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Date</label>
                        <input
                          type="date"
                          value={p.payment_date}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => updatePayment(p.id, 'payment_date', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-bold border-2 border-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Notes (Optional)</label>
                        <input
                          type="text"
                          placeholder="Ref no, cheque no, etc."
                          value={p.notes}
                          onChange={(e) => updatePayment(p.id, 'notes', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-medium border-2 border-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removePayment(p.id)}
                          className="self-end md:self-center p-2 text-red-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Bata Row ── */}
              <div className="flex items-center gap-4 px-5 py-4 bg-amber-50 border-2 border-amber-100 rounded-2xl">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <span className="text-white text-[10px] font-black">₹</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Bata</p>
                    <p className="text-[10px] text-amber-600 font-bold">Vehicle allowance — saved as expense</p>
                  </div>
                </div>
                {!isReadOnly ? (
                  <div className="flex items-center bg-white border-2 border-amber-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 transition-all shadow-sm">
                    <span className="px-3 py-2 text-amber-600 font-black text-sm bg-amber-50 border-r border-amber-200">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={bata}
                      onChange={(e) => setBata(e.target.value)}
                      className="px-3 py-2 w-36 font-black text-sm text-slate-800 outline-none bg-white"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-black text-amber-700">₹{parseFloat(bata || '0').toFixed(2)}</p>
                )}
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-indigo-900 rounded-2xl text-white shadow-xl shadow-indigo-900/10">
                <div className="flex items-center gap-6 divide-x divide-indigo-800">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      {formData.bill_type === 'gst' ? 'Grand Total (Inclusive of 5% GST)' : 'Grand Total'}
                    </p>
                    <p className="text-2xl font-black">₹ {totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1 pl-6">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Collected</p>
                    <p className="text-2xl font-black text-emerald-400">₹ {totalCalculatedPaid.toFixed(2)}</p>
                  </div>
                </div>

                <div className={`px-6 py-2 rounded-xl border-2 flex flex-col items-center ${balanceDue <= 0 ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
                  <p className="text-[10px] font-black uppercase opacity-60">Balance Due</p>
                  <p className={`text-xl font-black ${balanceDue <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ₹ {balanceDue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* Action Bar */}
        <div className="pt-8 border-t border-slate-100 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3.5 text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
          >
            {isReadOnly ? 'Close View' : 'Discard Changes'}
          </button>
          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveTemp}
                className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-amber-600 transition-all hover:shadow-lg hover:shadow-amber-200 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                Save Temporary
              </button>
              <button
                type="submit"
                disabled={loading || generatingInvoiceNumber}
                onClick={() => { shouldPrintRef.current = true; }}
                className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-200 disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                {initialData ? 'Update & Print' : 'Save & Print'}
              </button>
              <button
                type="submit"
                disabled={loading || generatingInvoiceNumber}
                onClick={() => { shouldPrintRef.current = false; }}
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50"
              >
                {initialData ? 'Update Dispatch Ticket' : 'Save Dispatch Ticket'}
              </button>
            </div>
          )}
        </div>

      </form>
    </div>
  );
}

interface SearchableSelectProps {
  options: { value: string; label: string; original?: any }[];
  value: string;
  onSelect: (value: string, original?: any) => void;
  placeholder: string;
  allowCustom?: boolean;
  disabled?: boolean;
}

function SearchableSelect({ options, value, onSelect, placeholder, allowCustom = false, disabled = false }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  // If custom typing is allowed, add the current search as an option if not already there
  const showCustomOption = allowCustom && search.trim() !== '' && !filteredOptions.some(opt => opt.value.toLowerCase() === search.toLowerCase());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value || placeholder;

  return (
    <div className={`relative ${disabled ? 'pointer-events-none' : ''}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border-2 rounded-lg flex items-center justify-between transition-all ${
          disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-75' :
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10 cursor-pointer' : 'border-slate-200 hover:border-slate-300 cursor-pointer'
        } ${!value ? 'text-slate-400' : 'text-slate-800 font-bold'}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2 border-b border-slate-50 bg-slate-50/50">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
               <input
                 autoFocus
                 type="text"
                 placeholder="Search..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-0 outline-none font-medium"
               />
             </div>
          </div>
          <div className="max-h-60 overflow-y-auto pt-1 pb-1">
            {showCustomOption && (
              <div
                onClick={() => {
                  onSelect(search);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between text-indigo-600 font-bold border-b border-slate-50"
              >
                <span>Use new: "{search}"</span>
                <span className="text-[10px] bg-indigo-100 px-2 py-0.5 rounded">CUSTOM</span>
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onSelect(opt.value, opt.original);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    value === opt.value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-bold text-slate-400">No matches found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
