import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Calendar, 
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface BillItem {
  slNo: number | string;
  description: string;
  uom: string;
  rate: number;
  qty: number;
  amount: number;
  category: 'production' | 'deduction';
  group: 'A' | 'B' | 'C' | 'D';
}

export function ContractorCalculator() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [contractorName] = useState('Govindaraj');
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  useEffect(() => {
    calculateBill();
  }, [startDate, endDate, contractorName]);

  const calculateBill = async () => {
    setLoading(true);
    try {
      // 1. Fetch Transport Records
      const { data: transportData, error: transportError } = await supabase
        .from('transport_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (transportError) throw transportError;

      // 2. Fetch Invoices (for Q-Sales)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('items, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      if (invoiceError) throw invoiceError;

      // 3. Fetch Loading Records (for Excavator hours)
      const { data: loadingData, error: loadingError } = await supabase
        .from('loading_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (loadingError) throw loadingError;

      // 4. Fetch Drilling Records (for Drilling feet)
      const { data: drillingData, error: drillingError } = await supabase
        .from('drilling_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (drillingError) throw drillingError;

      // 5. Fetch Deductions (Advances and Dispatch Items)
      const deductions: BillItem[] = [];

      if (contractorName) {
        // Cash Advances and Payments from Accounts for the Quarry Department
        const { data: accountsData } = await supabase
          .from('accounts')
          .select('customer_name, amount_given, reason, notes, project_item')
          .eq('department', 'Quarry')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        
        if (accountsData) {
          const groupedAdvances: Record<string, number> = {};
          accountsData.forEach(rec => {
            if (rec.amount_given > 0) {
              const name = rec.customer_name || rec.project_item || 'Quarry Expense';
              const key = `${name} (${rec.project_item || 'Misc'})`;
              groupedAdvances[key] = (groupedAdvances[key] || 0) + (rec.amount_given || 0);
            }
          });

          Object.entries(groupedAdvances).forEach(([name, amount], idx) => {
            deductions.push({
              slNo: `ADV-${idx + 1}`,
              description: `Quarry Expense/Payment: ${name}`,
              uom: 'Amount',
              rate: 1,
              qty: amount,
              amount: -amount,
              category: 'deduction',
              group: 'D'
            });
          });
        }

        // Resource Items from Dispatch (Quarry Operations)
        const { data: dispatchData } = await supabase
          .from('inventory_dispatch')
          .select('item_name, quantity_dispatched, given_price, unit')
          .eq('department', 'Quarry Operations')
          .gte('dispatch_date', startDate)
          .lte('dispatch_date', endDate)
          .not('given_price', 'is', null);
        
        if (dispatchData) {
          const groupedResources: Record<string, { qty: number, amount: number, unit: string, rate: number }> = {};
          
          dispatchData.forEach(d => {
            const rawName = d.item_name || 'Other Item';
            const isExplosive = /PG|NONEL|DETONATOR|EXPLOSIVE/i.test(rawName);
            const key = isExplosive ? 'Explosives' : rawName;
            
            const isPG = rawName.toUpperCase() === 'PG';
            let qty = d.quantity_dispatched || 0;
            if (isPG) qty = qty / 200;

            if (!groupedResources[key]) {
              groupedResources[key] = { 
                qty: 0, 
                amount: 0, 
                unit: isExplosive ? 'Value' : (isPG ? 'Box' : (d.unit || 'Nos')), 
                rate: isExplosive ? 1 : (d.given_price || 0) 
              };
            }
            
            if (isExplosive) {
              groupedResources[key].qty += qty * (d.given_price || 0);
              groupedResources[key].amount += qty * (d.given_price || 0);
            } else {
              groupedResources[key].qty += qty;
              groupedResources[key].amount += qty * (d.given_price || 0);
            }
          });

          Object.entries(groupedResources).forEach(([name, data], idx) => {
            deductions.push({
              slNo: `RES-${idx + 1}`,
              description: `Resource: ${name}`,
              uom: data.unit,
              rate: data.rate,
              qty: data.qty,
              amount: -data.amount,
              category: 'deduction',
              group: 'D'
            });
          });
        }
      }

      // --- CALCULATIONS ---
      // ... existing production calculations ...

      // Q-C: Quarry to Crusher (Good Boulders)
      const qcQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      // Q-S: Quarry to Stockyard (Good Boulders)
      const qsQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      // Q-Sales: Invoices for Q-Boulders
      let qSalesQty = 0;
      invoiceData?.forEach(inv => {
        let items = [];
        try {
          items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        } catch (e) {}
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const matName = item.material || item.material_name || '';
            if (matName === 'Q-Boulders') {
              qSalesQty += (item.quantity || 0);
            }
          });
        }
      });

      // S-C: Stockyard to Crusher (Good Boulders)
      const scQty = transportData
        ?.filter(r => r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      // Soil/WR Excavator Hours
      const excavatorHours = loadingData
        ?.filter(r => ['KVSS Soil', 'KVSS Weather Rocks'].includes(r.material_type))
        .reduce((sum, r) => {
          const run = (r.ending_hours || 0) - (r.starting_hours || 0);
          return sum + (run > 0 ? run : 0);
        }, 0) || 0;

      // Soil/WR Tipper Trips
      const tipperTrips = transportData
        ?.filter(r => ['Soil', 'Weather Rocks'].includes(r.material_transported))
        .reduce((sum, r) => sum + (r.number_of_trips || 0), 0) || 0;

      // Crusher Excavator Hours
      const crusherExcavatorHours = loadingData
        ?.filter(r => [
          'SBBM Slurry Work', 
          'SBBM Stockyard Good Boulders', 
          'Aggregates rehandling/ Aggregate Loading', 
          'Crusher machine works'
        ].includes(r.material_type))
        .reduce((sum, r) => {
          const run = (r.ending_hours || 0) - (r.starting_hours || 0);
          return sum + (run > 0 ? run : 0);
        }, 0) || 0;

      // Weather Rock Drilling Feet
      const drillingFeet = drillingData
        ?.filter(r => ['Weathered Rocks', 'Soil'].includes(r.material_type))
        .reduce((sum, r) => {
          let dailySum = 0;
          const set1 = r.rod_measurements || {};
          const set2 = r.rod_measurements_set2 || {};
          const ROD_STEPS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5];
          ROD_STEPS.forEach(step => {
            const key = step.toString().replace('.', '_');
            dailySum += (set1[`rod${key}`] || 0) * step;
            dailySum += (set2[`rod${key}_set2`] || 0) * step;
          });
          return sum + dailySum;
        }, 0) || 0;

      // Build Production Items List
      const productionItems: BillItem[] = [
        {
          slNo: 1,
          description: 'Q-C - Good Boulder Production',
          uom: 'MT',
          rate: 163,
          qty: qcQty,
          amount: qcQty * 163,
          category: 'production',
          group: 'A'
        },
        {
          slNo: 2,
          description: 'Q-Stock - Good Boulders',
          uom: 'MT',
          rate: 163,
          qty: qsQty,
          amount: qsQty * 163,
          category: 'production',
          group: 'A'
        },
        {
          slNo: 3,
          description: 'Q-Sales - Good Boulders',
          uom: 'MT',
          rate: 138,
          qty: qSalesQty,
          amount: qSalesQty * 138,
          category: 'production',
          group: 'A'
        },
        {
          slNo: 4,
          description: 'Stock - Crusher - Good Boulders',
          uom: 'MT',
          rate: 40,
          qty: scQty,
          amount: scQty * 40,
          category: 'production',
          group: 'C'
        },
        {
          slNo: 5,
          description: 'Soil/WR Excavation - Excavator',
          uom: 'HRS',
          rate: 1650,
          qty: excavatorHours,
          amount: excavatorHours * 1650,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 6,
          description: 'Soil/WR Excavation - Tipper Loading',
          uom: 'Trips',
          rate: 200,
          qty: tipperTrips,
          amount: tipperTrips * 200,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 7,
          description: 'Weather Rock Drilling and Blasting',
          uom: 'Feet',
          rate: 22,
          qty: drillingFeet,
          amount: drillingFeet * 22,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 8,
          description: 'Charges for Excavator engaged for crusher',
          uom: 'HRS',
          rate: 1650,
          qty: crusherExcavatorHours,
          amount: crusherExcavatorHours * 1650,
          category: 'production',
          group: 'C'
        }
      ];

      setBillItems([...productionItems, ...deductions]);
    } catch (err) {
      console.error('Error calculating contractor bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalBillAmount = billItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Contractor Bill Calculator</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Automated Quarry billing system</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-slate-400 font-black">TO</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-2">Estimated Net Payable</p>
              <h2 className="text-5xl font-black text-white tracking-tighter">
                ₹{totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="flex flex-col items-end">
              <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl mb-3">
                <span className="text-blue-400 text-xs font-black uppercase tracking-widest">Contractor: {contractorName}</span>
              </div>
              <p className="text-slate-500 text-[10px] font-bold text-right leading-relaxed max-w-[200px]">
                Net amount after itemized resource deductions and production credits.
              </p>
            </div>
          </div>
        </div>

        {/* Bill Table */}
        <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sl.No.</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">UOM</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rate (₹)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">QTY</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm font-bold text-slate-400">Processing Quarry Data...</p>
                    </div>
                  </td>
                </tr>
              ) : billItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <p className="text-sm font-bold text-slate-400 italic">No records found for the selected period</p>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Group A: Quarry Good Boulders */}
                  <tr className="bg-blue-50/50">
                    <td colSpan={6} className="px-6 py-3">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Group A: Quarry Good Boulders</span>
                    </td>
                  </tr>
                  {billItems.filter(i => i.group === 'A').map((item) => (
                    <tr key={item.slNo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-black text-slate-400">{item.slNo}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 tracking-tight">{item.description}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 uppercase">{item.uom}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-500">{item.rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/30 border-b border-blue-100">
                    <td colSpan={5} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-blue-400">Section Subtotal</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-blue-600">
                      ₹{billItems.filter(i => i.group === 'A').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group B: Soil/Weather Rocks */}
                  <tr className="bg-orange-50/50">
                    <td colSpan={6} className="px-6 py-3">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Group B: Soil/Weather Rocks</span>
                    </td>
                  </tr>
                  {billItems.filter(i => i.group === 'B').map((item) => (
                    <tr key={item.slNo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-black text-slate-400">{item.slNo}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 tracking-tight">{item.description}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 uppercase">{item.uom}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-500">{item.rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-50/30 border-b border-orange-100">
                    <td colSpan={5} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-orange-400">Section Subtotal</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-orange-600">
                      ₹{billItems.filter(i => i.group === 'B').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group C: Crusher Works */}
                  <tr className="bg-emerald-50/50">
                    <td colSpan={6} className="px-6 py-3">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Group C: Crusher Works</span>
                    </td>
                  </tr>
                  {billItems.filter(i => i.group === 'C').map((item) => (
                    <tr key={item.slNo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-black text-slate-400">{item.slNo}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 tracking-tight">{item.description}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 uppercase">{item.uom}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-500">{item.rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/30 border-b border-emerald-100">
                    <td colSpan={5} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-emerald-400">Section Subtotal</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-emerald-600">
                      ₹{billItems.filter(i => i.group === 'C').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="bg-slate-900 text-white">
                    <td colSpan={5} className="px-6 py-6 text-right text-xs font-black uppercase tracking-[0.2em] text-slate-400">Production Total Amount</td>
                    <td className="px-6 py-6 text-right text-xl font-black text-blue-400">
                      ₹{billItems.filter(i => i.category === 'production').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group D: Deductions */}
                  <tr className="bg-rose-50/50">
                    <td colSpan={6} className="px-6 py-3">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Group D: Deductions for {contractorName}</span>
                    </td>
                  </tr>
                  {billItems.filter(i => i.group === 'D').map((item) => (
                    <tr key={item.slNo} className="hover:bg-slate-50 transition-colors text-rose-600">
                      <td className="px-6 py-4 text-sm font-black opacity-50">{item.slNo}</td>
                      <td className="px-6 py-4 text-sm font-bold tracking-tight">{item.description}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-rose-100 rounded text-[10px] font-black uppercase">{item.uom}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold">{item.rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-black">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm font-black">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-rose-50/30 border-b border-rose-100">
                    <td colSpan={5} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-rose-400">Total Deductions</td>
                    <td className="px-6 py-3 text-right text-sm font-black text-rose-600">
                      ₹{billItems.filter(i => i.group === 'D').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="bg-emerald-600 text-white shadow-xl">
                    <td colSpan={5} className="px-6 py-6 text-right text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Net Payable Amount</td>
                    <td className="px-6 py-6 text-right text-2xl font-black text-white">
                      ₹{totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-blue-800 leading-relaxed">
            <strong>Note:</strong> Itemized deductions are based on verified field records for {contractorName}. Production values reflect automated logs from transport, loading, and drilling modules.
          </p>
        </div>
      </div>
    </div>
  );
}
