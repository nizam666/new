import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Printer, AlertCircle } from 'lucide-react';
import { printThermalInvoice } from '../../utils/thermalPrinter';

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [generatingInvoiceNumber, setGeneratingInvoiceNumber] = useState(true);
  const [error, setError] = useState('');
  const shouldPrintRef = useRef(false);

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

  // Derived state calculations
  const emptyVal = parseFloat(formData.empty_weight) || 0;
  const grossVal = parseFloat(formData.gross_weight) || 0;
  const rateVal = parseFloat(formData.material_rate) || 0;

  const rawNet = grossVal - emptyVal;
  const netWeight = rawNet > 0 ? parseFloat(rawNet.toFixed(3)) : 0;
  const totalAmount = parseFloat((netWeight * rateVal).toFixed(2));

  useEffect(() => {
    generateInvoiceNumber();
  }, []);

  const generateInvoiceNumber = async () => {
    try {
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `INV-${currentYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastInvoice = data[0].invoice_number;
        const lastNumber = parseInt(lastInvoice.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      const invoiceNumber = `INV-${currentYear}-${String(nextNumber).padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
    } catch (error) {
      console.error('Error generating invoice number:', error);
    } finally {
      setGeneratingInvoiceNumber(false);
    }
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

      const { error: insertError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: formData.invoice_number,
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
          
          // Backwards compatibility for strictly required columns:
          due_date: formData.invoice_date, // Fulfill not-null requirement in legacy databases
          items: JSON.stringify(backupItemFormat),
          status: 'unpaid' // Standard default
        }]);

      if (insertError) throw insertError;

      if (shouldPrintRef.current) {
        printThermalInvoice({
          invoice_number: formData.invoice_number,
          customer_name: formData.customer_name,
          invoice_date: formData.invoice_date,
          due_date: formData.invoice_date,
          items: backupItemFormat,
          subtotal: totalAmount,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: totalAmount,
          status: 'unpaid',
          amount_paid: 0,
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
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Customer Name *</label>
            <input
              type="text"
              required
              placeholder="Client / Company"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Delivery Location</label>
            <input
              type="text"
              placeholder="Destination site"
              value={formData.delivery_location}
              onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Vehicle No</label>
            <input
              type="text"
              placeholder="TN 01 AB 1234"
              value={formData.vehicle_no}
              onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase tracking-wider font-bold text-slate-700"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Material *</label>
            <input
              type="text"
              required
              placeholder="e.g. 20mm Aggregate"
              value={formData.material_name}
              onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
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

      {/* Submit Controls */}
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
