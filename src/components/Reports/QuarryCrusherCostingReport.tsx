import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── types ────────────────────────────────────────────────────────────────────
interface CostRow {
  slNo: number;
  description: string;
  uom: string;
  qty: number;
  amount: number;
  costPerUnit: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

const fmtDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  } catch {
    return dateStr;
  }
};

// ─── component ────────────────────────────────────────────────────────────────
export function QuarryCrusherCostingReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Group A, B, C, D, E, F, H, I state
  const [groupARows, setGroupARows] = useState<CostRow[]>([]);
  const [groupBRow, setGroupBRow] = useState<CostRow | null>(null);
  const [groupBBreakdown, setGroupBBreakdown] = useState<CostRow[]>([]);
  const [groupCRow, setGroupCRow] = useState<CostRow | null>(null);
  const [groupDRow, setGroupDRow] = useState<CostRow | null>(null);
  const [groupERow, setGroupERow] = useState<CostRow | null>(null);
  const [groupFRow, setGroupFRow] = useState<CostRow | null>(null);
  const [groupHRows, setGroupHRows] = useState<CostRow[]>([]);
  const [groupIRow, setGroupIRow] = useState<CostRow | null>(null);
  // Crusher section
  const [crusherQty, setCrusherQty] = useState(0);
  const [crusherContractors, setCrusherContractors] = useState<{ name: string; amount: number }[]>([]);
  const [crusherSpares, setCrusherSpares] = useState<{ item: string; unit: string; qty: number; rate: number; amount: number }[]>([]);
  const [crusherEBRow, setCrusherEBRow] = useState<CostRow | null>(null);
  const [crusherJCBRow, setCrusherJCBRow] = useState<CostRow | null>(null);
  const [crusherWBRow, setCrusherWBRow] = useState<CostRow | null>(null);
  const [crusherCRRow, setCrusherCRRow] = useState<CostRow | null>(null);
  const [crusherMiscRow, setCrusherMiscRow] = useState<CostRow | null>(null);
  const [crusherGstRow, setCrusherGstRow] = useState<CostRow | null>(null);
  const [crusherSalesValue, setCrusherSalesValue] = useState(0);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Transport records
      const { data: transport } = await supabase
        .from('transport_records')
        .select('from_location, to_location, material_transported, quantity, number_of_trips')
        .gte('date', startDate)
        .lte('date', endDate);

      // Loading records (for excavator hours)
      const { data: loadingData } = await supabase
        .from('loading_records')
        .select('material_type, starting_hours, ending_hours')
        .gte('date', startDate)
        .lte('date', endDate);

      // Drilling records
      const { data: drillingData } = await supabase
        .from('drilling_records')
        .select('material_type, rod_measurements, rod_measurements_set2')
        .gte('date', startDate)
        .lte('date', endDate);

      // Blasting records for WR explosives
      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('date, pg_nos, pg_unit, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('material_type', 'Weathered Rocks');

      // Purchase prices for WR explosives cost
      const { data: purchaseTx } = await supabase
        .from('inventory_transactions')
        .select('notes, date, inventory_items(item_name)')
        .eq('transaction_type', 'in')
        .lte('date', endDate)
        .order('date', { ascending: false });

      // Invoice records for Q-Boulder sales
      const { data: invoices } = await supabase
        .from('invoices')
        .select('items, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      // ── Quarry → Crusher (Q-C) ──────────────────────────────────────────
      const QC_RATE = 163;
      const qcQty = transport
        ?.filter(r =>
          r.from_location === 'Quarry' &&
          r.to_location === 'Crusher' &&
          r.material_transported === 'Good Boulders'
        )
        .reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
      const qcAmount = qcQty * QC_RATE;

      // ── Quarry → Stockyard (Q-S) ────────────────────────────────────────
      const QS_RATE = 163;
      const qsQty = transport
        ?.filter(r =>
          r.from_location === 'Quarry' &&
          r.to_location === 'Stockyard' &&
          r.material_transported === 'Good Boulders'
        )
        .reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
      const qsAmount = qsQty * QS_RATE;

      // ── Q-Boulders Sale (from invoices) ─────────────────────────────────
      const SALE_RATE = 138;
      let salesQty = 0;
      invoices?.forEach(inv => {
        let items: any[] = [];
        try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; } catch {}
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const mat = (item.material || item.material_name || '').toLowerCase();
            if (mat.includes('q-boulder') || mat.includes('q-bolders')) {
              salesQty += parseFloat(item.quantity) || (parseFloat(item.gross_weight) - parseFloat(item.empty_weight)) || 0;
            }
          });
        }
      });
      const salesAmount = salesQty * SALE_RATE;

      // ── Consolidated Good Boulder Production ────────────────────────────
      const totalQty = qcQty + qsQty + salesQty;
      const totalAmount = qcAmount + qsAmount + salesAmount;
      const costPerUnit = totalQty > 0 ? totalAmount / totalQty : 0;

      setGroupARows([
        {
          slNo: 1,
          description: 'Good Boulder Production (Q-C + Q-S + Q-Boulder Sale)',
          uom: 'MT',
          qty: totalQty,
          amount: totalAmount,
          costPerUnit,
        },
        // sub-rows for breakdown
        {
          slNo: 0,
          description: `  ↳ Q-C  (Quarry → Crusher): ${fmt(qcQty)} MT × ₹${QC_RATE}`,
          uom: 'MT',
          qty: qcQty,
          amount: qcAmount,
          costPerUnit: QC_RATE,
        },
        {
          slNo: 0,
          description: `  ↳ Q-S  (Quarry → Stockyard): ${fmt(qsQty)} MT × ₹${QS_RATE}`,
          uom: 'MT',
          qty: qsQty,
          amount: qsAmount,
          costPerUnit: QS_RATE,
        },
        {
          slNo: 0,
          description: `  ↳ Q-Sale (Boulder Sales): ${fmt(salesQty)} MT × ₹${SALE_RATE}`,
          uom: 'MT',
          qty: salesQty,
          amount: salesAmount,
          costPerUnit: SALE_RATE,
        },
      ]);

      // ── Group B: Soil/WR Production ─────────────────────────────────────
      // Helper: get purchase price for explosive type at a given date
      const getPriceAtDate = (type: 'PG'|'ED'|'EDET'|'N3'|'N4', date: string) => {
        const found = purchaseTx?.find(t => {
          const name = ((t.inventory_items as any)?.item_name || '').toUpperCase().trim();
          if (t.date > date) return false;
          if (type === 'PG') return name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
          if (type === 'EDET') return name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET') || name.includes('ELECTRONIC DET');
          if (type === 'ED') return !name.includes('EDET') && (name === 'ED' || name.startsWith('ELEC DET') || name.includes('ELECTRIC DET'));
          if (type === 'N3') return name.includes('NONEL') && (name.includes('3M') || name.includes('3 M'));
          if (type === 'N4') return name.includes('NONEL') && (name.includes('4M') || name.includes('4 M'));
          return false;
        });
        if (found) { const m = (found.notes || '').match(/Rate:\s*([\d.]+)/); return m ? parseFloat(m[1]) : 0; }
        return 0;
      };

      // B1: Excavator hours (Soil/WR)
      const EXCAVATOR_RATE = 1650;
      const excavatorHours = loadingData
        ?.filter(r => ['KVSS Soil', 'KVSS Weather Rocks'].includes(r.material_type))
        .reduce((s, r) => { const run = (r.ending_hours||0)-(r.starting_hours||0); return s+(run>0?run:0); }, 0) ?? 0;
      const excavatorAmt = excavatorHours * EXCAVATOR_RATE;

      // B2: Tipper trips (Soil/WR)
      const TIPPER_RATE = 200;
      const tipperTrips = transport
        ?.filter(r => ['Soil','Weather Rocks'].includes(r.material_transported))
        .reduce((s, r) => s + ((r as any).number_of_trips || 0), 0) ?? 0;
      const tipperAmt = tipperTrips * TIPPER_RATE;

      // B3: Drilling feet (WR/Soil)
      const DRILLING_RATE = 22;
      const ROD_STEPS = [10,9,8,7,6,5,4,3,2,1,0.5];
      const drillingFeet = drillingData
        ?.filter(r => ['Weathered Rocks','Soil'].includes(r.material_type))
        .reduce((s, r) => {
          let daily = 0;
          const s1 = r.rod_measurements || {};
          const s2 = r.rod_measurements_set2 || {};
          ROD_STEPS.forEach(step => {
            const k = step.toString().replace('.','_');
            daily += (s1[`rod${k}`]||0)*step + (s2[`rod${k}_set2`]||0)*step;
          });
          return s + daily;
        }, 0) ?? 0;
      const drillingAmt = drillingFeet * DRILLING_RATE;

      // B4: WR Explosives Original Cost (item 10 in QuarryProductionCostReportModule)
      let wrExplosivesAmt = 0;
      blastingData?.forEach(b => {
        let pg = b.pg_nos || 0; if (b.pg_unit === 'nos') pg = pg / 200;
        const ed = b.ed_nos || 0; const edet = b.edet_nos || 0;
        const n3 = b.nonel_3m_nos || 0; const n4 = b.nonel_4m_nos || 0;
        wrExplosivesAmt += (pg * getPriceAtDate('PG', b.date))
          + (ed * getPriceAtDate('ED', b.date))
          + (edet * getPriceAtDate('EDET', b.date))
          + (n3 * getPriceAtDate('N3', b.date))
          + (n4 * getPriceAtDate('N4', b.date));
      });

      const groupBAmount = excavatorAmt + tipperAmt + drillingAmt + wrExplosivesAmt;
      const groupBQty = totalQty; // same as Group A GB qty
      const groupBCpu = groupBQty > 0 ? groupBAmount / groupBQty : 0;

      setGroupBRow({
        slNo: 2,
        description: 'Soil / Weather Rock Production Cost',
        uom: 'MT',
        qty: groupBQty,
        amount: groupBAmount,
        costPerUnit: groupBCpu,
      });
      setGroupBBreakdown([
        { slNo: 0, description: `  ↳ Excavator (Soil/WR): ${fmt(excavatorHours)} HRS × ₹${EXCAVATOR_RATE}`, uom: 'HRS', qty: excavatorHours, amount: excavatorAmt, costPerUnit: EXCAVATOR_RATE },
        { slNo: 0, description: `  ↳ Tipper Loading (Soil/WR): ${tipperTrips} Trips × ₹${TIPPER_RATE}`, uom: 'Trips', qty: tipperTrips, amount: tipperAmt, costPerUnit: TIPPER_RATE },
        { slNo: 0, description: `  ↳ Drilling & Blasting (WR): ${fmt(drillingFeet)} Feet × ₹${DRILLING_RATE}`, uom: 'Feet', qty: drillingFeet, amount: drillingAmt, costPerUnit: DRILLING_RATE },
        { slNo: 0, description: `  ↳ WR Explosives Original Cost (item 10)`, uom: '—', qty: 1, amount: wrExplosivesAmt, costPerUnit: wrExplosivesAmt },
      ]);

      // ── Group C: Boulder Rehandling (item 7 — Stock→Crusher Good Boulders) ──
      const SC_RATE = 40;
      const scQty = transport
        ?.filter(r => r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((s, r) => s + (r.quantity || 0), 0) ?? 0;
      const scAmt = scQty * SC_RATE;
      const groupCQty = totalQty;
      const groupCCpu = groupCQty > 0 ? scAmt / groupCQty : 0;
      setGroupCRow({
        slNo: 3,
        description: 'Boulder Rehandling — Stock → Crusher (Good Boulders)',
        uom: 'MT',
        qty: groupCQty,
        amount: scAmt,
        costPerUnit: groupCCpu,
      });

      // ── Group D: Excavator Additional Work in Crusher (item 8) ──────────
      const CRUSHER_EXC_RATE = 1650;
      const crusherExcHours = loadingData
        ?.filter(r => ['SBBM Slurry Work','SBBM Stockyard Good Boulders','Aggregates rehandling/ Aggregate Loading','Crusher machine works'].includes(r.material_type))
        .reduce((s, r) => { const run = (r.ending_hours||0)-(r.starting_hours||0); return s+(run>0?run:0); }, 0) ?? 0;
      const crusherExcAmt = crusherExcHours * CRUSHER_EXC_RATE;
      const groupDQty = totalQty;
      const groupDCpu = groupDQty > 0 ? crusherExcAmt / groupDQty : 0;
      setGroupDRow({
        slNo: 4,
        description: `Excavator Additional Work in Crusher: ${fmt(crusherExcHours)} HRS × ₹${CRUSHER_EXC_RATE}`,
        uom: 'MT', qty: groupDQty, amount: crusherExcAmt, costPerUnit: groupDCpu,
      });

      // ── Group E: Government Royalty + GST (item 14 — Quarry Permit) ──────
      const { data: permitData } = await supabase
        .from('permits')
        .select('quantity_in_mt,royalty_base,royalty_gst,dmf_base,dmf_gst,gf_base,gf_gst,mbl,tds,miscellaneous')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      let permitRoyaltyGst = 0;
      let permitMisc = 0;
      permitData?.forEach(p => {
        const qty = parseFloat(p.quantity_in_mt) || 0;
        const royaltyBase = parseFloat(p.royalty_base) || (qty * 33);
        const royaltyGst  = parseFloat(p.royalty_gst)  || (royaltyBase * 0.18);
        const dmfBase = parseFloat(p.dmf_base) || (royaltyBase * 0.10);
        const dmfGst  = parseFloat(p.dmf_gst)  || (dmfBase * 0.18);
        const gfBase  = parseFloat(p.gf_base)  || (royaltyBase * 0.10);
        const gfGst   = parseFloat(p.gf_gst)   || (gfBase * 0.18);
        const mbl = parseFloat(p.mbl) || 0;
        const tds = parseFloat(p.tds) || 0;
        permitRoyaltyGst += (royaltyBase + dmfBase + gfBase + mbl + tds) + (royaltyGst + dmfGst + gfGst);
        permitMisc += parseFloat(p.miscellaneous) || 0;
      });
      const groupEQty = totalQty;
      setGroupERow({ slNo: 5, description: 'Government Royalty + GST (Quarry Permit Statutory Fees)', uom: 'MT', qty: groupEQty, amount: permitRoyaltyGst, costPerUnit: groupEQty > 0 ? permitRoyaltyGst / groupEQty : 0 });

      // ── Group F: Miscellaneous Permit Charges (item 15) ──────────────────
      const groupFQty = totalQty;
      setGroupFRow({ slNo: 6, description: 'Miscellaneous Permit Charges', uom: 'MT', qty: groupFQty, amount: permitMisc, costPerUnit: groupFQty > 0 ? permitMisc / groupFQty : 0 });

      // ── Group H: Statutory Person Salary (Overhead Salaries) ─────────────
      const { data: overheadData } = await supabase
        .from('users')
        .select('id, full_name, salary, salary_department')
        .eq('is_overhead', true)
        .eq('is_active', true);
      const quarryOverheads = (overheadData || []).filter(u => !u.salary_department || u.salary_department === 'Quarry');
      const groupHQty = totalQty;
      let slNoH = 7;
      const hRows: CostRow[] = quarryOverheads.map(u => ({
        slNo: slNoH++,
        description: `Overhead Salary – ${u.full_name}`,
        uom: 'Month',
        qty: groupHQty,
        amount: u.salary || 0,
        costPerUnit: groupHQty > 0 ? (u.salary || 0) / groupHQty : 0,
      }));
      setGroupHRows(hRows);

      // ── Group I: Diesel Expense (net = Vendor Bills − Contractor Diesel) ─
      const DIESEL_KW = ['DIESEL','HSD','PETROL','FUEL OIL'];
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('amount, notes, reason')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .eq('transaction_type', 'expense');
      let dieselVendorBills = 0;
      accountsData?.forEach(acc => {
        if (acc.notes?.includes('[BILL_ENTRY]')) {
          const combined = `${acc.notes||''} ${acc.reason||''}`.toUpperCase();
          if (DIESEL_KW.some(kw => combined.includes(kw))) dieselVendorBills += parseFloat(acc.amount) || 0;
        }
      });
      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, given_price')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);
      let dieselDispatchedCost = 0;
      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase();
        const isExplosive = ['POWERGEL','POWER GEL','DETONATOR','NONEL','EDET','BLASTING','AMMONIUM','ANFO'].some(kw => name.includes(kw)) || name === 'PG' || name === 'ED' || name === 'EDET';
        if (!isExplosive) dieselDispatchedCost += (parseFloat(d.quantity_dispatched)||0) * (parseFloat(d.given_price)||0);
      });
      const dieselNetAmt = dieselVendorBills - dieselDispatchedCost;
      const groupIQty = totalQty;
      setGroupIRow({ slNo: slNoH, description: 'Diesel Expense (Net: Vendor Bills − Contractor Diesel)', uom: 'MT', qty: groupIQty, amount: dieselNetAmt, costPerUnit: groupIQty > 0 ? dieselNetAmt / groupIQty : 0 });

      // ── Crusher Contractors (CON-CRU-*) ────────────────────────────────
      const { data: crusherUsers } = await supabase
        .from('users')
        .select('full_name, employee_id')
        .ilike('employee_id', 'CON-CRU-%')
        .eq('is_active', true);

      const crusherBillRows: { name: string; amount: number }[] = [];
      if (crusherUsers && crusherUsers.length > 0) {
        for (const cu of crusherUsers) {
          const { data: bills } = await supabase
            .from('accounts')
            .select('amount')
            .eq('transaction_type', 'contractor_bill')
            .eq('customer_name', cu.full_name)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate);
          const billTotal = (bills || []).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
          crusherBillRows.push({ name: cu.full_name, amount: billTotal });
        }
      }
      setCrusherContractors(crusherBillRows);

      // ── Crusher Section Calculations ──────────────────────────────────
      const crusherTotalQty = qcQty + scQty;
      setCrusherQty(crusherTotalQty);

      // ── Crusher Group C: EB Power Charges (Calculated Sum Amount) ─────
      const { data: ebReports } = await supabase
        .from('eb_reports')
        .select('report_date, units_consumed')
        .gte('report_date', startDate)
        .lte('report_date', endDate);

      // Group by date
      const ebGrouped: Record<string, number> = {};
      (ebReports || []).forEach(r => {
        ebGrouped[r.report_date] = (ebGrouped[r.report_date] || 0) + (r.units_consumed || 0);
      });

      // Generate all dates in range and calculate sumAmount per day
      let ebCalcTotal = 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const RATE = 8.80;
      const FIXED = 616;
      const TAX = 0.05;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        const units = ebGrouped[dStr] || 0;
        const dailyBase = (units * RATE) + FIXED;
        const dailyTotal = dailyBase + (dailyBase * TAX);
        ebCalcTotal += dailyTotal;
      }

      setCrusherEBRow({
        slNo: 3,
        description: 'EB Power Charges (Calculated Sum: Units × ₹8.80 + ₹616 + 5% Tax)',
        uom: 'Days',
        qty: Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        amount: ebCalcTotal,
        costPerUnit: crusherTotalQty > 0 ? ebCalcTotal / crusherTotalQty : 0
      });

      // ── Crusher Group D: JCB Works (from accounts where Dept: JCB) ─────
      const { data: jcbAccounts } = await supabase
        .from('accounts')
        .select('amount, amount_given, notes, customer_name')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      
      const jcbTotalAmt = (jcbAccounts || [])
        .filter(a => (a.notes || '').includes('Dept: JCB'))
        .reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      
      setCrusherJCBRow({
        slNo: 4,
        description: 'JCB Works (Attributed to Crusher)',
        uom: '—',
        qty: 1,
        amount: jcbTotalAmt,
        costPerUnit: crusherTotalQty > 0 ? jcbTotalAmt / crusherTotalQty : 0
      });

      // ── Crusher Group E: Weight Bridge (from accounts where Dept: Weighbridge) ──
      const wbTotalAmt = (jcbAccounts || [])
        .filter(a => (a.notes || '').includes('Dept: Weighbridge') || (a.notes || '').includes('Dept: Weight Bridge'))
        .reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      
      setCrusherWBRow({
        slNo: 5,
        description: 'Weight Bridge Services',
        uom: '—',
        qty: 1,
        amount: wbTotalAmt,
        costPerUnit: crusherTotalQty > 0 ? wbTotalAmt / crusherTotalQty : 0
      });

      // ── Crusher Group F: Control Room (from accounts where Dept: Control Room) ──
      const crTotalAmt = (jcbAccounts || [])
        .filter(a => (a.notes || '').includes('Dept: Control Room'))
        .reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      
      setCrusherCRRow({
        slNo: 6,
        description: 'Control Room Services',
        uom: '—',
        qty: 1,
        amount: crTotalAmt,
        costPerUnit: crusherTotalQty > 0 ? crTotalAmt / crusherTotalQty : 0
      });

      // ── Crusher Group G: Miscellaneous (from accounts where Dept: Crusher) ─
      // Exclude contractor bills already in Group A
      const contractorNames = (crusherUsers || []).map(u => u.full_name);
      const miscTotalAmt = (jcbAccounts || [])
        .filter(a => 
          (a.notes || '').includes('Dept: Crusher') && 
          !contractorNames.includes(a.customer_name)
        )
        .reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      
      setCrusherMiscRow({
        slNo: 7,
        description: 'Crusher Miscellaneous Expenses',
        uom: '—',
        qty: 1,
        amount: miscTotalAmt,
        costPerUnit: crusherTotalQty > 0 ? miscTotalAmt / crusherTotalQty : 0
      });

      // ── Crusher Group H: GST (5% of products sale from invoices) ───────
      // Calculate total value of non-quarry items
      let productsValue = 0;
      invoices?.forEach(inv => {
        let items: any[] = [];
        try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; } catch {}
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const mat = (item.material || item.material_name || '').toLowerCase();
            if (!mat.includes('q-boulder') && !mat.includes('q-bolders')) {
              const qty = parseFloat(item.quantity) || (parseFloat(item.gross_weight) - parseFloat(item.empty_weight)) || 0;
              const rate = parseFloat(item.rate) || 0;
              productsValue += (qty * rate);
            }
          });
        }
      });
      setCrusherSalesValue(productsValue);
      const gstAmount = productsValue > 0 ? (productsValue - (productsValue / 1.05)) : 0; // Inclusive GST: Total * 5/105
      
      setCrusherGstRow({
        slNo: 8,
        description: 'GST (5% of Products Sale — Inclusive)',
        uom: 'Value',
        qty: productsValue,
        amount: gstAmount,
        costPerUnit: crusherTotalQty > 0 ? gstAmount / crusherTotalQty : 0
      });

      // ── Crusher Group B: Spares & Consumables ──────────────────────────
      const { data: crusherDispatch } = await supabase
        .from('inventory_dispatch')
        .select('item_name, unit, quantity_dispatched, given_price')
        .eq('department', 'Crusher Plant')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);

      const spareMap: Record<string, { unit: string; qty: number; rate: number; amount: number }> = {};
      (crusherDispatch || []).forEach(d => {
        const name = d.item_name || 'Unknown';
        const qty = parseFloat(d.quantity_dispatched) || 0;
        const rate = parseFloat(d.given_price) || 0;
        const amt = qty * rate;
        if (!spareMap[name]) spareMap[name] = { unit: d.unit || 'Nos', qty: 0, rate, amount: 0 };
        spareMap[name].qty += qty;
        spareMap[name].amount += amt;
        spareMap[name].rate = rate; 
      });
      setCrusherSpares(
        Object.entries(spareMap).map(([item, v]) => ({ item, ...v }))
      );
    } catch (err) {
      console.error('QuarryCrusherCostingReport fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── derived ────────────────────────────────────────────────────────────────
  const mainRow = groupARows[0];
  const breakdownRows = groupARows.slice(1);

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Q&C Costing');

    ws.addRow(['Quarry & Crusher Costing Details Report']).font = { name: 'Arial', size: 14, bold: true };
    ws.addRow([`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`]).font = { name: 'Arial', size: 11, italic: true };
    ws.addRow([]);

    const header = ws.addRow(['Sl.No.', 'Item Description', 'UOM', 'QTY', 'Amount (₹)', 'Cost / Unit (₹)']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Group A header
    const gRow = ws.addRow(['Group A: Quarry – Good Boulder Production']);
    ws.mergeCells(`A${gRow.number}:F${gRow.number}`);
    gRow.font = { bold: true, color: { argb: 'FF1D4ED8' } };
    gRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; });

    // main consolidated row
    if (mainRow) {
      const r = ws.addRow([mainRow.slNo, mainRow.description, mainRow.uom, mainRow.qty, mainRow.amount, mainRow.costPerUnit]);
      r.font = { bold: true };
      [4, 5, 6].forEach(col => { r.getCell(col).alignment = { horizontal: 'right' }; });
    }

    // breakdown sub-rows
    breakdownRows.forEach(row => {
      const r = ws.addRow(['', row.description, row.uom, row.qty, row.amount, row.costPerUnit]);
      r.font = { italic: true, color: { argb: 'FF64748B' } };
      [4, 5, 6].forEach(col => { r.getCell(col).alignment = { horizontal: 'right' }; });
    });

    ws.columns = [
      { width: 8 }, { width: 55 }, { width: 8 }, { width: 16 }, { width: 18 }, { width: 18 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QC_Costing_${startDate}_to_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Quarry & Crusher Costing Details Report', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`, 14, 23);

    const rows: any[] = [];

    // Group A header
    rows.push([{
      content: 'Group A: Quarry – Good Boulder Production',
      colSpan: 6,
      styles: { fillColor: [219, 234, 254], textColor: [29, 78, 216], fontStyle: 'bold' }
    }]);

    // main consolidated row
    if (mainRow) {
      rows.push([
        mainRow.slNo,
        mainRow.description,
        mainRow.uom,
        fmt(mainRow.qty),
        fmt(mainRow.amount),
        fmt(mainRow.costPerUnit),
      ]);
    }

    // breakdown
    breakdownRows.forEach(row => {
      rows.push([
        { content: '', styles: { textColor: [100, 116, 139] } },
        { content: row.description, styles: { fontStyle: 'italic', textColor: [100, 116, 139], fontSize: 8 } },
        { content: row.uom, styles: { textColor: [100, 116, 139], fontSize: 8 } },
        { content: fmt(row.qty), styles: { halign: 'right', textColor: [100, 116, 139], fontSize: 8 } },
        { content: fmt(row.amount), styles: { halign: 'right', textColor: [100, 116, 139], fontSize: 8 } },
        { content: fmt(row.costPerUnit), styles: { halign: 'right', textColor: [100, 116, 139], fontSize: 8 } },
      ]);
    });

    autoTable(doc, {
      head: [['Sl.No.', 'Item Description', 'UOM', 'QTY', 'Amount (₹)', 'Cost/Unit (₹)']],
      body: rows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 38 },
        5: { halign: 'right', cellWidth: 38 },
      },
    });

    doc.save(`QC_Costing_${startDate}_to_${endDate}.pdf`);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Quarry &amp; Crusher Costing Details
              </h3>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">
                Consolidated Production Cost Analysis
              </p>
            </div>
          </div>

          {/* controls */}
          <div className="flex flex-wrap items-center gap-4 p-1">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-slate-400 font-black text-xs">TO</span>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <button onClick={exportToExcel} className="px-4 py-2 bg-white text-emerald-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5 text-emerald-500" /> EXCEL
              </button>
              <button onClick={exportToPDF} className="px-4 py-2 bg-white text-rose-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-rose-50">
                <Download className="w-3.5 h-3.5 text-rose-500" /> PDF
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white border-b border-slate-700">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Sl.No</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Item Description</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">UOM</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">QTY</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Amount (₹)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Cost / Unit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">

              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">
                    Loading costing data…
                  </td>
                </tr>
              ) : (
                <>
                  {/* Group A header */}
                  <tr className="bg-blue-50 text-blue-900 border-t-2 border-blue-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">
                      Group A: Quarry – Good Boulder Production
                    </td>
                  </tr>

                  {/* Consolidated main row */}
                  {mainRow && (
                    <tr className="bg-blue-50/40 hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{mainRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{mainRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{mainRow.uom}</td>
                      <td className="px-6 py-3 text-right text-blue-800 text-xs font-black">
                        {fmt(mainRow.qty)}
                      </td>
                      <td className="px-6 py-3 text-right text-blue-900 text-xs font-black">
                        {fmt(mainRow.amount)}
                      </td>
                      <td className="px-6 py-3 text-right text-indigo-700 text-xs font-black">
                        {fmt(mainRow.costPerUnit)}
                      </td>
                    </tr>
                  )}

                  {/* Breakdown sub-rows */}
                  {breakdownRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-2 text-slate-300 text-xs">–</td>
                      <td className="px-6 py-2 text-slate-500 text-xs italic">{row.description}</td>
                      <td className="px-6 py-2 text-center text-slate-400 text-xs">{row.uom}</td>
                      <td className="px-6 py-2 text-right text-slate-600 text-xs">{fmt(row.qty)}</td>
                      <td className="px-6 py-2 text-right text-slate-600 text-xs">{fmt(row.amount)}</td>
                      <td className="px-6 py-2 text-right text-slate-500 text-xs">{fmt(row.costPerUnit)}</td>
                    </tr>
                  ))}

                  {/* ── Group A subtotal ── */}
                  <tr className="bg-blue-100/60 border-t-2 border-blue-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-blue-700">
                      Group A Subtotal:
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-blue-800 font-black">
                      {fmt(mainRow?.qty ?? 0)} MT
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-blue-900 font-black">
                      {fmt(mainRow?.amount ?? 0)}
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-700 font-black">
                      ₹{fmt(mainRow?.costPerUnit ?? 0)} / MT
                    </td>
                  </tr>

                  {/* ── Group B: Soil / Weather Rock ── */}
                  <tr className="bg-orange-50 text-orange-900 border-t-2 border-orange-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">
                      Group B: Soil / Weather Rock Production Cost
                    </td>
                  </tr>
                  {groupBRow && (
                    <tr className="bg-orange-50/40 hover:bg-orange-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupBRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupBRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupBRow.uom}</td>
                      <td className="px-6 py-3 text-right text-orange-800 text-xs font-black">{fmt(groupBRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-orange-900 text-xs font-black">{fmt(groupBRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-amber-700 text-xs font-black">{fmt(groupBRow.costPerUnit)}</td>
                    </tr>
                  )}
                  {groupBBreakdown.map((row, i) => (
                    <tr key={`b-${i}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-2 text-slate-300 text-xs">–</td>
                      <td className="px-6 py-2 text-slate-500 text-xs italic">{row.description}</td>
                      <td className="px-6 py-2 text-center text-slate-400 text-xs">{row.uom}</td>
                      <td className="px-6 py-2 text-right text-slate-600 text-xs">{fmt(row.qty)}</td>
                      <td className="px-6 py-2 text-right text-slate-600 text-xs">{fmt(row.amount)}</td>
                      <td className="px-6 py-2 text-right text-slate-500 text-xs">{fmt(row.costPerUnit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-100/60 border-t-2 border-orange-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-orange-700">Group B Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-orange-800 font-black">{fmt(groupBRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-orange-900 font-black">{fmt(groupBRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-700 font-black">₹{fmt(groupBRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group C: Boulder Rehandling ── */}
                  <tr className="bg-red-50 text-red-900 border-t-2 border-red-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group C: Boulder Rehandling — Stock → Crusher</td>
                  </tr>
                  {groupCRow && (
                    <tr className="bg-red-50/40 hover:bg-red-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupCRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupCRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupCRow.uom}</td>
                      <td className="px-6 py-3 text-right text-red-800 text-xs font-black">{fmt(groupCRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-red-900 text-xs font-black">{fmt(groupCRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-rose-700 text-xs font-black">{fmt(groupCRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-red-100/60 border-t-2 border-red-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-red-700">Group C Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-red-800 font-black">{fmt(groupCRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-red-900 font-black">{fmt(groupCRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-700 font-black">₹{fmt(groupCRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group D: Crusher Excavator Additional Work ── */}
                  <tr className="bg-sky-50 text-sky-900 border-t-2 border-sky-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Excavator Additional Work in Crusher</td>
                  </tr>
                  {groupDRow && (
                    <tr className="bg-sky-50/40 hover:bg-sky-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupDRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupDRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupDRow.uom}</td>
                      <td className="px-6 py-3 text-right text-sky-800 text-xs font-black">{fmt(groupDRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-sky-900 text-xs font-black">{fmt(groupDRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-cyan-700 text-xs font-black">{fmt(groupDRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-sky-100/60 border-t-2 border-sky-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-sky-700">Group D Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-800 font-black">{fmt(groupDRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-900 font-black">{fmt(groupDRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-cyan-700 font-black">₹{fmt(groupDRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group E: Government Royalty + GST ── */}
                  <tr className="bg-emerald-50 text-emerald-900 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Government Royalty + GST (Quarry Permit)</td>
                  </tr>
                  {groupERow && (
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupERow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupERow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupERow.uom}</td>
                      <td className="px-6 py-3 text-right text-emerald-800 text-xs font-black">{fmt(groupERow.qty)}</td>
                      <td className="px-6 py-3 text-right text-emerald-900 text-xs font-black">{fmt(groupERow.amount)}</td>
                      <td className="px-6 py-3 text-right text-green-700 text-xs font-black">{fmt(groupERow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-emerald-100/60 border-t-2 border-emerald-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-emerald-700">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-800 font-black">{fmt(groupERow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-900 font-black">{fmt(groupERow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-green-700 font-black">₹{fmt(groupERow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group F: Miscellaneous Permit Charges ── */}
                  <tr className="bg-yellow-50 text-yellow-900 border-t-2 border-yellow-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group F: Miscellaneous Permit Charges</td>
                  </tr>
                  {groupFRow && (
                    <tr className="bg-yellow-50/40 hover:bg-yellow-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupFRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupFRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupFRow.uom}</td>
                      <td className="px-6 py-3 text-right text-yellow-800 text-xs font-black">{fmt(groupFRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-yellow-900 text-xs font-black">{fmt(groupFRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-amber-700 text-xs font-black">{fmt(groupFRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-yellow-100/60 border-t-2 border-yellow-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-yellow-700">Group F Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-yellow-800 font-black">{fmt(groupFRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-yellow-900 font-black">{fmt(groupFRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-700 font-black">₹{fmt(groupFRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group H: Statutory Person Salary (Overhead Salaries) ── */}
                  {groupHRows.length > 0 && (
                    <>
                      <tr className="bg-violet-50 text-violet-900 border-t-2 border-violet-200">
                        <td colSpan={6} className="px-6 py-3 font-black text-xs">Group H: Statutory Person Salary (Overhead)</td>
                      </tr>
                      {groupHRows.map((row, i) => (
                        <tr key={`h-${i}`} className="hover:bg-violet-50/40 transition-colors">
                          <td className="px-6 py-3 text-slate-400 text-xs">{row.slNo}</td>
                          <td className="px-6 py-3 text-slate-800 text-xs">{row.description}</td>
                          <td className="px-6 py-3 text-center text-slate-500 text-xs">{row.uom}</td>
                          <td className="px-6 py-3 text-right text-violet-700 text-xs font-bold">{fmt(row.qty)}</td>
                          <td className="px-6 py-3 text-right text-violet-900 text-xs font-bold">{fmt(row.amount)}</td>
                          <td className="px-6 py-3 text-right text-purple-700 text-xs font-bold">{fmt(row.costPerUnit)}</td>
                        </tr>
                      ))}
                      <tr className="bg-violet-100/60 border-t-2 border-violet-200 font-bold">
                        <td colSpan={3} className="px-6 py-3 text-right text-xs text-violet-700">Group H Subtotal:</td>
                        <td className="px-6 py-3 text-right text-xs text-violet-800 font-black">{fmt(groupHRows[0]?.qty ?? 0)} MT</td>
                        <td className="px-6 py-3 text-right text-xs text-violet-900 font-black">{fmt(groupHRows.reduce((s, r) => s + r.amount, 0))}</td>
                        <td className="px-6 py-3 text-right text-xs text-purple-700 font-black">₹{fmt(groupHRows[0]?.qty > 0 ? groupHRows.reduce((s, r) => s + r.amount, 0) / groupHRows[0].qty : 0)} / MT</td>
                      </tr>
                    </>
                  )}

                  {/* ── Group I: Diesel Expense (Net) ── */}
                  <tr className="bg-slate-100 text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group I: Diesel Expense (Net = Vendor Bills − Contractor Diesel)</td>
                  </tr>
                  {groupIRow && (
                    <tr className="bg-slate-50/60 hover:bg-slate-100 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">{groupIRow.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupIRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupIRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-700 text-xs font-black">{fmt(groupIRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-black">{fmt(groupIRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-black">{fmt(groupIRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-200/60 border-t-2 border-slate-300 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-slate-600">Group I Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-700 font-black">{fmt(groupIRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-900 font-black">{fmt(groupIRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-600 font-black">₹{fmt(groupIRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── GRAND TOTAL: Total Quarry Cost ── */}
                  {(() => {
                    const gbQty = mainRow?.qty ?? 0;
                    const totalAmt =
                      (mainRow?.amount ?? 0) +
                      (groupBRow?.amount ?? 0) +
                      (groupCRow?.amount ?? 0) +
                      (groupDRow?.amount ?? 0) +
                      (groupERow?.amount ?? 0) +
                      (groupFRow?.amount ?? 0) +
                      groupHRows.reduce((s, r) => s + r.amount, 0) +
                      (groupIRow?.amount ?? 0);
                    const cpu = gbQty > 0 ? totalAmt / gbQty : 0;
                    return (
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={2} className="px-6 py-5 font-black text-sm tracking-wide">Total Quarry Cost</td>
                        <td className="px-6 py-5 text-center text-slate-300 text-xs font-bold">MT</td>
                        <td className="px-6 py-5 text-right font-black text-sm">{fmt(gbQty)} MT</td>
                        <td className="px-6 py-5 text-right font-black text-sm text-emerald-300">₹{fmt(totalAmt)}</td>
                        <td className="px-6 py-5 text-right font-black text-sm text-yellow-300">₹{fmt(cpu)} / MT</td>
                      </tr>
                    );
                  })()}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Total Quarry Cost Summary Cards ── */}
        {!loading && mainRow && (() => {
          const gbQty = mainRow.qty;
          const totalAmt =
            (mainRow.amount) +
            (groupBRow?.amount ?? 0) +
            (groupCRow?.amount ?? 0) +
            (groupDRow?.amount ?? 0) +
            (groupERow?.amount ?? 0) +
            (groupFRow?.amount ?? 0) +
            groupHRows.reduce((s, r) => s + r.amount, 0) +
            (groupIRow?.amount ?? 0);
          const cpu = gbQty > 0 ? totalAmt / gbQty : 0;
          return (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">GB Production QTY</span>
                <span className="text-2xl font-black text-blue-900">{fmt(gbQty)} MT</span>
                <span className="text-xs text-blue-400">Q-C + Q-S + Q-Sales (Group A)</span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Quarry Cost</span>
                <span className="text-2xl font-black text-white">₹{fmt(totalAmt)}</span>
                <span className="text-xs text-slate-400">Sum of all groups A through I</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600">Cost Per MT (Total / GB Qty)</span>
                <span className="text-2xl font-black text-yellow-900">₹{fmt(cpu)}</span>
                <span className="text-xs text-yellow-500">Total Amount ÷ GB Production QTY</span>
              </div>
            </div>
          );
        })()}
      </div>

    {/* ══════ CRUSHER COST TABLE ══════ */}
    <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 mt-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-rose-700 rounded-2xl flex items-center justify-center shadow-lg">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Crusher Cost Details</h3>
          <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">Group-wise crusher operational cost analysis</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-rose-900 text-white border-b border-rose-800">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Sl.No</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Item Description</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">UOM</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">QTY (GB)</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Amount (₹)</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Cost / Unit (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">Loading crusher data…</td></tr>
            ) : (() => {
              const gbQty = crusherQty;
              const totalCrusherManpower = crusherContractors.reduce((s, c) => s + c.amount, 0);
              const totalCrusherSpares = crusherSpares.reduce((s, c) => s + c.amount, 0);
              const totalCrusherEB = crusherEBRow?.amount ?? 0;
              const totalCrusherJCB = crusherJCBRow?.amount ?? 0;
              const totalCrusherWB = crusherWBRow?.amount ?? 0;
              const totalCrusherCR = crusherCRRow?.amount ?? 0;
              const totalCrusherMisc = crusherMiscRow?.amount ?? 0;
              const totalCrusherGst = crusherGstRow?.amount ?? 0;
              const totalCrusherAll = totalCrusherManpower + totalCrusherSpares + totalCrusherEB + totalCrusherJCB + totalCrusherWB + totalCrusherCR + totalCrusherMisc + totalCrusherGst;
              const crusherManpowerCpu = gbQty > 0 ? totalCrusherManpower / gbQty : 0;
              const crusherSparesCpu = gbQty > 0 ? totalCrusherSpares / gbQty : 0;
              const crusherEBCpu = gbQty > 0 ? totalCrusherEB / gbQty : 0;
              const crusherJCBCpu = gbQty > 0 ? totalCrusherJCB / gbQty : 0;
              const crusherWBCpu = gbQty > 0 ? totalCrusherWB / gbQty : 0;
              const crusherCRCpu = gbQty > 0 ? totalCrusherCR / gbQty : 0;
              const crusherMiscCpu = gbQty > 0 ? totalCrusherMisc / gbQty : 0;
              const crusherGstCpu = gbQty > 0 ? totalCrusherGst / gbQty : 0;
              const crusherTotalCpu = gbQty > 0 ? totalCrusherAll / gbQty : 0;
              return (
                <>
                  {/* Crusher Group A: Manpower */}
                  <tr className="bg-rose-50 text-rose-900 border-t-2 border-rose-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group A: Crusher Manpower (Contractor Bills)</td>
                  </tr>
                  {crusherContractors.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400 text-xs">No crusher contractor bills found for this period.</td></tr>
                  ) : (
                    crusherContractors.map((c, i) => {
                      const cpu = gbQty > 0 ? c.amount / gbQty : 0;
                      return (
                        <tr key={i} className="hover:bg-rose-50/30 transition-colors">
                          <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-6 py-3 text-slate-900 text-xs font-black">{c.name} — Crusher Contractor Bill</td>
                          <td className="px-6 py-3 text-center text-slate-500 text-xs">MT</td>
                          <td className="px-6 py-3 text-right text-rose-700 text-xs font-bold">{fmt(gbQty)}</td>
                          <td className="px-6 py-3 text-right text-rose-900 text-xs font-bold">{fmt(c.amount)}</td>
                          <td className="px-6 py-3 text-right text-pink-700 text-xs font-bold">{fmt(cpu)}</td>
                        </tr>
                      );
                    })
                  )}
                  {/* Group A subtotal */}
                  <tr className="bg-rose-100/60 border-t-2 border-rose-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-rose-700">Group A Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-900 font-black">{fmt(totalCrusherManpower)}</td>
                    <td className="px-6 py-3 text-right text-xs text-pink-700 font-black">₹{fmt(crusherManpowerCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group B: Spares & Consumables */}
                  <tr className="bg-amber-50 text-amber-900 border-t-2 border-amber-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group B: Spares &amp; Consumables (Inventory → Crusher Plant)</td>
                  </tr>
                  {crusherSpares.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400 text-xs">No inventory items dispatched to Crusher Plant for this period.</td></tr>
                  ) : (
                    crusherSpares.map((s, i) => (
                      <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-6 py-3 text-slate-900 text-xs font-black">{s.item}</td>
                        <td className="px-6 py-3 text-center text-slate-500 text-xs">{s.unit}</td>
                        <td className="px-6 py-3 text-right text-amber-700 text-xs font-bold">{fmt(s.qty)}</td>
                        <td className="px-6 py-3 text-right text-amber-900 text-xs font-bold">{fmt(s.amount)}</td>
                        <td className="px-6 py-3 text-right text-yellow-700 text-xs font-bold">{fmt(gbQty > 0 ? s.amount / gbQty : 0)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-amber-100/60 border-t-2 border-amber-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-amber-700">Group B Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-900 font-black">{fmt(totalCrusherSpares)}</td>
                    <td className="px-6 py-3 text-right text-xs text-yellow-700 font-black">₹{fmt(crusherSparesCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group C: EB Power Charges */}
                  <tr className="bg-indigo-50 text-indigo-900 border-t-2 border-indigo-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group C: EB Power Charges</td>
                  </tr>
                  <tr className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">EB Daily Calculator Sum (Units + Fixed + Tax)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">Days</td>
                    <td className="px-6 py-3 text-right text-indigo-700 text-xs font-bold">{fmt(crusherQty)}</td>
                    <td className="px-6 py-3 text-right text-indigo-900 text-xs font-bold">{fmt(totalCrusherEB)}</td>
                    <td className="px-6 py-3 text-right text-indigo-700 text-xs font-bold">{fmt(crusherEBCpu)}</td>
                  </tr>
                  <tr className="bg-indigo-100/60 border-t-2 border-indigo-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-indigo-700">Group C Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-900 font-black">{fmt(totalCrusherEB)}</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-700 font-black">₹{fmt(crusherEBCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group D: JCB Works */}
                  <tr className="bg-amber-50 text-amber-900 border-t-2 border-amber-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: JCB Works</td>
                  </tr>
                  <tr className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">JCB Service Payments (Consolidated)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-amber-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-amber-900 text-xs font-bold">{fmt(totalCrusherJCB)}</td>
                    <td className="px-6 py-3 text-right text-amber-700 text-xs font-bold">{fmt(crusherJCBCpu)}</td>
                  </tr>
                  <tr className="bg-amber-100/60 border-t-2 border-amber-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-amber-700">Group D Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-900 font-black">{fmt(totalCrusherJCB)}</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-700 font-black">₹{fmt(crusherJCBCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group E: Weight Bridge */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Weight Bridge</td>
                  </tr>
                  <tr className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Weight Bridge Service Payments</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(totalCrusherWB)}</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(crusherWBCpu)}</td>
                  </tr>
                  <tr className="bg-slate-100/60 border-t-2 border-slate-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-slate-700">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-900 font-black">{fmt(totalCrusherWB)}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-700 font-black">₹{fmt(crusherWBCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group F: Control Room */}
                  <tr className="bg-emerald-50 text-emerald-900 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group F: Control Room</td>
                  </tr>
                  <tr className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Control Room Service Payments</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-emerald-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-emerald-900 text-xs font-bold">{fmt(totalCrusherCR)}</td>
                    <td className="px-6 py-3 text-right text-emerald-700 text-xs font-bold">{fmt(crusherCRCpu)}</td>
                  </tr>
                  <tr className="bg-emerald-100/60 border-t-2 border-emerald-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-emerald-700">Group F Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-900 font-black">{fmt(totalCrusherCR)}</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-700 font-black">₹{fmt(crusherCRCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group G: Miscellaneous */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group G: Miscellaneous</td>
                  </tr>
                  <tr className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Crusher Miscellaneous Expenses</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(totalCrusherMisc)}</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(crusherMiscCpu)}</td>
                  </tr>
                  <tr className="bg-slate-100/60 border-t-2 border-slate-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-slate-700">Group G Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-900 font-black">{fmt(totalCrusherMisc)}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-700 font-black">₹{fmt(crusherMiscCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group H: GST */}
                  <tr className="bg-rose-50 text-rose-900 border-t-2 border-rose-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group H: GST</td>
                  </tr>
                  <tr className="hover:bg-rose-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Total GST (5% of Products Sale)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">Value</td>
                    <td className="px-6 py-3 text-right text-rose-700 text-xs font-bold">{fmt(crusherSalesValue)}</td>
                    <td className="px-6 py-3 text-right text-rose-900 text-xs font-bold">{fmt(totalCrusherGst)}</td>
                    <td className="px-6 py-3 text-right text-rose-700 text-xs font-bold">{fmt(crusherGstCpu)}</td>
                  </tr>
                  <tr className="bg-rose-100/60 border-t-2 border-rose-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-rose-700">Group H Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-800 font-black">₹{fmt(crusherSalesValue)}</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-900 font-black">{fmt(totalCrusherGst)}</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-700 font-black">₹{fmt(crusherGstCpu)} / MT</td>
                  </tr>

                  {/* Crusher Grand Total */}
                  <tr className="bg-rose-900 text-white">
                    <td colSpan={2} className="px-6 py-5 font-black text-sm tracking-wide">Total Crusher Cost</td>
                    <td className="px-6 py-5 text-center text-rose-300 text-xs font-bold">MT</td>
                    <td className="px-6 py-5 text-right font-black text-sm">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-emerald-300">₹{fmt(totalCrusherAll)}</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-yellow-300">₹{fmt(crusherTotalCpu)} / MT</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Crusher Summary Cards */}
      {!loading && (
        (() => {
          const gbQty = crusherQty;
          const totalCrusherAmt = crusherContractors.reduce((s, c) => s + c.amount, 0) + 
                                  crusherSpares.reduce((s, c) => s + c.amount, 0) +
                                  (crusherEBRow?.amount ?? 0) +
                                  (crusherJCBRow?.amount ?? 0) +
                                  (crusherWBRow?.amount ?? 0) +
                                  (crusherCRRow?.amount ?? 0) +
                                  (crusherMiscRow?.amount ?? 0) +
                                  (crusherGstRow?.amount ?? 0);
          const cpu = gbQty > 0 ? totalCrusherAmt / gbQty : 0;
          return (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Crusher Total QTY</span>
                <span className="text-2xl font-black text-rose-900">{fmt(gbQty)} MT</span>
                <span className="text-xs text-rose-400">Q-C + S-C combined</span>
              </div>
              <div className="bg-rose-900 border border-rose-800 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Crusher Cost</span>
                <span className="text-2xl font-black text-white">₹{fmt(totalCrusherAmt)}</span>
                <span className="text-xs text-rose-300">Sum of all crusher groups</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600">Cost Per MT</span>
                <span className="text-2xl font-black text-yellow-900">₹{fmt(cpu)}</span>
                <span className="text-xs text-yellow-500">Total Crusher Cost ÷ GB QTY</span>
              </div>
            </div>
          );
        })()
      )}
    </div>
  </div>
);
}
