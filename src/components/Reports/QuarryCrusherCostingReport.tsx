import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Download, Building2, Settings2 } from 'lucide-react';
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
  const [crusherExcRow, setCrusherExcRow] = useState<CostRow | null>(null);
  const [groupERow, setGroupERow] = useState<CostRow | null>(null);
  const [groupFRow, setGroupFRow] = useState<CostRow | null>(null);
  const [groupHRows, setGroupHRows] = useState<CostRow[]>([]);
  const [groupIRow, setGroupIRow] = useState<CostRow | null>(null);
  const [groupJRow, setGroupJRow] = useState<CostRow | null>(null);
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

  // Overhead table state
  const [overheadGroupARows, setOverheadGroupARows] = useState<CostRow[]>([]);
  const [overheadGroupBRow, setOverheadGroupBRow] = useState<CostRow | null>(null);
  const [overheadGroupCRow, setOverheadGroupCRow] = useState<CostRow | null>(null);
  const [overheadGroupDRow, setOverheadGroupDRow] = useState<CostRow | null>(null);

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

      // ── Excavator Additional Work in Crusher (item 8) ──────────
      const CRUSHER_EXC_RATE = 1650;
      const crusherExcHours = loadingData
        ?.filter(r => ['SBBM Slurry Work','SBBM Stockyard Good Boulders','Aggregates rehandling/ Aggregate Loading','Crusher machine works'].includes(r.material_type))
        .reduce((s, r) => { const run = (r.ending_hours||0)-(r.starting_hours||0); return s+(run>0?run:0); }, 0) ?? 0;
      const crusherExcAmt = crusherExcHours * CRUSHER_EXC_RATE;
      let crusherTotalQty = qcQty + scQty; // Q-C + S-C
      setCrusherExcRow({
        slNo: 0,
        description: `Excavator Additional Work in Crusher: ${fmt(crusherExcHours)} HRS × ₹${CRUSHER_EXC_RATE}`,
        uom: 'MT', qty: crusherTotalQty, amount: crusherExcAmt, costPerUnit: crusherTotalQty > 0 ? crusherExcAmt / crusherTotalQty : 0,
      });

      // ── Group E: Government Royalty + GST (item 14 — Quarry Permit) ──────
      // Fetch all permits and filter in JS so null payment_date records are included
      const { data: allPermits, error: permitError } = await supabase
        .from('permits')
        .select('*');

      if (permitError) console.error('Permit data fetch error:', permitError);

      // Filter by payment_date in range, OR by approval_date in range if payment_date is null
      const permitData = (allPermits || []).filter(p => {
        const pd = p.payment_date;
        const ad = p.approval_date;
        if (pd) return pd >= startDate && pd <= endDate;
        if (ad) return ad >= startDate && ad <= endDate;
        return false;
      });

      console.log('[QuarryCrusherCosting] allPermits:', allPermits?.length, 'filtered:', permitData.length, 'range:', startDate, '→', endDate);

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
      setGroupERow({ slNo: 5, description: 'Quarry Permit (Statutory Fees + GST) (item 14)', uom: 'MT', qty: groupEQty, amount: permitRoyaltyGst, costPerUnit: groupEQty > 0 ? permitRoyaltyGst / groupEQty : 0 });

      // ── Group F: Miscellaneous Permit Charges (item 15) ──────────────────
      const groupFQty = totalQty;
      setGroupFRow({ slNo: 6, description: 'Miscellaneous Permit Charges (item 15)', uom: 'MT', qty: groupFQty, amount: permitMisc, costPerUnit: groupFQty > 0 ? permitMisc / groupFQty : 0 });

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
        .select('item_name, quantity_dispatched, given_price, unit')
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
      setGroupIRow({ slNo: slNoH++, description: 'Diesel Expense (Net: Vendor Bills − Contractor Diesel)', uom: 'MT', qty: groupIQty, amount: dieselNetAmt, costPerUnit: groupIQty > 0 ? dieselNetAmt / groupIQty : 0 });

      // ── Group J: Additional Explosive Cost (Group D Subtotal from Module) ──
      const EXPLOSIVE_KW = ['EXPLOSIVE', 'POWERGEL', 'POWER GEL', 'DETONATOR', 'NONEL', ' ED ', 'EDET', ' PG ', 'BLASTING', 'AMMONIUM', 'ANFO'];
      let explosiveVendorBills = 0;
      accountsData?.forEach(acc => {
        if (acc.notes?.includes('[BILL_ENTRY]')) {
          const combined = `${acc.notes||''} ${acc.reason||''}`.toUpperCase();
          if (EXPLOSIVE_KW.some(kw => combined.includes(kw))) explosiveVendorBills += parseFloat(acc.amount) || 0;
        }
      });

      let pgGivenPrice = 0, edGivenPrice = 0, edetGivenPrice = 0, n3GivenPrice = 0, n4GivenPrice = 0;
      let totalDispatchedPgBoxes = 0, totalDispatchedEd = 0, totalDispatchedEdet = 0, totalDispatchedN3 = 0, totalDispatchedN4 = 0;
      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase().trim();
        const qty = parseFloat(d.quantity_dispatched) || 0;
        const price = parseFloat(d.given_price) || 0;
        const unit = (d.unit || '').toLowerCase();
        const isPG   = name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
        const isEDET = name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET') || name.includes('ELECTRONIC DET') || name.includes('E DETONATOR');
        const isED   = !isEDET && (name === 'ED' || name.startsWith('ELEC DET') || name.includes('ELECTRIC DET') || (name.length <= 4 && name.includes('ED')));
        const isN3   = name.includes('NONEL') && (name.includes('3M') || name.includes('3 M') || name.includes('3MTR') || name.includes('3 MTR'));
        const isN4   = name.includes('NONEL') && (name.includes('4M') || name.includes('4 M') || name.includes('4MTR') || name.includes('4 MTR'));
        if (isPG) { pgGivenPrice = (unit === 'nos' ? price * 200 : price); totalDispatchedPgBoxes += (unit === 'nos' ? qty / 200 : qty); }
        else if (isEDET) { edetGivenPrice = price; totalDispatchedEdet += qty; }
        else if (isED) { edGivenPrice = price; totalDispatchedEd += qty; }
        else if (isN3) { n3GivenPrice = price; totalDispatchedN3 += qty; }
        else if (isN4) { n4GivenPrice = price; totalDispatchedN4 += qty; }
      });


      // ── Group J: Additional Explosive Cost (Group D Subtotal from Module) ──

      let wrExplosivesOriginalCost = 0, wrPg = 0, wrEd = 0, wrEdet = 0, wrN3 = 0, wrN4 = 0;
      blastingData?.forEach(b => {
        const pg = (b.pg_unit === 'nos' ? (b.pg_nos || 0) / 200 : (b.pg_nos || 0));
        wrPg += pg; wrEd += (b.ed_nos || 0); wrEdet += (b.edet_nos || 0); wrN3 += (b.nonel_3m_nos || 0); wrN4 += (b.nonel_4m_nos || 0);
        wrExplosivesOriginalCost += (pg * getPriceAtDate('PG', b.date)) + ((b.ed_nos||0) * getPriceAtDate('ED', b.date)) + ((b.edet_nos||0) * getPriceAtDate('EDET', b.date)) + ((b.nonel_3m_nos||0) * getPriceAtDate('N3', b.date)) + ((b.nonel_4m_nos||0) * getPriceAtDate('N4', b.date));
      });

      const gbPg = Math.max(0, totalDispatchedPgBoxes - wrPg), gbEd = Math.max(0, totalDispatchedEd - wrEd), gbEdet = Math.max(0, totalDispatchedEdet - wrEdet), gbN3 = Math.max(0, totalDispatchedN3 - wrN3), gbN4 = Math.max(0, totalDispatchedN4 - wrN4);
      const gbExplosivesCost = (gbPg * pgGivenPrice) + (gbEd * edGivenPrice) + (gbEdet * edetGivenPrice) + (gbN3 * n3GivenPrice) + (gbN4 * n4GivenPrice);
      const addExpCost = explosiveVendorBills - wrExplosivesOriginalCost - gbExplosivesCost;
      setGroupJRow({ slNo: slNoH, description: 'Additional Explosive Cost (Net: Vendor Bills − WR Cost − GB Contractor)', uom: 'MT', qty: totalQty, amount: addExpCost, costPerUnit: totalQty > 0 ? addExpCost / totalQty : 0 });

      // ── Overheads Table Logic ──────────────────────────────────────────
      // Group A: Staff Salaries (Except Manikandan)
      const overheadAUsers = (overheadData || []).filter(u => !u.full_name.toLowerCase().includes('manikandan'));
      const rowsA = overheadAUsers.map((u, i) => ({
        slNo: i + 1,
        description: `Staff Salary – ${u.full_name}`,
        uom: 'Month',
        qty: 1,
        amount: u.salary || 0,
        costPerUnit: totalQty > 0 ? (u.salary || 0) / totalQty : 0
      }));
      setOverheadGroupARows(rowsA);

      // Fetch all dispatch for Group B
      const { data: allDispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, given_price, department')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);

      // Group B: Conveyance/Vehicle (Diesel for Administration)
      const dieselAdmin = (allDispatchData || []).filter(d => 
        (d.department === 'Administration') && 
        (d.item_name || '').toUpperCase().includes('DIESEL')
      );
      const dieselAdminAmt = dieselAdmin.reduce((s, d) => s + (parseFloat(d.quantity_dispatched || '0') * parseFloat(d.given_price || '0')), 0);
      setOverheadGroupBRow({
        slNo: 1,
        description: 'Conveyance Vehicle Charges (Diesel - Administration)',
        uom: 'Ltrs',
        qty: dieselAdmin.reduce((s, d) => s + (parseFloat(d.quantity_dispatched || '0')), 0),
        amount: dieselAdminAmt,
        costPerUnit: totalQty > 0 ? dieselAdminAmt / totalQty : 0
      });

      // Group C & D: From Accounts
      const { data: allAccountsData } = await supabase
        .from('accounts')
        .select('amount, amount_given, notes, transaction_type')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      const adminAccounts = (allAccountsData || []).filter(a => 
        a.transaction_type === 'expense' && 
        (a.notes || '').includes('Dept: Administration')
      );

      // Group C: Administration amounts (Excluding Miscellaneous)
      const adminGeneral = adminAccounts.filter(a => !(a.notes || '').includes('Item: Miscellaneous'));
      const adminGeneralAmt = adminGeneral.reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      setOverheadGroupCRow({
        slNo: 2,
        description: 'Cash Booking',
        uom: '—',
        qty: 1,
        amount: adminGeneralAmt,
        costPerUnit: totalQty > 0 ? adminGeneralAmt / totalQty : 0
      });

      // Group D: Miscellaneous given from administrative department
      const adminMisc = adminAccounts.filter(a => (a.notes || '').includes('Item: Miscellaneous'));
      const adminMiscAmt = adminMisc.reduce((s, a) => s + (parseFloat(a.amount_given) || parseFloat(a.amount) || 0), 0);
      setOverheadGroupDRow({
        slNo: 3,
        description: 'Miscellaneous Expenses (Administration)',
        uom: '—',
        qty: 1,
        amount: adminMiscAmt,
        costPerUnit: totalQty > 0 ? adminMiscAmt / totalQty : 0
      });

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
      crusherTotalQty = qcQty + scQty;
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
    const ws = wb.addWorksheet('Quarry & Crusher Costing');

    // Column widths
    ws.columns = [
      { width: 8 },  // A: Sl.No
      { width: 22 }, // B: Section Label
      { width: 55 }, // C: Description
      { width: 20 }, // D: Amount
      { width: 20 }, // E: Production/Qty
      { width: 20 }, // F: Cost per Unit
    ];

    const gbQty = mainRow?.qty ?? 0;

    // 1. Title
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'KVSS & SBBM 3-STAGE QUARRY & CRUSHER COSTING DETAILS';
    titleCell.font = { name: 'Arial Black', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 40;

    ws.mergeCells('A2:F2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = `Report Period: ${fmtDate(startDate)} to ${fmtDate(endDate)} | Total Production: ${fmt(gbQty)} MT`;
    subtitleCell.font = { size: 11, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 25;

    ws.addRow([]); // Spacer

    // 2. Header Rows
    const headerRow1 = ws.addRow(['Sl.No.', '', 'Description', `FOR THE MONTH (${fmt(gbQty)}t)`]);
    ws.mergeCells(`D${headerRow1.number}:F${headerRow1.number}`);
    
    const headerRow2 = ws.addRow(['', '', '', 'Amount', 'Production', 'Cost per Unit']);
    
    // Header Styling
    [headerRow1, headerRow2].forEach(row => {
      row.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Helper for rows
    const addDataRow = (sl: string, section: string, desc: string, amt: number | string, qty: number | string, cpu: number | string, isTotal = false, bgColor?: string) => {
      const row = ws.addRow([sl, section, desc, amt, qty, cpu]);
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (bgColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
        }
        if (colNumber >= 4) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }
        if (isTotal) {
          cell.font = { bold: true };
          if (!bgColor) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' } // Slate 100
            };
          }
          if (colNumber === 3) cell.alignment = { horizontal: 'center' };
        }
      });
      return row;
    };

    // ─── SECTION 1: QUARRY ───
    const quarryStart = ws.rowCount + 1;
    const Q_COLOR = 'FFE0F2FE'; // Sky 100
    addDataRow('1', 'QUARRY', '(a) Good boulder production', mainRow?.amount ?? 0, mainRow?.qty ?? 0, mainRow?.costPerUnit ?? 0, false, Q_COLOR);
    addDataRow('', '', '(b) Weathered production', groupBRow?.amount ?? 0, groupBRow?.qty ?? 0, groupBRow?.costPerUnit ?? 0, false, Q_COLOR);
    addDataRow('', '', '(c) Boulders Rehandling', groupCRow?.amount ?? 0, groupCRow?.qty ?? 0, groupCRow?.costPerUnit ?? 0, false, Q_COLOR);
    addDataRow('', '', '(d) Government Royalty + GST', groupERow?.amount ?? 0, groupERow?.qty ?? 0, groupERow?.costPerUnit ?? 0, false, Q_COLOR);
    addDataRow('', '', '(e) Miscellaneous Permit Charges', groupFRow?.amount ?? 0, groupFRow?.qty ?? 0, groupFRow?.costPerUnit ?? 0, false, Q_COLOR);
    
    const hTotal = groupHRows.reduce((s, r) => s + r.amount, 0);
    addDataRow('', '', '(f) Statuotory Person Salary', hTotal, gbQty, gbQty > 0 ? hTotal / gbQty : 0, false, Q_COLOR);
    addDataRow('', '', '(g) Diesel Expense (Net)', groupIRow?.amount ?? 0, groupIRow?.qty ?? 0, groupIRow?.costPerUnit ?? 0, false, Q_COLOR);
    addDataRow('', '', '(h) Additional Explosive Cost', groupJRow?.amount ?? 0, groupJRow?.qty ?? 0, groupJRow?.costPerUnit ?? 0, false, Q_COLOR);
    
    const quarryTotalAmt = (mainRow?.amount ?? 0) + (groupBRow?.amount ?? 0) + (groupCRow?.amount ?? 0) + (groupERow?.amount ?? 0) + (groupFRow?.amount ?? 0) + hTotal + (groupIRow?.amount ?? 0) + (groupJRow?.amount ?? 0);
    addDataRow('', '', 'TOTAL QUARRY COST', quarryTotalAmt, gbQty, gbQty > 0 ? quarryTotalAmt / gbQty : 0, true, 'FFBAE6FD'); // Sky 200
    
    const quarryEnd = ws.rowCount - 1;
    ws.mergeCells(`A${quarryStart}:A${quarryEnd}`);
    ws.mergeCells(`B${quarryStart}:B${quarryEnd}`);
    ws.getCell(`A${quarryStart}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(`B${quarryStart}`).alignment = { vertical: 'middle', horizontal: 'center' };

    // ─── SECTION 2: Crusher ───
    const crusherStart = ws.rowCount + 1;
    const C_COLOR = 'FFDCFCE7'; // Green 100
    const cManpower = crusherContractors.reduce((s, c) => s + c.amount, 0);
    addDataRow('2', 'Crusher', '(a) Crusher Operation & Maintenance - Manpower', cManpower, crusherQty, crusherQty > 0 ? cManpower / crusherQty : 0, false, C_COLOR);
    
    const cSpares = crusherSpares.reduce((s, c) => s + c.amount, 0);
    addDataRow('', '', '(b) Spares & Consummables', cSpares, crusherQty, crusherQty > 0 ? cSpares / crusherQty : 0, false, C_COLOR);
    addDataRow('', '', '(c) EB Power chares', crusherEBRow?.amount ?? 0, crusherQty, crusherEBRow?.costPerUnit ?? 0, false, C_COLOR);
    addDataRow('', '', '(d) Control Room', crusherCRRow?.amount ?? 0, crusherQty, crusherCRRow?.costPerUnit ?? 0, false, C_COLOR);
    addDataRow('', '', '(e) Miscellaneous', crusherMiscRow?.amount ?? 0, crusherQty, crusherMiscRow?.costPerUnit ?? 0, false, C_COLOR);
    addDataRow('', '', '(f) Excavator Additional Work', crusherExcRow?.amount ?? 0, crusherQty, crusherExcRow?.costPerUnit ?? 0, false, C_COLOR);
    
    const crusherTotalAmt = cManpower + cSpares + (crusherEBRow?.amount ?? 0) + (crusherCRRow?.amount ?? 0) + (crusherMiscRow?.amount ?? 0) + (crusherExcRow?.amount ?? 0);
    addDataRow('', '', 'TOTAL CRUSHER COSTING', crusherTotalAmt, crusherQty, crusherQty > 0 ? crusherTotalAmt / crusherQty : 0, true, 'FFBBF7D0'); // Green 200
    
    const crusherEnd = ws.rowCount - 1;
    ws.mergeCells(`A${crusherStart}:A${crusherEnd}`);
    ws.mergeCells(`B${crusherStart}:B${crusherEnd}`);

    // ─── SECTION 3: SERVICES ───
    const servicesStart = ws.rowCount + 1;
    const S_COLOR = 'FFFEF3C7'; // Amber 100
    addDataRow('3', 'SERVICES', '(a) JCB Works', crusherJCBRow?.amount ?? 0, crusherQty, crusherJCBRow?.costPerUnit ?? 0, false, S_COLOR);
    addDataRow('', '', '(b) Weight Bridge', crusherWBRow?.amount ?? 0, crusherQty, crusherWBRow?.costPerUnit ?? 0, false, S_COLOR);
    addDataRow('', '', '(c) GST (Inclusive)', crusherGstRow?.amount ?? 0, crusherSalesValue, crusherGstRow?.costPerUnit ?? 0, false, S_COLOR);
    
    const servicesTotalAmt = (crusherJCBRow?.amount ?? 0) + (crusherWBRow?.amount ?? 0) + (crusherGstRow?.amount ?? 0);
    addDataRow('', '', 'TOTAL SERVICES COST', servicesTotalAmt, crusherQty, crusherQty > 0 ? servicesTotalAmt / crusherQty : 0, true, 'FFFDE68A'); // Amber 200
    
    const servicesEnd = ws.rowCount - 1;
    ws.mergeCells(`A${servicesStart}:A${servicesEnd}`);
    ws.mergeCells(`B${servicesStart}:B${servicesEnd}`);
    ws.getCell(`A${servicesStart}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(`B${servicesStart}`).alignment = { vertical: 'middle', horizontal: 'center' };

    // ─── SECTION 4: Over Heads ───
    const ohStart = ws.rowCount + 1;
    const OH_COLOR = 'FFF3E8FF'; // Purple 100
    const ohA = overheadGroupARows.reduce((s, r) => s + r.amount, 0);
    addDataRow('4', 'Over Heads', '(a) Staff Salaries', ohA, gbQty, gbQty > 0 ? ohA / gbQty : 0, false, OH_COLOR);
    addDataRow('', '', '(b) Conveyance Vehicle Charges', overheadGroupBRow?.amount ?? 0, gbQty, overheadGroupBRow?.costPerUnit ?? 0, false, OH_COLOR);
    addDataRow('', '', '(c) Cash Booking', overheadGroupCRow?.amount ?? 0, gbQty, overheadGroupCRow?.costPerUnit ?? 0, false, OH_COLOR);
    addDataRow('', '', '(d) Miscellaneous', overheadGroupDRow?.amount ?? 0, gbQty, overheadGroupDRow?.costPerUnit ?? 0, false, OH_COLOR);
    
    const ohTotalAmt = ohA + (overheadGroupBRow?.amount ?? 0) + (overheadGroupCRow?.amount ?? 0) + (overheadGroupDRow?.amount ?? 0);
    addDataRow('', '', 'Total costing towards OverHeads', ohTotalAmt, gbQty, gbQty > 0 ? ohTotalAmt / gbQty : 0, true, 'FFE9D5FF'); // Purple 200
    
    const ohEnd = ws.rowCount - 1;
    ws.mergeCells(`A${ohStart}:A${ohEnd}`);
    ws.mergeCells(`B${ohStart}:B${ohEnd}`);
    ws.getCell(`A${ohStart}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(`B${ohStart}`).alignment = { vertical: 'middle', horizontal: 'center' };

    // Final Summaries
    addDataRow('', '', 'TOTAL CRUSHING (Good Boulder + Weathered rock)', '', crusherQty, '', true, 'FFF1F5F9'); // Slate 100
    
    const grandTotal = quarryTotalAmt + crusherTotalAmt + servicesTotalAmt + ohTotalAmt;
    const finalRow = addDataRow('', '', 'TOTAL CONSOLIDATED COSTING (Quarry, Crusher, Services & Overheads)', grandTotal, gbQty, gbQty > 0 ? grandTotal / gbQty : 0, true, 'FF1E293B');
    finalRow.getCell(3).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    finalRow.getCell(4).font = { color: { argb: 'FFBBF7D0' }, bold: true };
    finalRow.getCell(6).font = { color: { argb: 'FFFDE68A' }, bold: true };

    ws.addRow([]);
    const genRow = ws.addRow(['', '', 'Report generated on: ' + new Date().toLocaleString()]);
    genRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarry_Crusher_Costing_${startDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const gbQty = mainRow?.qty ?? 0;

    // Header Decoration
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(1);
    doc.line(10, 25, 287, 25);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('KVSS & SBBM 3-STAGE QUARRY & CRUSHER COSTING DETAILS', 149, 15, { align: 'center' });
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Report Period: ${fmtDate(startDate)} to ${fmtDate(endDate)} | Global Production: ${fmt(gbQty)} MT`, 149, 21, { align: 'center' });

    const rows: any[] = [];

    // Calculations
    const hTotal = groupHRows.reduce((s, r) => s + r.amount, 0);
    const quarryTotalAmt = (mainRow?.amount ?? 0) + (groupBRow?.amount ?? 0) + (groupCRow?.amount ?? 0) + (groupERow?.amount ?? 0) + (groupFRow?.amount ?? 0) + hTotal + (groupIRow?.amount ?? 0) + (groupJRow?.amount ?? 0);
    
    const cManpower = crusherContractors.reduce((s, c) => s + c.amount, 0);
    const cSpares = crusherSpares.reduce((s, c) => s + c.amount, 0);
    const crusherTotalAmt = cManpower + cSpares + (crusherEBRow?.amount ?? 0) + (crusherCRRow?.amount ?? 0) + (crusherMiscRow?.amount ?? 0) + (crusherExcRow?.amount ?? 0);
    const servicesTotalAmt = (crusherJCBRow?.amount ?? 0) + (crusherWBRow?.amount ?? 0) + (crusherGstRow?.amount ?? 0);
    
    const ohA = overheadGroupARows.reduce((s, r) => s + r.amount, 0);
    const ohTotalAmt = ohA + (overheadGroupBRow?.amount ?? 0) + (overheadGroupCRow?.amount ?? 0) + (overheadGroupDRow?.amount ?? 0);

    // Section 1: Quarry
    const Q_BG = [224, 242, 254]; // Sky 100
    const Q_BOLD_BG = [186, 230, 253]; // Sky 200
    rows.push([
      { content: '1', rowSpan: 9, styles: { valign: 'middle', halign: 'center', fillColor: Q_BG } },
      { content: 'QUARRY', rowSpan: 9, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: Q_BG } },
      { content: '(a) Good boulder production', styles: { fillColor: Q_BG } }, { content: fmt(mainRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(mainRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(mainRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }
    ]);
    rows.push([{ content: '(b) Weathered production', styles: { fillColor: Q_BG } }, { content: fmt(groupBRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupBRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupBRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(c) Boulders Rehandling', styles: { fillColor: Q_BG } }, { content: fmt(groupCRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupCRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupCRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(d) Government Royalty + GST', styles: { fillColor: Q_BG } }, { content: fmt(groupERow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupERow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupERow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(e) Miscellaneous Permit Charges', styles: { fillColor: Q_BG } }, { content: fmt(groupFRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupFRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupFRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(f) Statuotory Person Salary', styles: { fillColor: Q_BG } }, { content: fmt(hTotal), styles: { fillColor: Q_BG } }, { content: fmt(gbQty), styles: { fillColor: Q_BG } }, { content: fmt(gbQty > 0 ? hTotal / gbQty : 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(g) Diesel Expense (Net)', styles: { fillColor: Q_BG } }, { content: fmt(groupIRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupIRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupIRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: '(h) Additional Explosive Cost', styles: { fillColor: Q_BG } }, { content: fmt(groupJRow?.amount ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupJRow?.qty ?? 0), styles: { fillColor: Q_BG } }, { content: fmt(groupJRow?.costPerUnit ?? 0), styles: { fillColor: Q_BG } }]);
    rows.push([{ content: 'TOTAL QUARRY COST', styles: { fontStyle: 'bold', halign: 'center', fillColor: Q_BOLD_BG } }, { content: fmt(quarryTotalAmt), styles: { fontStyle: 'bold', fillColor: Q_BOLD_BG } }, { content: fmt(gbQty), styles: { fontStyle: 'bold', fillColor: Q_BOLD_BG } }, { content: fmt(gbQty > 0 ? quarryTotalAmt / gbQty : 0), styles: { fontStyle: 'bold', fillColor: Q_BOLD_BG } }]);

    // Section 2: Crusher
    const C_BG = [220, 252, 231]; // Green 100
    const C_BOLD_BG = [187, 247, 208]; // Green 200
    rows.push([
      { content: '2', rowSpan: 7, styles: { valign: 'middle', halign: 'center', fillColor: C_BG } },
      { content: 'Crusher', rowSpan: 7, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: C_BG } },
      { content: '(a) Crusher Operation & Maintenance - Manpower', styles: { fillColor: C_BG } }, { content: fmt(cManpower), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherQty > 0 ? cManpower / crusherQty : 0), styles: { fillColor: C_BG } }
    ]);
    rows.push([{ content: '(b) Spares & Consummables', styles: { fillColor: C_BG } }, { content: fmt(cSpares), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherQty > 0 ? cSpares / crusherQty : 0), styles: { fillColor: C_BG } }]);
    rows.push([{ content: '(c) EB Power chares', styles: { fillColor: C_BG } }, { content: fmt(crusherEBRow?.amount ?? 0), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherEBRow?.costPerUnit ?? 0), styles: { fillColor: C_BG } }]);
    rows.push([{ content: '(d) Control Room', styles: { fillColor: C_BG } }, { content: fmt(crusherCRRow?.amount ?? 0), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherCRRow?.costPerUnit ?? 0), styles: { fillColor: C_BG } }]);
    rows.push([{ content: '(e) Miscellaneous', styles: { fillColor: C_BG } }, { content: fmt(crusherMiscRow?.amount ?? 0), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherMiscRow?.costPerUnit ?? 0), styles: { fillColor: C_BG } }]);
    rows.push([{ content: '(f) Excavator Additional Work', styles: { fillColor: C_BG } }, { content: fmt(crusherExcRow?.amount ?? 0), styles: { fillColor: C_BG } }, { content: fmt(crusherQty), styles: { fillColor: C_BG } }, { content: fmt(crusherExcRow?.costPerUnit ?? 0), styles: { fillColor: C_BG } }]);
    rows.push([{ content: 'TOTAL CRUSHER COSTING', styles: { fontStyle: 'bold', halign: 'center', fillColor: C_BOLD_BG } }, { content: fmt(crusherTotalAmt), styles: { fontStyle: 'bold', fillColor: C_BOLD_BG } }, { content: fmt(crusherQty), styles: { fontStyle: 'bold', fillColor: C_BOLD_BG } }, { content: fmt(crusherQty > 0 ? crusherTotalAmt / crusherQty : 0), styles: { fontStyle: 'bold', fillColor: C_BOLD_BG } }]);

    // Section 3: Services
    const S_BG = [254, 243, 199]; // Amber 100
    const S_BOLD_BG = [253, 230, 138]; // Amber 200
    rows.push([
      { content: '3', rowSpan: 4, styles: { valign: 'middle', halign: 'center', fillColor: S_BG } },
      { content: 'SERVICES', rowSpan: 4, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: S_BG } },
      { content: '(a) JCB Works', styles: { fillColor: S_BG } }, { content: fmt(crusherJCBRow?.amount ?? 0), styles: { fillColor: S_BG } }, { content: fmt(crusherQty), styles: { fillColor: S_BG } }, { content: fmt(crusherJCBRow?.costPerUnit ?? 0), styles: { fillColor: S_BG } }
    ]);
    rows.push([{ content: '(b) Weight Bridge', styles: { fillColor: S_BG } }, { content: fmt(crusherWBRow?.amount ?? 0), styles: { fillColor: S_BG } }, { content: fmt(crusherQty), styles: { fillColor: S_BG } }, { content: fmt(crusherWBRow?.costPerUnit ?? 0), styles: { fillColor: S_BG } }]);
    rows.push([{ content: '(c) GST (Inclusive)', styles: { fillColor: S_BG } }, { content: fmt(crusherGstRow?.amount ?? 0), styles: { fillColor: S_BG } }, { content: fmt(crusherSalesValue), styles: { fillColor: S_BG } }, { content: fmt(crusherGstRow?.costPerUnit ?? 0), styles: { fillColor: S_BG } }]);
    rows.push([{ content: 'TOTAL SERVICES COST', styles: { fontStyle: 'bold', halign: 'center', fillColor: S_BOLD_BG } }, { content: fmt(servicesTotalAmt), styles: { fontStyle: 'bold', fillColor: S_BOLD_BG } }, { content: fmt(crusherQty), styles: { fontStyle: 'bold', fillColor: S_BOLD_BG } }, { content: fmt(crusherQty > 0 ? servicesTotalAmt / crusherQty : 0), styles: { fontStyle: 'bold', fillColor: S_BOLD_BG } }]);

    // Section 3: Over Heads
    const OH_BG = [243, 232, 255]; // Purple 100
    const OH_BOLD_BG = [233, 213, 255]; // Purple 200
    rows.push([
      { content: '4', rowSpan: 5, styles: { valign: 'middle', halign: 'center', fillColor: OH_BG } },
      { content: 'Over Heads', rowSpan: 5, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: OH_BG } },
      { content: '(a) Staff Salaries', styles: { fillColor: OH_BG } }, { content: fmt(ohA), styles: { fillColor: OH_BG } }, { content: fmt(gbQty), styles: { fillColor: OH_BG } }, { content: fmt(gbQty > 0 ? ohA / gbQty : 0), styles: { fillColor: OH_BG } }
    ]);
    rows.push([{ content: '(b) Conveyance Vehicle Charges', styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupBRow?.amount ?? 0), styles: { fillColor: OH_BG } }, { content: fmt(gbQty), styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupBRow?.costPerUnit ?? 0), styles: { fillColor: OH_BG } }]);
    rows.push([{ content: '(c) Cash Booking', styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupCRow?.amount ?? 0), styles: { fillColor: OH_BG } }, { content: fmt(gbQty), styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupCRow?.costPerUnit ?? 0), styles: { fillColor: OH_BG } }]);
    rows.push([{ content: '(d) Miscellaneous', styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupDRow?.amount ?? 0), styles: { fillColor: OH_BG } }, { content: fmt(gbQty), styles: { fillColor: OH_BG } }, { content: fmt(overheadGroupDRow?.costPerUnit ?? 0), styles: { fillColor: OH_BG } }]);
    rows.push([{ content: 'Total costing towards OverHeads', styles: { fontStyle: 'bold', halign: 'center', fillColor: OH_BOLD_BG } }, { content: fmt(ohTotalAmt), styles: { fontStyle: 'bold', fillColor: OH_BOLD_BG } }, { content: fmt(gbQty), styles: { fontStyle: 'bold', fillColor: OH_BOLD_BG } }, { content: fmt(gbQty > 0 ? ohTotalAmt / gbQty : 0), styles: { fontStyle: 'bold', fillColor: OH_BOLD_BG } }]);

    // Final summaries
    const grandTotal = quarryTotalAmt + crusherTotalAmt + servicesTotalAmt + ohTotalAmt;
    const FINAL_BG = [241, 245, 249]; // Slate 100
    const FINAL_BOLD_BG = [203, 213, 225]; // Slate 300
    rows.push([
      { content: '', colSpan: 2 },
      { content: 'TOTAL CRUSHING (Good Boulder + Weathered rock)', styles: { fontStyle: 'bold', halign: 'center', fillColor: FINAL_BG } },
      { content: '', styles: { fillColor: FINAL_BG } },
      { content: fmt(crusherQty), styles: { fontStyle: 'bold', fillColor: FINAL_BG } },
      { content: '', styles: { fillColor: FINAL_BG } }
    ]);
    rows.push([
      { content: '', colSpan: 2 },
      { content: 'TOTAL COSTING (Quarry, Crusher & Services) Including Taxes', styles: { fontStyle: 'bold', halign: 'center', fillColor: FINAL_BOLD_BG } },
      { content: fmt(grandTotal), styles: { fontStyle: 'bold', fillColor: FINAL_BOLD_BG } },
      { content: fmt(gbQty), styles: { fontStyle: 'bold', fillColor: FINAL_BOLD_BG } },
      { content: fmt(gbQty > 0 ? grandTotal / gbQty : 0), styles: { fontStyle: 'bold', fillColor: FINAL_BOLD_BG } }
    ]);

    autoTable(doc, {
      head: [['Sl.', 'Section', 'Description of Operational Costs', 'Amount (₹)', 'Production (MT)', 'Cost/Unit']],
      body: rows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, font: 'helvetica' },
      headStyles: { 
        fillColor: [30, 41, 59], 
        halign: 'center', 
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        fontSize: 9
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
      },
      didDrawPage: (data) => {
        // Footer
        const str = `Page ${data.pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
        doc.text(`Generated on ${new Date().toLocaleString()} | KVSS & SBBM System`, doc.internal.pageSize.width - 85, doc.internal.pageSize.height - 10);
      }
    });

    doc.save(`Quarry_Crusher_Costing_${startDate}.pdf`);
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
                      ₹{fmt((mainRow?.amount ?? 0) / (mainRow?.qty || 1))} / MT
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


                  {/* ── Group D: Quarry Permit (Statutory Fees + GST) ── */}
                  <tr className="bg-emerald-50 text-emerald-900 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Quarry Permit (Statutory Fees + GST)</td>
                  </tr>
                  {groupERow && (
                    <tr className="bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">4</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupERow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupERow.uom}</td>
                      <td className="px-6 py-3 text-right text-emerald-800 text-xs font-black">{fmt(groupERow.qty)}</td>
                      <td className="px-6 py-3 text-right text-emerald-900 text-xs font-black">{fmt(groupERow.amount)}</td>
                      <td className="px-6 py-3 text-right text-green-700 text-xs font-black">{fmt(groupERow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-emerald-100/60 border-t-2 border-emerald-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-emerald-700">Group D Subtotal (Quarry Permit):</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-800 font-black">{fmt(groupERow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-900 font-black">{fmt(groupERow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-green-700 font-black">₹{fmt(groupERow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group E: Miscellaneous Permit Charges ── */}
                  <tr className="bg-yellow-50 text-yellow-900 border-t-2 border-yellow-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Miscellaneous Permit Charges</td>
                  </tr>
                  {groupFRow && (
                    <tr className="bg-yellow-50/40 hover:bg-yellow-50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">5</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupFRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupFRow.uom}</td>
                      <td className="px-6 py-3 text-right text-yellow-800 text-xs font-black">{fmt(groupFRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-yellow-900 text-xs font-black">{fmt(groupFRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-amber-700 text-xs font-black">{fmt(groupFRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-yellow-100/60 border-t-2 border-yellow-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-yellow-700">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-yellow-800 font-black">{fmt(groupFRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-yellow-900 font-black">{fmt(groupFRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-700 font-black">₹{fmt(groupFRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* ── Group F: Statutory Person Salary (Overhead Salaries) ── */}
                  {groupHRows.length > 0 && (
                    <>
                      <tr className="bg-violet-50 text-violet-900 border-t-2 border-violet-200">
                        <td colSpan={6} className="px-6 py-3 font-black text-xs">Group F: Statutory Person Salary (Overhead)</td>
                      </tr>
                      {groupHRows.map((row, i) => (
                        <tr key={`h-${i}`} className="hover:bg-violet-50/40 transition-colors">
                          <td className="px-6 py-3 text-slate-400 text-xs">6</td>
                          <td className="px-6 py-3 text-slate-800 text-xs">{row.description}</td>
                          <td className="px-6 py-3 text-center text-slate-500 text-xs">{row.uom}</td>
                          <td className="px-6 py-3 text-right text-violet-700 text-xs font-bold">{fmt(row.qty)}</td>
                          <td className="px-6 py-3 text-right text-violet-900 text-xs font-bold">{fmt(row.amount)}</td>
                          <td className="px-6 py-3 text-right text-purple-700 text-xs font-bold">{fmt(row.costPerUnit)}</td>
                        </tr>
                      ))}
                      <tr className="bg-violet-100/60 border-t-2 border-violet-200 font-bold">
                        <td colSpan={3} className="px-6 py-3 text-right text-xs text-violet-700">Group F Subtotal:</td>
                        <td className="px-6 py-3 text-right text-xs text-violet-800 font-black">{fmt(groupHRows[0]?.qty ?? 0)} MT</td>
                        <td className="px-6 py-3 text-right text-xs text-violet-900 font-black">{fmt(groupHRows.reduce((s, r) => s + r.amount, 0))}</td>
                        <td className="px-6 py-3 text-right text-xs text-purple-700 font-black">₹{fmt(groupHRows[0]?.qty > 0 ? groupHRows.reduce((s, r) => s + r.amount, 0) / groupHRows[0].qty : 0)} / MT</td>
                      </tr>
                    </>
                  )}

                  {/* ── Group G: Diesel Expense (Net) ── */}
                  <tr className="bg-slate-100 text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group G: Diesel Expense (Net = Vendor Bills − Contractor Diesel)</td>
                  </tr>
                  {groupIRow && (
                    <tr className="bg-slate-50/60 hover:bg-slate-100 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">7</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupIRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupIRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-700 text-xs font-black">{fmt(groupIRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-black">{fmt(groupIRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-black">{fmt(groupIRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-200/60 border-t-2 border-slate-300 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-slate-600">Group G Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-700 font-black">{fmt(groupIRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-900 font-black">{fmt(groupIRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-600 font-black">₹{fmt(groupIRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>
                  {/* ── Group H: Additional Explosive Cost ── */}
                  <tr className="bg-blue-50 text-blue-900 border-t-2 border-blue-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group H: Additional Explosive Cost (Net: Vendor Bills − WR Cost − GB Contractor)</td>
                  </tr>
                  {groupJRow && (
                    <tr className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-xs font-bold">8</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{groupJRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-600 text-xs">{groupJRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-700 text-xs font-black">{fmt(groupJRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-black">{fmt(groupJRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-indigo-700 text-xs font-black">{fmt(groupJRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-blue-100/60 border-t-2 border-blue-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-blue-700">Group H Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-blue-800 font-black">{fmt(groupJRow?.qty ?? 0)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-blue-900 font-black">{fmt(groupJRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-700 font-black">₹{fmt(groupJRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>



                  {/* ── GRAND TOTAL: Total Quarry Cost ── */}
                  {(() => {
                    const gbQty = mainRow?.qty ?? 0;
                    const totalAmt =
                      (mainRow?.amount ?? 0) +
                      (groupBRow?.amount ?? 0) +
                      (groupCRow?.amount ?? 0) +
                      (groupERow?.amount ?? 0) +
                      (groupFRow?.amount ?? 0) +
                      groupHRows.reduce((s, r) => s + r.amount, 0) +
                      (groupIRow?.amount ?? 0) +
                      (groupJRow?.amount ?? 0);
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
            (groupERow?.amount ?? 0) +
            (groupFRow?.amount ?? 0) +
            groupHRows.reduce((s, r) => s + r.amount, 0) +
            (groupIRow?.amount ?? 0) +
            (groupJRow?.amount ?? 0);
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
                <span className="text-xs text-slate-400">Sum of all groups A through H</span>
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
              const totalCrusherCR = crusherCRRow?.amount ?? 0;
              const totalCrusherMisc = crusherMiscRow?.amount ?? 0;
              const totalCrusherExc = crusherExcRow?.amount ?? 0;
              const totalCrusherAll = totalCrusherManpower + totalCrusherSpares + totalCrusherEB + totalCrusherCR + totalCrusherMisc + totalCrusherExc;
              const crusherManpowerCpu = gbQty > 0 ? totalCrusherManpower / gbQty : 0;
              const crusherSparesCpu = gbQty > 0 ? totalCrusherSpares / gbQty : 0;
              const crusherEBCpu = gbQty > 0 ? totalCrusherEB / gbQty : 0;
              const crusherCRCpu = gbQty > 0 ? totalCrusherCR / gbQty : 0;
              const crusherMiscCpu = gbQty > 0 ? totalCrusherMisc / gbQty : 0;
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


                  {/* Crusher Group D: Control Room */}
                  <tr className="bg-emerald-50 text-emerald-900 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Control Room</td>
                  </tr>
                  <tr className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">4</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Control Room Service Payments</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-emerald-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-emerald-900 text-xs font-bold">{fmt(totalCrusherCR)}</td>
                    <td className="px-6 py-3 text-right text-emerald-700 text-xs font-bold">{fmt(crusherCRCpu)}</td>
                  </tr>
                  <tr className="bg-emerald-100/60 border-t-2 border-emerald-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-emerald-700">Group D Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-900 font-black">{fmt(totalCrusherCR)}</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-700 font-black">₹{fmt(crusherCRCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group E: Miscellaneous */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Miscellaneous</td>
                  </tr>
                  <tr className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">5</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Crusher Miscellaneous Expenses</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(totalCrusherMisc)}</td>
                    <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(crusherMiscCpu)}</td>
                  </tr>
                  <tr className="bg-slate-100/60 border-t-2 border-slate-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-slate-700">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-900 font-black">{fmt(totalCrusherMisc)}</td>
                    <td className="px-6 py-3 text-right text-xs text-slate-700 font-black">₹{fmt(crusherMiscCpu)} / MT</td>
                  </tr>

                  {/* Crusher Group F: Excavator Additional Work */}
                  <tr className="bg-sky-50 text-sky-900 border-t-2 border-sky-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group F: Excavator Additional Work in Crusher</td>
                  </tr>
                  {crusherExcRow && (
                    <tr className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">6</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{crusherExcRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">MT</td>
                      <td className="px-6 py-3 text-right text-slate-700 text-xs font-bold">{fmt(crusherExcRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(crusherExcRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-sky-700 text-xs font-bold">₹{fmt(crusherExcRow.costPerUnit)}</td>
                    </tr>
                  )}
                  <tr className="bg-sky-100/60 border-t-2 border-sky-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-sky-700">Group F Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-900 font-black">{fmt(crusherExcRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-700 font-black">₹{fmt(crusherExcRow?.costPerUnit ?? 0)} / MT</td>
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
                                  (crusherCRRow?.amount ?? 0) +
                                  (crusherMiscRow?.amount ?? 0) +
                                  (crusherExcRow?.amount ?? 0);
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

    {/* ══════ SERVICES COST TABLE ══════ */}
    <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 mt-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-amber-700 rounded-2xl flex items-center justify-center shadow-lg">
          <Settings2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Services Details</h3>
          <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">Equipment and compliance service analysis</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-amber-900 text-white border-b border-amber-800">
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
              <tr><td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">Loading service data…</td></tr>
            ) : (() => {
              const gbQty = crusherQty;
              const totalAmt = (crusherJCBRow?.amount ?? 0) + (crusherWBRow?.amount ?? 0) + (crusherGstRow?.amount ?? 0);
              const totalCpu = gbQty > 0 ? totalAmt / gbQty : 0;

              return (
                <>
                  {/* Group A: JCB Works */}
                  <tr className="bg-amber-50 text-amber-900 border-t-2 border-amber-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group A: JCB Works</td>
                  </tr>
                  <tr className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">JCB Service Payments (Consolidated)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-amber-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-amber-900 text-xs font-bold">{fmt(crusherJCBRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-amber-700 text-xs font-bold">{fmt(crusherJCBRow?.costPerUnit ?? 0)}</td>
                  </tr>
                  <tr className="bg-amber-100/60 border-t-2 border-amber-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-amber-700">Group A Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-900 font-black">{fmt(crusherJCBRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-amber-700 font-black">₹{fmt(crusherJCBRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* Group B: Weight Bridge */}
                  <tr className="bg-indigo-50 text-indigo-900 border-t-2 border-indigo-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group B: Weight Bridge</td>
                  </tr>
                  <tr className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Weight Bridge Operations (Consolidated)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">—</td>
                    <td className="px-6 py-3 text-right text-indigo-700 text-xs font-bold">{fmt(gbQty)}</td>
                    <td className="px-6 py-3 text-right text-indigo-900 text-xs font-bold">{fmt(crusherWBRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-indigo-700 text-xs font-bold">{fmt(crusherWBRow?.costPerUnit ?? 0)}</td>
                  </tr>
                  <tr className="bg-indigo-100/60 border-t-2 border-indigo-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-indigo-700">Group B Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-800 font-black">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-900 font-black">{fmt(crusherWBRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-indigo-700 font-black">₹{fmt(crusherWBRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* Group C: GST */}
                  <tr className="bg-rose-50 text-rose-900 border-t-2 border-rose-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group C: GST</td>
                  </tr>
                  <tr className="hover:bg-rose-50/30 transition-colors">
                    <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                    <td className="px-6 py-3 text-slate-900 text-xs font-black">Total GST (5% of Products Sale)</td>
                    <td className="px-6 py-3 text-center text-slate-500 text-xs">Value</td>
                    <td className="px-6 py-3 text-right text-rose-700 text-xs font-bold">{fmt(crusherSalesValue)}</td>
                    <td className="px-6 py-3 text-right text-rose-900 text-xs font-bold">{fmt(crusherGstRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-rose-700 text-xs font-bold">{fmt(crusherGstRow?.costPerUnit ?? 0)}</td>
                  </tr>
                  <tr className="bg-rose-100/60 border-t-2 border-rose-200 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-xs text-rose-700">Group C Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-800 font-black">₹{fmt(crusherSalesValue)}</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-900 font-black">{fmt(crusherGstRow?.amount ?? 0)}</td>
                    <td className="px-6 py-3 text-right text-xs text-rose-700 font-black">₹{fmt(crusherGstRow?.costPerUnit ?? 0)} / MT</td>
                  </tr>

                  {/* Services Grand Total */}
                  <tr className="bg-amber-900 text-white">
                    <td colSpan={2} className="px-6 py-5 font-black text-sm tracking-wide">Total Services Cost</td>
                    <td className="px-6 py-5 text-center text-amber-300 text-xs font-bold">MT</td>
                    <td className="px-6 py-5 text-right font-black text-sm">{fmt(gbQty)} MT</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-emerald-300">₹{fmt(totalAmt)}</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-yellow-300">₹{fmt(totalCpu)} / MT</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>

    {/* ══════ OVERHEADS COST TABLE ══════ */}
    <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 mt-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Over heads Details</h3>
          <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">Administrative and personnel overhead analysis</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-indigo-900 text-white border-b border-indigo-800">
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
              <tr><td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">Loading overhead data…</td></tr>
            ) : (() => {
              const gbQty = mainRow?.qty ?? 0;
              const totalA = overheadGroupARows.reduce((s, r) => s + r.amount, 0);
              const totalB = overheadGroupBRow?.amount ?? 0;
              const totalC = overheadGroupCRow?.amount ?? 0;
              const totalD = overheadGroupDRow?.amount ?? 0;
              const totalAll = totalA + totalB + totalC + totalD;
              const totalCpu = gbQty > 0 ? totalAll / gbQty : 0;

              return (
                <>
                  {/* Group A: Staff Salaries */}
                  <tr className="bg-indigo-50 text-indigo-900 border-t-2 border-indigo-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group A: Staff Salaries (Excluding Manikandan)</td>
                  </tr>
                  {overheadGroupARows.map((row, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{row.slNo}</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{row.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{row.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(row.qty)}</td>
                      <td className="px-6 py-3 text-right text-indigo-900 text-xs font-bold">{fmt(row.amount)}</td>
                      <td className="px-6 py-3 text-right text-indigo-600 text-xs font-bold">{fmt(row.costPerUnit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-100/60 border-t-2 border-indigo-200 font-bold text-indigo-900">
                    <td colSpan={4} className="px-6 py-3 text-right text-xs">Group A Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs font-black">{fmt(totalA)}</td>
                    <td className="px-6 py-3 text-right text-xs font-black">₹{fmt(gbQty > 0 ? totalA / gbQty : 0)} / MT</td>
                  </tr>

                  {/* Group B: Conveyance */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group B: Conveyance Vehicle Charges (Diesel - Admin)</td>
                  </tr>
                  {overheadGroupBRow && (
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{overheadGroupBRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{overheadGroupBRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupBRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(overheadGroupBRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupBRow.costPerUnit)}</td>
                    </tr>
                  )}

                  {/* Group C: Admin Amounts */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group C: Cash Booking</td>
                  </tr>
                  {overheadGroupCRow && (
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{overheadGroupCRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{overheadGroupCRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupCRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(overheadGroupCRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupCRow.costPerUnit)}</td>
                    </tr>
                  )}

                  {/* Group D: Miscellaneous */}
                  <tr className="bg-slate-50 text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Miscellaneous (Administration)</td>
                  </tr>
                  {overheadGroupDRow && (
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">1</td>
                      <td className="px-6 py-3 text-slate-900 text-xs font-black">{overheadGroupDRow.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{overheadGroupDRow.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupDRow.qty)}</td>
                      <td className="px-6 py-3 text-right text-slate-900 text-xs font-bold">{fmt(overheadGroupDRow.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-bold">{fmt(overheadGroupDRow.costPerUnit)}</td>
                    </tr>
                  )}

                  {/* Overheads Grand Total */}
                  <tr className="bg-indigo-900 text-white">
                    <td colSpan={2} className="px-6 py-5 font-black text-sm tracking-wide">Total Overheads Cost</td>
                    <td className="px-6 py-5 text-center text-indigo-300 text-xs font-bold">—</td>
                    <td className="px-6 py-5 text-right font-black text-sm">—</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-emerald-300">₹{fmt(totalAll)}</td>
                    <td className="px-6 py-5 text-right font-black text-sm text-yellow-300">₹{fmt(totalCpu)} / MT</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
}
