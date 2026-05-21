import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar, Search, Download, FileText, CheckCircle, TrendingUp,
  Calculator, ShieldAlert, Award, Plus, Trash2, Building2, ChevronDown,
  Receipt, LayoutList, RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';

// ─── Company Master ───────────────────────────────────────────────────────────
const COMPANIES = {
  kvs: {
    id: 'kvs',
    name: 'K V S SUBRAHMANYAM',
    prefix: 'KVS',
    gstin: 'GSTIN_PLACEHOLDER_KVS', // ← Update with actual GSTIN
    address: 'Krishnagiri, Tamil Nadu',
  },
  sbbm: {
    id: 'sbbm',
    name: 'SRI BABA BLUE METALS PRIVATE LIMITED',
    prefix: 'SBBM',
    gstin: 'GSTIN_PLACEHOLDER_SBBM', // ← Update with actual GSTIN
    address: 'Krishnagiri, Tamil Nadu',
  },
} as const;

type CompanyId = keyof typeof COMPANIES;

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  company: string;
  gst_number: string;
  billing_address: string;
}

interface PriceMaster {
  id: string;
  product_type: string;
  sales_price: number;
  hsn: string;
  gst_rate: number;
  is_tax_inclusive?: boolean;
  inclusive_price?: number;
}

interface LineItem {
  id: string;
  material: string;
  hsn: string;
  quantity: string;
  price: string;
  discountRs: string;
  discountPct: string;
  taxRate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  delivery_location: string;
  vehicle_no: string;
  invoice_date: string;
  due_date: string;
  items: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  amount_paid: number;
  payment_mode: string;
  payment_date: string;
  payment_history: string;
  empty_weight: number;
  gross_weight: number;
  net_weight: number;
  notes: string;
  created_at: string;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function GstSalesModule() {
  const [activeTab, setActiveTab] = useState<'create' | 'report'>('create');

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit shadow-inner">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'create'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Create Invoice
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 ${
            activeTab === 'report'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" />
          GST Report
        </button>
      </div>

      {activeTab === 'create' ? (
        <GstInvoiceCreator onSaved={() => setActiveTab('report')} />
      ) : (
        <GstReportViewer />
      )}
    </div>
  );
}

// ─── Invoice Creator ──────────────────────────────────────────────────────────
function GstInvoiceCreator({ onSaved }: { onSaved: () => void }) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyId>('sbbm');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [generatingNumber, setGeneratingNumber] = useState(false);

  // Customer
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerGst, setCustomerGst] = useState('');

  // Price master
  const [priceMaster, setPriceMaster] = useState<PriceMaster[]>([]);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      material: '',
      hsn: '',
      quantity: '',
      price: '',
      discountRs: '0',
      discountPct: '0',
      taxRate: 5,
    },
  ]);

  // Extra fields
  const [securityPaperNo, setSecurityPaperNo] = useState('');
  const [bulkPermitNo, setBulkPermitNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const [saving, setSaving] = useState(false);

  // ── Fetch customers and price master ────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const [{ data: customerData }, { data: priceData }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, company, gst_number, billing_address')
          .order('name'),
        supabase
          .from('material_investors')
          .select('id, product_type, sales_price, hsn, gst_rate, is_tax_inclusive')
          .eq('status', 'active')
          .order('product_type'),
      ]);
      if (customerData) setCustomers(customerData);
      if (priceData) {
        const mapped = (priceData as any[]).map((item) => {
          const salesPrice = parseFloat(item.sales_price) || 0;
          const gstRate = parseFloat(item.gst_rate) || 5;
          const isInclusive = !!item.is_tax_inclusive;
          const incPrice = isInclusive ? salesPrice : salesPrice * (1 + gstRate / 100);
          return {
            ...item,
            inclusive_price: Number(incPrice.toFixed(2)),
          };
        });
        setPriceMaster(mapped);
      }
    };
    fetchData();
  }, []);

  // ── Generate invoice number whenever company changes ────────────────────────
  useEffect(() => {
    generateInvoiceNumber(selectedCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  const generateInvoiceNumber = async (companyId: CompanyId) => {
    setGeneratingNumber(true);
    try {
      const year = new Date().getFullYear();
      const prefix = COMPANIES[companyId].prefix;
      const { data } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `${prefix}-${year}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (data && data.length > 0) {
        const parts = data[0].invoice_number.split('-');
        const last = parseInt(parts[parts.length - 1]);
        if (!isNaN(last)) nextNum = last + 1;
      }
      setInvoiceNumber(`${prefix}-${year}-${String(nextNum).padStart(3, '0')}`);
    } catch (err) {
      console.error('Error generating invoice number:', err);
    } finally {
      setGeneratingNumber(false);
    }
  };

  // ── Line item helpers ───────────────────────────────────────────────────────
  const addItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        material: '',
        hsn: '',
        quantity: '',
        price: '',
        discountRs: '0',
        discountPct: '0',
        taxRate: 5,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };

        // Keep discount Rs ↔ Pct in sync
        const baseAmount =
          (parseFloat(merged.quantity) || 0) * (parseFloat(merged.price) || 0);

        if ('discountRs' in updates && updates.discountRs !== undefined) {
          const dRs = parseFloat(updates.discountRs) || 0;
          merged.discountPct =
            baseAmount > 0 ? ((dRs / baseAmount) * 100).toFixed(2) : '0';
        } else if ('discountPct' in updates && updates.discountPct !== undefined) {
          const dPct = parseFloat(updates.discountPct) || 0;
          merged.discountRs = ((dPct / 100) * baseAmount).toFixed(2);
        }

        return merged;
      })
    );
  };

  const selectMaterial = (itemId: string, material: string) => {
    const pm = priceMaster.find((p) => p.product_type === material);
    updateItem(itemId, {
      material,
      hsn: pm?.hsn || '',
      price: pm ? String(pm.inclusive_price) : '',
      taxRate: pm?.gst_rate || 5,
    });
  };

  // ── Per-line calculations ───────────────────────────────────────────────────
  const calcItem = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;           // GST-inclusive price per MT
    const discountRs = parseFloat(item.discountRs) || 0;
    const grossInclusive = qty * price;                   // Total inclusive of GST, before discount
    const afterDiscount = Math.max(0, grossInclusive - discountRs); // Inclusive total after discount
    const taxableAmount = afterDiscount / 1.05;           // Back-calculate base (excl. GST)
    const cgst = taxableAmount * 0.025;                   // CGST @ 2.5%
    const sgst = taxableAmount * 0.025;                   // SGST @ 2.5%
    const lineTotal = afterDiscount;                      // = taxableAmount * 1.05
    return { qty, price, grossInclusive, discountRs, taxableAmount, cgst, sgst, lineTotal };
  };

  // ── Invoice totals ──────────────────────────────────────────────────────────
  const totals = lineItems.reduce(
    (acc, item) => {
      const c = calcItem(item);
      acc.subtotal += c.taxableAmount;
      acc.cgst += c.cgst;
      acc.sgst += c.sgst;
      acc.grandTotal += c.lineTotal;
      acc.totalDiscount += c.discountRs;
      return acc;
    },
    { subtotal: 0, cgst: 0, sgst: 0, grandTotal: 0, totalDiscount: 0 }
  );

  // ── Save invoice ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error('Please select a customer');
      return;
    }
    if (lineItems.every((i) => !i.material)) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      const company = COMPANIES[selectedCompany];

      const detailedItems = lineItems
        .filter((i) => i.material)
        .map((item) => {
          const c = calcItem(item);
          return {
            material: item.material,
            material_name: item.material,
            hsn: item.hsn,
            quantity: c.qty,
            rate: c.price,
            amount: parseFloat(c.lineTotal.toFixed(2)),
            discount_rs: c.discountRs,
            cgst: parseFloat(c.cgst.toFixed(2)),
            sgst: parseFloat(c.sgst.toFixed(2)),
            taxable_amount: parseFloat(c.taxableAmount.toFixed(2)),
          };
        });

      const payload = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: invoiceDate,
        customer_id: selectedCustomerId,
        customer_name: customerName,
        vehicle_no: vehicleNo || null,
        material_name: lineItems
          .filter((i) => i.material)
          .map((i) => i.material)
          .join(', '),
        material_rate: parseFloat(lineItems[0]?.price) || 0,
        empty_weight: 0,
        gross_weight: 0,
        net_weight: 0,
        subtotal: parseFloat(totals.subtotal.toFixed(2)),
        tax_rate: 5,
        tax_amount: parseFloat((totals.cgst + totals.sgst).toFixed(2)),
        total_amount: parseFloat(totals.grandTotal.toFixed(2)),
        amount_paid: 0,
        status: 'unpaid',
        payment_history: '[]',
        items: JSON.stringify(detailedItems),
        notes: JSON.stringify({
          company_id: selectedCompany,
          company_name: company.name,
          company_gstin: company.gstin,
          customer_gstin: customerGst,
          security_paper_no: securityPaperNo,
          bulk_permit_no: bulkPermitNo,
          invoice_type: 'gst_invoice',
        }),
      };

      const { error } = await supabase.from('invoices').insert([payload]);
      if (error) throw error;

      toast.success(`GST Invoice ${invoiceNumber} saved successfully!`);
      onSaved();
    } catch (err: any) {
      toast.error('Failed to save invoice: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* ── 1. Company Selector ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(COMPANIES) as CompanyId[]).map((compId) => {
          const co = COMPANIES[compId];
          const isSelected = selectedCompany === compId;
          return (
            <button
              key={compId}
              type="button"
              onClick={() => setSelectedCompany(compId)}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
                isSelected
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-lg shadow-indigo-100/60'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                isSelected ? 'bg-indigo-600 shadow-md shadow-indigo-300' : 'bg-slate-100 group-hover:bg-indigo-100'
              }`}>
                <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              </div>
              <p className={`font-black text-sm leading-snug ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                {co.name}
              </p>
              <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                GSTIN: {co.gstin}
              </p>
              {isSelected && (
                <div className="absolute top-3.5 right-3.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 2. Invoice Header (Number + Date) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Invoice Number
            </label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
              generatingNumber ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-slate-50'
            }`}>
              {generatingNumber ? (
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
              )}
              <span className="font-black text-slate-700 text-sm tracking-wide">
                {generatingNumber ? 'Generating...' : invoiceNumber}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Invoice Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={invoiceDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Bill To + Security / Permit / Vehicle ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">
          Bill To
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Customer */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-2">Customer Name *</label>
            <CustomerDropdown
              customers={customers}
              value={customerName}
              onSelect={(cust) => {
                setSelectedCustomerId(cust.id);
                setCustomerName(cust.name || cust.company);
                setCustomerGst(cust.gst_number || '');
              }}
            />
          </div>
          {/* GSTIN */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-2">Customer GSTIN</label>
            <input
              type="text"
              value={customerGst}
              onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
              placeholder="Auto-filled from customer record"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-700 uppercase bg-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
            />
          </div>

          {/* Security Paper No */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-2">Security Paper No.</label>
            <input
              type="text"
              value={securityPaperNo}
              onChange={(e) => setSecurityPaperNo(e.target.value)}
              placeholder="Enter security paper number"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
          </div>

          {/* Bulk Permit No */}
          <div>
            <label className="block text-xs font-black text-slate-600 mb-2">Bulk Permit No.</label>
            <input
              type="text"
              value={bulkPermitNo}
              onChange={(e) => setBulkPermitNo(e.target.value)}
              placeholder="Enter bulk permit number"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-semibold text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
          </div>

          {/* Vehicle No */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-600 mb-2">Vehicle No.</label>
            <input
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
              placeholder="e.g. TN 33 AB 1234"
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-700 uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* ── 4. Line Items ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Items
          </h3>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-indigo-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-8 text-center">#</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[160px]">Item</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">HSN</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-28">Qty (MTON)</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-32">Price / MT <span className="text-indigo-400 normal-case">(Incl. GST)</span></th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-52">
                  Discount (₹ / %)
                </th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Tax</th>
                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Amount (₹)</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lineItems.map((item, idx) => {
                const c = calcItem(item);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/20 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-center">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center mx-auto">
                        {idx + 1}
                      </span>
                    </td>

                    {/* Item select */}
                    <td className="px-4 py-3.5">
                      <MaterialDropdown
                        priceMaster={priceMaster}
                        value={item.material}
                        onSelect={(mat) => selectMaterial(item.id, mat)}
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => updateItem(item.id, { hsn: e.target.value })}
                        placeholder="HSN"
                        className="w-full px-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                        placeholder="0.000"
                        className="w-full px-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                      />
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(item.id, { price: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-black text-indigo-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 outline-none transition-all"
                        />
                      </div>
                    </td>

                    {/* Discount Rs + Pct (linked) */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {/* Rs */}
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountRs}
                            onChange={(e) => updateItem(item.id, { discountRs: e.target.value })}
                            className="w-full pl-5 pr-1.5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 outline-none transition-all"
                          />
                        </div>
                        <span className="text-[10px] text-slate-300 font-black shrink-0">|</span>
                        {/* Pct */}
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPct}
                            onChange={(e) => updateItem(item.id, { discountPct: e.target.value })}
                            className="w-full pl-1.5 pr-5 py-2 border-2 border-slate-100 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 outline-none transition-all"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">%</span>
                        </div>
                      </div>
                    </td>

                    {/* Tax amount */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100">
                        5%
                      </span>
                      {(c.cgst + c.sgst) > 0 && (
                        <p className="text-[10px] font-black text-indigo-700 mt-1">
                          ₹{(c.cgst + c.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-black text-slate-900 leading-tight">
                        ₹{c.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {c.discountRs > 0 && (
                        <p className="text-[9px] font-bold text-amber-500 mt-0.5">
                          -{c.discountRs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3.5">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Totals Summary ── */}
        <div className="px-6 py-5 border-t border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50/30">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Taxable Amount</span>
                <span className="font-black text-slate-800">
                  ₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-600 font-bold">Total Discount</span>
                  <span className="font-black text-amber-600">
                    −₹{totals.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-indigo-500 font-bold">CGST @ 2.5%</span>
                <span className="font-black text-indigo-700">
                  ₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-indigo-500 font-bold">SGST @ 2.5%</span>
                <span className="font-black text-indigo-700">
                  ₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t-2 border-indigo-200 pt-3 flex justify-between items-center">
                <span className="text-slate-900 font-black text-base">Grand Total</span>
                <span className="text-xl font-black text-indigo-900">
                  ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="flex justify-end pb-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-200 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Receipt className="w-5 h-5" />
          )}
          {saving ? 'Saving Invoice...' : 'Save GST Invoice'}
        </button>
      </div>
    </div>
  );
}

// ─── Customer Dropdown ────────────────────────────────────────────────────────
function CustomerDropdown({
  customers,
  value,
  onSelect,
}: {
  customers: Customer[];
  value: string;
  onSelect: (c: Customer) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = customers.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
          isOpen
            ? 'border-indigo-500 ring-4 ring-indigo-500/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={`text-sm font-bold truncate ${value ? 'text-slate-800' : 'text-slate-400 font-normal'}`}>
          {value || 'Search and select customer...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Type to search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 transition-colors ${
                    value === c.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <p className="text-sm font-bold leading-tight">{c.name}</p>
                  {c.company && (
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {c.company}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-bold text-slate-400">No customers found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Material Dropdown ────────────────────────────────────────────────────────
function MaterialDropdown({
  priceMaster,
  value,
  onSelect,
}: {
  priceMaster: PriceMaster[];
  value: string;
  onSelect: (material: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = priceMaster.filter((p) =>
    p.product_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-2 border-2 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/10'
            : 'border-slate-100 hover:border-slate-300'
        }`}
      >
        <span className={`text-xs font-bold truncate ${value ? 'text-slate-800' : 'text-slate-400 font-normal'}`}>
          {value || 'Select item...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-56 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelect(p.product_type);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2.5 text-xs cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2 ${
                    value === p.product_type
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 font-medium'
                  }`}
                >
                  <span className="truncate">{p.product_type}</span>
                  <span className="shrink-0 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    ₹{p.inclusive_price}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center">
                <p className="text-xs font-bold text-slate-400">No items found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report Viewer (existing functionality preserved) ─────────────────────────
function GstReportViewer() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchGstInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gt('tax_rate', 0)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching GST invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchGstInvoices();
  }, [fetchGstInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.vehicle_no && inv.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.delivery_location &&
        inv.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && inv.status === statusFilter;
  });

  const stats = filteredInvoices.reduce(
    (acc, inv) => {
      acc.totalGross += inv.total_amount || 0;
      acc.totalSubtotal += inv.subtotal || 0;
      acc.totalTax += inv.tax_amount || 0;
      acc.totalPaid += inv.amount_paid || 0;
      acc.totalDue += (inv.total_amount - inv.amount_paid) || 0;
      return acc;
    },
    { totalGross: 0, totalSubtotal: 0, totalTax: 0, totalPaid: 0, totalDue: 0 }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'partial': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'unpaid': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getMaterialDetails = (itemsJson: string) => {
    try {
      const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      if (Array.isArray(items)) {
        return items
          .map((i: any) => `${i.material || i.material_name || ''} (${(i.quantity || 0).toFixed(2)} MT)`)
          .join(', ');
      }
    } catch (e) {}
    return '-';
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('GST Sales');
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.addRow([]);
    worksheet.addRow(['SRI BABA BLUE METALS PVT LTD']).font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.addRow(['GST Sales Report']).font = { size: 12, bold: true, color: { argb: 'FF475569' } };
    worksheet.addRow([`Period: ${format(parseISO(startDate), 'dd-MM-yyyy')} to ${format(parseISO(endDate), 'dd-MM-yyyy')}`]).font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.addRow([]);
    const headers = ['Sl No', 'Invoice No', 'Date', 'Customer Name', 'Vehicle No', 'Materials (Qty)', 'Subtotal (Excl. GST)', 'GST (5%)', 'Gross Amount', 'Paid', 'Due Amount', 'Status'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    filteredInvoices.forEach((inv, index) => {
      const row = worksheet.addRow([
        index + 1, inv.invoice_number, format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
        inv.customer_name, inv.vehicle_no || '-', getMaterialDetails(inv.items),
        inv.subtotal, inv.tax_amount, inv.total_amount, inv.amount_paid,
        inv.total_amount - inv.amount_paid, inv.status.toUpperCase(),
      ]);
      row.eachCell((cell, colIndex) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        if (colIndex >= 7 && colIndex <= 11) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
        if (colIndex === 1 || colIndex === 3 || colIndex === 12) { cell.alignment = { horizontal: 'center' }; }
      });
    });
    const totalRowIndex = worksheet.lastRow!.number + 1;
    const totalsRow = worksheet.addRow(['Total', '', '', '', '', '',
      { formula: `=SUM(G6:G${totalRowIndex - 1})` }, { formula: `=SUM(H6:H${totalRowIndex - 1})` },
      { formula: `=SUM(I6:I${totalRowIndex - 1})` }, { formula: `=SUM(J6:J${totalRowIndex - 1})` },
      { formula: `=SUM(K6:K${totalRowIndex - 1})` }, '']);
    totalsRow.eachCell((cell, colIndex) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'double' } };
      if (colIndex >= 7 && colIndex <= 11) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
    });
    worksheet.columns.forEach((col, index) => {
      if (index === 0) col.width = 8; else if (index === 1) col.width = 16;
      else if (index === 2) col.width = 14; else if (index === 3) col.width = 28;
      else if (index === 4) col.width = 16; else if (index === 5) col.width = 38;
      else if (index >= 6 && index <= 10) col.width = 18; else if (index === 11) col.width = 14;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Sales_Report_${startDate}_to_${endDate}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('SRI BABA BLUE METALS PVT LTD', 14, 15);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('GST Sales Report', 14, 21);
    doc.text(`Period: ${format(parseISO(startDate), 'dd-MM-yyyy')} to ${format(parseISO(endDate), 'dd-MM-yyyy')}`, 14, 26);
    const tableRows = filteredInvoices.map((inv, index) => [
      index + 1, inv.invoice_number, format(parseISO(inv.invoice_date), 'dd-MM-yyyy'),
      inv.customer_name, inv.vehicle_no || '-', getMaterialDetails(inv.items),
      `Rs. ${inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      inv.status.toUpperCase(),
    ]);
    tableRows.push(['Total', '', '', '', '', '',
      `Rs. ${stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Rs. ${stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']);
    autoTable(doc, {
      head: [['Sl No', 'Invoice No', 'Date', 'Customer', 'Vehicle No', 'Materials', 'Subtotal', 'GST (5%)', 'Gross Amt', 'Paid', 'Due', 'Status']],
      body: tableRows, startY: 32, theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 }, 1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 18 }, 3: { cellWidth: 45 }, 4: { cellWidth: 20 },
        5: { cellWidth: 55 }, 6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
        11: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save(`GST_Sales_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transform -rotate-3">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">GST Sales Ledger</h2>
            <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Comprehensive 5% GST billing insights</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <span className="text-slate-500 font-black text-xs">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700">
            <button onClick={exportToExcel} disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" /> EXCEL
            </button>
            <button onClick={exportToPDF} disabled={loading || filteredInvoices.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-950 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Gross Sales', value: stats.totalGross, icon: FileText, color: 'blue', sub: `(${filteredInvoices.length} invoices)` },
          { label: 'Taxable Subtotal', value: stats.totalSubtotal, icon: Calculator, color: 'teal', sub: 'EXCLUDING GST' },
          { label: 'GST Collected', value: stats.totalTax, icon: TrendingUp, color: 'indigo', sub: '5% Tax Share' },
          { label: 'Amount Paid', value: stats.totalPaid, icon: CheckCircle, color: 'emerald', sub: 'Cleared Payments' },
          { label: 'Balance Due', value: stats.totalDue, icon: ShieldAlert, color: 'rose', sub: 'Pending Receivable' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2.5 text-slate-400 mb-3">
                <div className={`w-7 h-7 bg-${color}-50 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 text-${color}-600`} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
              </div>
              <p className={`text-xl font-black leading-none text-${color === 'blue' || color === 'teal' ? 'slate' : color}-${color === 'blue' || color === 'teal' ? '900' : '600'}`}>
                Rs. {value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-${color}-${color === 'blue' || color === 'teal' ? '400' : '500'} uppercase tracking-wider`}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search invoice number, customer, vehicle or location..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-semibold text-slate-700 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm font-bold text-slate-600 outline-none">
          <option value="all">All Payment Status</option>
          <option value="unpaid">Unpaid Only</option>
          <option value="partial">Partially Paid Only</option>
          <option value="paid">Fully Paid Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-400">Fetching GST records...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-24 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-base font-black text-slate-800">No GST Invoices Found</p>
            <p className="text-xs text-slate-400 mt-1">Adjust dates or try searching different keywords</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Sl', 'Invoice Details', 'Customer & Routing', 'Vehicle & Materials', 'Subtotal', 'GST (5%)', 'Gross Total', 'Paid', 'Due', 'Status'].map((h, i) => (
                    <th key={h} className={`px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest ${i > 3 ? 'text-right' : ''} ${i === 0 || i === 9 ? 'text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 text-sm">
                {filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-4 text-center text-xs text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900">{inv.invoice_number}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                        {format(parseISO(inv.invoice_date), 'dd MMM yyyy')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-800 leading-tight">{inv.customer_name}</p>
                      {inv.delivery_location && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[160px]">Dest: {inv.delivery_location}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-800 text-xs font-bold leading-tight truncate max-w-[200px]" title={getMaterialDetails(inv.items)}>
                        {getMaterialDetails(inv.items)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-0.5">VEHICLE: {inv.vehicle_no || '-'}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-xs">Rs. {inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-indigo-600 font-bold">Rs. {inv.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-slate-900 font-bold">Rs. {inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-emerald-600">Rs. {inv.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-right text-xs text-rose-600 font-bold">Rs. {(inv.total_amount - inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-xs uppercase tracking-widest text-slate-500">Totals</td>
                  <td className="px-4 py-4 text-right text-xs">Rs. {stats.totalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-indigo-600">Rs. {stats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-slate-900">Rs. {stats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-emerald-600">Rs. {stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 text-right text-xs text-rose-600">Rs. {stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
