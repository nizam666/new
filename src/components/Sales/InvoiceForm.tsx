import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Printer, AlertCircle, X, Search, ChevronDown } from 'lucide-react';
import { printThermalInvoice } from '../../utils/thermalPrinter';

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

interface Payment {
  id: string;
  amount: string;
  payment_mode: string;
  payment_date: string;
  notes: string;
}

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [generatingInvoiceNumber, setGeneratingInvoiceNumber] = useState(true);
  const [error, setError] = useState('');
  const shouldPrintRef = useRef(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [priceMaster, setPriceMaster] = useState<PriceMaster[]>([]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    delivery_location: '',
    vehicle_no: '',
    material_name: '',
    empty_weight: '',
    gross_weight: '',
    material_rate: ''
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
  const [updateProfile, setUpdateProfile] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Derived state calculations
  const emptyVal = parseFloat(formData.empty_weight) || 0;
  const grossVal = parseFloat(formData.gross_weight) || 0;
  const rateVal = parseFloat(formData.material_rate) || 0;

  const rawNet = grossVal - emptyVal;
  const netWeight = rawNet > 0 ? parseFloat(rawNet.toFixed(3)) : 0;
  const totalAmount = parseFloat((netWeight * rateVal).toFixed(2));

  const totalCalculatedPaid = payments.reduce((sum, p) => {
    // We only count actual monetary collection towards 'amount_paid'
    // 'Credit' entries are recorded in history but don't count as cash collected
    if (p.payment_mode === 'credit') return sum;
    return sum + (parseFloat(p.amount) || 0);
  }, 0);

  const balanceDue = totalAmount - totalCalculatedPaid;

  useEffect(() => {
    generateInvoiceNumber();
    fetchDropdownData();
  }, []);

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

  const fetchRecentLocations = async (customerName: string) => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('delivery_location')
        .eq('customer_name', customerName)
        .not('delivery_location', 'is', null)
        .order('created_at', { ascending: false });
      
      if (data) {
        // Get unique locations
        const unique = Array.from(new Set(data.map(d => d.delivery_location)));
        setRecentLocations(unique.slice(0, 10)); // Top 10 recent
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
    if (!formData.material_name.trim()) { setError("Material is required."); return; }
    if (netWeight <= 0) { setError("Net Weight must be greater than zero. Check Gross/Empty weights."); return; }
    if (rateVal <= 0) { setError("Material Rate must be greater than zero."); return; }

    setLoading(true);

    try {
      // Create a backwards-compatible item JSON for print layouts
      const backupItemFormat = [{
        material: formData.material_name,
        quantity: netWeight,
        rate: rateVal,
        amount: totalAmount
      }];

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
        const { error: insertError } = await supabase
          .from('invoices')
          .insert([{
            invoice_number: currentInvoiceNumber,
            invoice_date: formData.invoice_date,
            customer_name: formData.customer_name,
            delivery_location: formData.delivery_location || null,
            vehicle_no: formData.vehicle_no || null,
            material_name: formData.material_name,
            material_rate: rateVal,
            empty_weight: emptyVal,
            gross_weight: grossVal,
            net_weight: netWeight,
            total_amount: totalAmount,
            subtotal: totalAmount,
            
            // Payment logistics:
            amount_paid: totalCalculatedPaid,
            status: status,
            payment_history: paymentHistory.length > 0 ? JSON.stringify(paymentHistory) : '[]',
            payment_mode: paymentHistory.length > 0 ? paymentHistory[0].payment_mode : null,
            payment_date: paymentHistory.length > 0 ? paymentHistory[0].payment_date : null,

            // Backwards compatibility:
            due_date: formData.invoice_date,
            items: JSON.stringify(backupItemFormat)
          }]);

        if (insertError) {
          // Check for unique violation (PostgreSQL code 23505)
          if (insertError.code === '23505' && attempts < maxAttempts - 1) {
            console.log(`Invoice number collision detected for ${currentInvoiceNumber}. Retrying with fresh number...`);
            currentInvoiceNumber = await generateInvoiceNumber(true);
            attempts++;
            continue;
          }
          throw insertError;
        }

        break; // Success!
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
          invoice_date: formData.invoice_date,
          due_date: formData.invoice_date,
          items: backupItemFormat,
          subtotal: totalAmount,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: totalAmount,
          status: status,
          amount_paid: totalCalculatedPaid,
          notes: `Vehicle: ${formData.vehicle_no}\nDestination: ${formData.delivery_location}`
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

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-wide">Dispatch Ticket / Invoice</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-900 font-bold"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-100 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* 1. Header Information */}
      <div>
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
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* 2. Logistics & Route */}
      <div>
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">2. Dispatch Routing</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">Customer Name *</label>
            <SearchableSelect
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
              {formData.delivery_location && (
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
              options={[
                // Fixed default from profile
                ...(customers.find(c => c.id === selectedCustomerId)?.delivery_address ? [{
                  value: customers.find(c => c.id === selectedCustomerId)!.delivery_address,
                  label: `Primary: ${customers.find(c => c.id === selectedCustomerId)!.delivery_address}`
                }] : []),
                // History
                ...recentLocations.map(loc => ({
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
      </div>

      {/* 3. Weight Mathematics */}
      <div>
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">3. Weighbridge Data</h4>
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Empty / Tare Weight (Tons)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={formData.empty_weight}
                onChange={(e) => setFormData({ ...formData, empty_weight: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Gross Weight (Tons)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={formData.gross_weight}
                onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-cyan-700 mb-2">Net Load Target (Tons)</label>
              <div className="w-full px-4 py-2.5 bg-cyan-50 border-2 border-cyan-200 rounded-lg flex items-center justify-between">
                <span className="font-bold text-cyan-900">{netWeight.toFixed(3)}</span>
                <span className="text-xs font-black text-cyan-600 tracking-wider">TONS</span>
              </div>
              <p className="text-[10px] text-cyan-600 mt-1.5 font-bold">Auto-Calculated (Gross - Empty)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Billing Metrics */}
      <div>
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">4. Valuation</h4>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Select Material *</label>
            <div className="flex flex-wrap gap-2">
              {priceMaster.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFormData({ 
                    ...formData, 
                    material_name: m.product_type,
                    material_rate: String(m.sales_price)
                  })}
                  className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                    formData.material_name === m.product_type
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                      : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                  }`}
                >
                  {m.product_type}
                </button>
              ))}
              {priceMaster.length === 0 && (
                <p className="text-xs text-slate-400 font-medium">No materials found in Price Master.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Selected Material</label>
              <div className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-500 font-bold truncate">
                {formData.material_name || 'None selected'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Material Rate (₹ per Ton) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={formData.material_rate}
                onChange={(e) => setFormData({ ...formData, material_rate: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-2">Final Amount (₹)</label>
              <div className="w-full px-4 py-2.5 bg-indigo-50 border-2 border-indigo-200 rounded-lg flex items-center justify-between">
                <span className="font-black text-indigo-700 text-lg">₹ {totalAmount.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-indigo-500 mt-1.5 font-bold">Auto-Calculated (Net × Rate)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Payment Details Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">5. Payment Information</h4>
          <button
            type="button"
            onClick={addPayment}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg"
          >
            + Add Payment Mode
          </button>
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

                  <button
                    type="button"
                    onClick={() => removePayment(p.id)}
                    className="self-end md:self-center p-2 text-red-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Payment Summary Banner */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-indigo-900 rounded-2xl text-white shadow-xl shadow-indigo-900/10">
            <div className="flex items-center gap-6 divide-x divide-indigo-800">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Grand Total</p>
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
      <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={() => { shouldPrintRef.current = true; }}
          disabled={loading || generatingInvoiceNumber}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-lg"
        >
          <Printer className="w-4 h-4" />
          Save & Print Ticket
        </button>
        <button
          type="submit"
          onClick={() => { shouldPrintRef.current = false; }}
          disabled={loading || generatingInvoiceNumber}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
        >
          {loading ? 'Processing...' : 'Save Dispatch Ticket'}
        </button>
      </div>
    </form>
  );
}

interface SearchableSelectProps {
  options: { value: string; label: string; original?: any }[];
  value: string;
  onSelect: (value: string, original?: any) => void;
  placeholder: string;
  allowCustom?: boolean;
}

function SearchableSelect({ options, value, onSelect, placeholder, allowCustom = false }: SearchableSelectProps) {
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
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
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
