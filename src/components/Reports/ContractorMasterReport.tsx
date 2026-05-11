import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Calendar, 
  Download, 
  Factory,
  TrendingUp,
  MinusCircle,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyProdItem {
  date: string;
  qcQty: number;
  qsQty: number;
  qSalesQty: number;
  scQty: number;
  soilExcHrs: number;
  soilTipperTrips: number;
  wrDrillingFt: number;
  crusherExcHrs: number;
  totalQuarryProd: number;
  totalCrusherProd: number;
}

interface BillItem {
  slNo: number | string;
  description: string;
  uom: string;
  rate: number;
  qty: number;
  amount: number;
  category: 'production' | 'deduction';
  group: 'A' | 'B' | 'C' | 'D' | 'E';
}

export function ContractorMasterReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const contractorName = 'Govindaraj';

  // State from Calculator
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  
  // State from Production Report
  const [dailyData, setDailyData] = useState<DailyProdItem[]>([]);

  // State from Deduction Report
  const [dieselLogs, setDieselLogs] = useState<any[]>([]);
  const [advanceLogs, setAdvanceLogs] = useState<any[]>([]);
  const [gbExplosivesSummary, setGbExplosivesSummary] = useState<any>(null);
  const [totalGbCost, setTotalGbCost] = useState(0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd-MM-yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. FETCH ALL RAW DATA
      const { data: transportData } = await supabase
        .from('transport_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      const { data: loadingData } = await supabase
        .from('loading_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: drillingData } = await supabase
        .from('drilling_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: accountsData } = await supabase
        .from('accounts')
        .select('customer_name, amount_given, reason, notes, transaction_type, transaction_date')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, given_price, unit, dispatch_date')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate)
        .not('given_price', 'is', null);

      // 2. BUILD DAILY SUMMARY
      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const reportRows: DailyProdItem[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // MT Production
        const qc = transportData?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders').reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        const qs = transportData?.filter(r => r.date === dateStr && r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders').reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        const sc = transportData?.filter(r => r.date === dateStr && r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders').reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        
        let qSales = 0;
        invoiceData?.filter(inv => inv.invoice_date === dateStr).forEach(inv => {
          let items = [];
          try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; } catch (e) {}
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const matName = (item.material || item.material_name || '').toLowerCase();
              if (matName === 'q-boulders') qSales += (item.quantity || 0);
            });
          }
        });

        // Machine / Other Metrics
        const sExcHrs = loadingData?.filter(r => r.date === dateStr && ['KVSS Soil', 'KVSS Weather Rocks'].includes(r.material_type)).reduce((sum, r) => {
          const run = (r.ending_hours || 0) - (r.starting_hours || 0);
          return sum + (run > 0 ? run : 0);
        }, 0) || 0;

        const sTipperTrips = transportData?.filter(r => r.date === dateStr && ['Soil', 'Weather Rocks'].includes(r.material_transported)).reduce((sum, r) => sum + (r.number_of_trips || 0), 0) || 0;

        const wDrillFt = drillingData?.filter(r => r.date === dateStr && ['Weathered Rocks', 'Soil'].includes(r.material_type)).reduce((sum, r) => {
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

        const cExcHrs = loadingData?.filter(r => r.date === dateStr && [
          'SBBM Slurry Work', 'SBBM Stockyard Good Boulders', 'Aggregates rehandling/ Aggregate Loading', 'Crusher machine works'
        ].includes(r.material_type)).reduce((sum, r) => {
          const run = (r.ending_hours || 0) - (r.starting_hours || 0);
          return sum + (run > 0 ? run : 0);
        }, 0) || 0;

        return {
          date: dateStr,
          qcQty: qc,
          qsQty: qs,
          qSalesQty: qSales,
          scQty: sc,
          soilExcHrs: sExcHrs,
          soilTipperTrips: sTipperTrips,
          wrDrillingFt: wDrillFt,
          crusherExcHrs: cExcHrs,
          totalQuarryProd: qc + qs + qSales,
          totalCrusherProd: qc + sc
        };
      });
      setDailyData(reportRows);

      // 3. BILLING TOTALS
      const totalQC = reportRows.reduce((sum, d) => sum + d.qcQty, 0);
      const totalQS = reportRows.reduce((sum, d) => sum + d.qsQty, 0);
      const totalSC = reportRows.reduce((sum, d) => sum + d.scQty, 0);
      const totalQSales = reportRows.reduce((sum, d) => sum + d.qSalesQty, 0);
      const totalExcavatorHrs = reportRows.reduce((sum, d) => sum + d.soilExcHrs, 0);
      const totalDrillingFeet = reportRows.reduce((sum, d) => sum + d.wrDrillingFt, 0);
      const totalTipperTrips = reportRows.reduce((sum, d) => sum + d.soilTipperTrips, 0);
      const totalCrusherExcHrs = reportRows.reduce((sum, d) => sum + d.crusherExcHrs, 0);



      // Deductions Aggregation
      let advLogs: any[] = [];
      let totalAdv = 0;
      accountsData?.forEach((rec: any) => {
        if (rec.transaction_type !== 'expense' || !(rec.amount_given > 0)) return;
        const matchesName = rec.customer_name?.toLowerCase().includes(contractorName.toLowerCase());
        const matchesRef = rec.reason?.toLowerCase().includes('con-qry-001') || rec.notes?.toLowerCase().includes('con-qry-001');
        if (!matchesName && !matchesRef) return;
        const isAdv = rec.reason?.toLowerCase().includes('advance') || rec.notes?.toLowerCase().includes('advance');
        if (isAdv) {
          totalAdv += rec.amount_given;
          advLogs.push(rec);
        }
      });

      // Explosives & Diesel Categorization
      let diesel: any[] = [];
      let totalPG = 0, totalED = 0, totalEDET = 0, totalN3 = 0, totalN4 = 0;
      let pgP = 0, pgC = 0, edP = 0, edC = 0, edetP = 0, edetC = 0, n3P = 0, n3C = 0, n4P = 0, n4C = 0;

      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase().trim();
        const price = d.given_price || 0;
        let qty = d.quantity_dispatched || 0;

            const isPG   = name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
            const isEDET = name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET')
                        || name.includes('ELECTRONIC DET') || name.includes('E DETONATOR');
            const isED   = !isEDET && (name === 'ED' || name.startsWith('ELEC DET')
                        || name.includes('ELECTRIC DET') || (name.length <= 4 && name.includes('ED')));
            const isN3   = name.includes('NONEL') && (name.includes('3M') || name.includes('3 M') || name.includes('3MTR') || name.includes('3 MTR'));
            const isN4   = name.includes('NONEL') && (name.includes('4M') || name.includes('4 M') || name.includes('4MTR') || name.includes('4 MTR'));
            const isNonel = name.includes('NONEL');

            const isExplosive = isPG || isED || isEDET || isNonel;

            if (isExplosive) {
              if (isPG) { if (d.unit?.toLowerCase() === 'nos') qty /= 200; totalPG += qty; pgP += price; pgC++; }
              else if (isED) { totalED += qty; edP += price; edC++; }
              else if (isEDET) { totalEDET += qty; edetP += price; edetC++; }
              else if (isN3) { totalN3 += qty; n3P += price; n3C++; }
              else if (isN4) { totalN4 += qty; n4P += price; n4C++; }
            } else {
              diesel.push(d);
            }
      });

      setDieselLogs(diesel);
      setAdvanceLogs(advLogs);

      const wrLogs = blastingData?.filter(b => b.material_type === 'Weathered Rocks') || [];
      let wrPG=0, wrED=0, wrEDET=0, wrN3=0, wrN4=0;
      wrLogs.forEach(b => { wrPG += b.pg_nos||0; wrED += b.ed_nos||0; wrEDET += b.edet_nos||0; wrN3 += b.nonel_3m_nos||0; wrN4 += b.nonel_4m_nos||0; });

      const avgP = {
        pg: pgC > 0 ? pgP/pgC : 0, ed: edC > 0 ? edP/edC : 0, edet: edetC > 0 ? edetP/edetC : 0, 
        n3: n3C > 0 ? n3P/n3C : 0, n4: n4C > 0 ? n4P/n4C : 0
      };

      const gbExp = {
        pg: Math.max(0, totalPG - wrPG), ed: Math.max(0, totalED - wrED), edet: Math.max(0, totalEDET - wrEDET),
        n3: Math.max(0, totalN3 - wrN3), n4: Math.max(0, totalN4 - wrN4)
      };
      const gbCost = (gbExp.pg*avgP.pg) + (gbExp.ed*avgP.ed) + (gbExp.edet*avgP.edet) + (gbExp.n3*avgP.n3) + (gbExp.n4*avgP.n4);
      setTotalGbCost(gbCost);
      setGbExplosivesSummary({ gbExp, avgP });

      const totalDieselCost = diesel.reduce((sum, d) => sum + (d.quantity_dispatched * d.given_price), 0);

      // Build Bill Items (A, B, C, D, E)
      const bItems: BillItem[] = [
        { slNo: 1, description: 'Q-C - Good Boulder Production', uom: 'MT', rate: 163, qty: totalQC, amount: totalQC * 163, category: 'production', group: 'A' },
        { slNo: 2, description: 'Q-Stock - Good Boulders', uom: 'MT', rate: 163, qty: totalQS, amount: totalQS * 163, category: 'production', group: 'A' },
        { slNo: 3, description: 'Q-Sales - Good Boulders', uom: 'MT', rate: 138, qty: totalQSales, amount: totalQSales * 138, category: 'production', group: 'A' },
        { slNo: 4, description: 'Soil/WR Excavation - Excavator', uom: 'HRS', rate: 1650, qty: totalExcavatorHrs, amount: totalExcavatorHrs * 1650, category: 'production', group: 'B' },
        { slNo: 5, description: 'Soil/WR Excavation - Tipper Loading', uom: 'Trips', rate: 200, qty: totalTipperTrips, amount: totalTipperTrips * 200, category: 'production', group: 'B' },
        { slNo: 6, description: 'Weather Rock Drilling & Blasting', uom: 'FT', rate: 22, qty: totalDrillingFeet, amount: totalDrillingFeet * 22, category: 'production', group: 'B' },
        { slNo: 7, description: 'Stock - Crusher - Good Boulders', uom: 'MT', rate: 40, qty: totalSC, amount: totalSC * 40, category: 'production', group: 'C' },
        { slNo: 8, description: 'Crusher Excavator Engagement', uom: 'HRS', rate: 1650, qty: totalCrusherExcHrs, amount: totalCrusherExcHrs * 1650, category: 'production', group: 'C' },
        { slNo: 'ADV', description: 'Advance Deductions', uom: 'Amount', rate: 1, qty: totalAdv, amount: -totalAdv, category: 'deduction', group: 'D' },
        { slNo: 'DSL', description: 'Diesel Deductions', uom: 'Ltrs', rate: 1, qty: diesel.reduce((s,d)=>s+d.quantity_dispatched,0), amount: -totalDieselCost, category: 'deduction', group: 'D' },
        { slNo: 'EXP', description: 'Explosives (Good Boulders) Deductions', uom: 'Value', rate: 1, qty: 1, amount: -gbCost, category: 'deduction', group: 'D' }
      ];

      // Last Month Bill (Group E)
      try {
        const prevMonthDate = new Date(startDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        
        // 1. Check Supabase for saved bill
        const { data: dbBill } = await supabase
          .from('accounts')
          .select('amount')
          .eq('transaction_type', 'contractor_bill')
          .eq('customer_name', contractorName)
          .eq('reason', prevMonthStr)
          .maybeSingle();

        let lastMonthAmount = dbBill ? parseFloat(dbBill.amount) : 0;

        // 2. Fallback to localStorage if not in DB
        if (lastMonthAmount === 0) {
          const storedBills = localStorage.getItem('sribaba_contractor_bills');
          const allBills = storedBills ? JSON.parse(storedBills) : [];
          const localBill = allBills.find((b: any) => b.contractorName === contractorName && b.month === prevMonthStr);
          if (localBill) lastMonthAmount = localBill.amount;
        }

        // 3. Special Case: Mar 2026 Govindraj Bill (Auto-injection fallback)
        if (lastMonthAmount === 0 && contractorName.toLowerCase().includes('govind') && prevMonthStr === 'Mar 2026') {
          lastMonthAmount = 225783.24;
        }
        
        if (lastMonthAmount > 0) {
          bItems.push({
            slNo: 'LMB',
            description: `Last Month Balance (${prevMonthStr})`,
            uom: 'Value',
            rate: 1,
            qty: lastMonthAmount,
            amount: lastMonthAmount,
            category: 'production',
            group: 'E'
          });
        }
      } catch (err) {
        console.error('Error fetching last month bill:', err);
      }

      setBillItems(bItems);

    } catch (err) {
      console.error('Error fetching master report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Contractor Master Report');

    // Headers
    ws.addRow([`CONTRACTOR MASTER REPORT: ${contractorName}`]).font = { bold: true, size: 16 };
    ws.addRow([`Reporting Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]).font = { italic: true, size: 12 };
    ws.addRow([]);

    // 1. BILLING SUMMARY (Section from Calculator)
    ws.addRow(['I. MONTHLY BILLING SUMMARY']).font = { bold: true, size: 14 };
    const bHeader = ws.addRow(['Sl.No.', 'Item Description', 'UOM', 'Rate', 'QTY', 'Amount']);
    bHeader.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });

    const groups = [
      { id: 'A', title: 'Group A: Quarry Good Boulders', color: 'FF2563EB' },
      { id: 'B', title: 'Group B: Soil/Weather Rocks', color: 'FFEAB308' },
      { id: 'C', title: 'Group C: Crusher works', color: 'FFDC2626' },
      { id: 'D', title: 'Group D: Advance / Deductions', color: 'FF9333EA' },
      { id: 'E', title: 'Group E: Brought Forward', color: 'FF4F46E5' }
    ];

    let grandTotal = 0;
    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length === 0 && g.id !== 'E') return;

      const gRow = ws.addRow([g.title]);
      gRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      gRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.color } };
      ws.mergeCells(gRow.number, 1, gRow.number, 6);

      let subtotal = 0;
      items.forEach(i => {
        ws.addRow([i.slNo, i.description, i.uom, i.rate, i.qty, Math.round(i.amount)]);
        subtotal += i.amount;
      });

      const sRow = ws.addRow(['', 'Section Subtotal:', '', '', '', Math.round(subtotal)]);
      sRow.font = { bold: true };
      sRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      
      grandTotal += subtotal;
    });

    const tRow = ws.addRow(['', 'Estimated Net Payable:', '', '', '', Math.round(grandTotal)]);
    tRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    tRow.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    ws.addRow([]);

    // 2. PRODUCTION SUMMARY (Daily Table)
    ws.addRow(['II. DAILY PRODUCTION SUMMARY']).font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
    const pHeader = ws.addRow([
      'DATE', 
      'Q-C (MT)', 
      'Q-STOCK (MT)', 
      'Q-SALES (MT)', 
      'S-C (MT)', 
      'SOIL/WR EXC HRS', 
      'SOIL/WR TRIPS', 
      'WR DRILLING FT', 
      'CRUSHER EXC HRS'
    ]);
    pHeader.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    });
    dailyData.forEach(d => ws.addRow([
      formatDate(d.date), d.qcQty, d.qsQty, d.qSalesQty, d.scQty, d.soilExcHrs, d.soilTipperTrips, d.wrDrillingFt, d.crusherExcHrs
    ]));
    ws.addRow([
      'TOTAL',
      dailyData.reduce((s,d)=>s+d.qcQty,0),
      dailyData.reduce((s,d)=>s+d.qsQty,0),
      dailyData.reduce((s,d)=>s+d.qSalesQty,0),
      dailyData.reduce((s,d)=>s+d.scQty,0),
      dailyData.reduce((s,d)=>s+d.soilExcHrs,0),
      dailyData.reduce((s,d)=>s+d.soilTipperTrips,0),
      dailyData.reduce((s,d)=>s+d.wrDrillingFt,0),
      dailyData.reduce((s,d)=>s+d.crusherExcHrs,0)
    ]).font = { bold: true };
    ws.addRow([]);

    // 3. DEDUCTION LOGS (Advances & Diesel)
    ws.addRow(['III. ITEMIZED DEDUCTIONS (ADVANCES & DIESEL)']).font = { bold: true, size: 14, color: { argb: 'FFB91C1C' } };
    const dHeader = ws.addRow(['DATE', 'TYPE', 'REASON / LOG', 'QTY / UNIT', 'TOTAL (₹)']);
    dHeader.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
    });
    
    advanceLogs.forEach(a => ws.addRow([formatDate(a.transaction_date), 'ADVANCE', a.reason || a.notes, '-', a.amount_given]));
    dieselLogs.forEach(d => ws.addRow([formatDate(d.dispatch_date), 'DIESEL', d.item_name, d.quantity_dispatched, d.quantity_dispatched * d.given_price]));
    
    ws.addRow([]);
    ws.addRow(['IV. EXPLOSIVES SUMMARY (GOOD BOULDERS)']).font = { bold: true };
    ws.addRow(['Explosive Type', 'Total Dispatched', 'WR Usage', 'GB Net Usage', 'Net Cost (₹)']);
    if (gbExplosivesSummary) {
      const g = gbExplosivesSummary.gbExp;
      const a = gbExplosivesSummary.avgP;
      ws.addRow(['PowerGel (Boxes)', '-', '-', g.pg.toFixed(1), Math.round(g.pg * a.pg)]);
      ws.addRow(['ED (Nos)', '-', '-', g.ed.toFixed(0), Math.round(g.ed * a.ed)]);
      ws.addRow(['EDET (Nos)', '-', '-', g.edet.toFixed(0), Math.round(g.edet * a.edet)]);
      ws.addRow(['Nonel 3m (Nos)', '-', '-', g.n3.toFixed(0), Math.round(g.n3 * a.n3)]);
      ws.addRow(['Nonel 4m (Nos)', '-', '-', g.n4.toFixed(0), Math.round(g.n4 * a.n4)]);
      ws.addRow(['TOTAL EXPLOSIVE COST', '', '', '', Math.round(totalGbCost)]).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contractor_Master_Report_${startDate}_to_${endDate}.xlsx`;
    a.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = `CONTRACTOR MASTER PERFORMANCE REPORT`;
    const period = `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text(title, 14, 22);
    doc.setFontSize(10); doc.setTextColor(200); doc.setFont('helvetica', 'normal'); doc.text(`Contractor: ${contractorName.toUpperCase()} | ${period}`, 14, 32);

    // 1. Billing Summary (Grouped)
    doc.setFontSize(14); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.text('I. MONTHLY BILLING SUMMARY', 14, 52);
    
    const groups = [
      { id: 'A', title: 'Group A: Quarry Good Boulders', color: [37, 99, 235] },
      { id: 'B', title: 'Group B: Soil/Weather Rocks', color: [234, 179, 8] },
      { id: 'C', title: 'Group C: Crusher works', color: [220, 38, 38] },
      { id: 'D', title: 'Group D: Advance / Deductions', color: [147, 51, 234] },
      { id: 'E', title: 'Group E: Brought Forward', color: [79, 70, 229] }
    ];

    const billingBody: any[] = [];
    let grandTotal = 0;

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length === 0 && g.id !== 'E') return;

      // Group Header
      billingBody.push([{ 
        content: g.title, 
        colSpan: 6, 
        styles: { fillColor: g.color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } 
      }]);

      let sectionSubtotal = 0;
      items.forEach(i => {
        billingBody.push([
          i.slNo, 
          i.description, 
          i.uom, 
          i.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 
          i.qty.toLocaleString('en-IN', { minimumFractionDigits: 3 }), 
          Math.round(i.amount).toLocaleString('en-IN')
        ]);
        sectionSubtotal += i.amount;
      });

      // Section Subtotal
      billingBody.push([
        { content: 'Section Subtotal:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: 'Rs ' + Math.round(sectionSubtotal).toLocaleString('en-IN'), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
      ]);

      grandTotal += sectionSubtotal;
    });

    // Grand Total Row
    billingBody.push([
      { content: 'Estimated Net Payable:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 11 } },
      { content: 'Rs ' + Math.round(grandTotal).toLocaleString('en-IN'), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 11 } }
    ]);

    autoTable(doc, {
      startY: 57,
      head: [['Sl.No.', 'Item Description', 'UOM', 'Rate', 'QTY', 'Amount']],
      body: billingBody,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });

    // 2. Explosives Summary (New Page)
    doc.addPage();
    let currentY = 20;
    doc.setFontSize(14); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.text('II. EXPLOSIVES AUDIT (GOOD BOULDERS)', 14, currentY);
    if (gbExplosivesSummary) {
      const g = gbExplosivesSummary.gbExp;
      const a = gbExplosivesSummary.avgP;
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Type', 'Net GB Usage', 'Avg Rate', 'Total Cost (₹)']],
        body: [
          ['PowerGel (Boxes)', g.pg.toFixed(1), a.pg.toFixed(1), Math.round(g.pg * a.pg).toLocaleString()],
          ['ED (Nos)', g.ed.toFixed(0), a.ed.toFixed(1), Math.round(g.ed * a.ed).toLocaleString()],
          ['EDET (Nos)', g.edet.toFixed(0), a.edet.toFixed(1), Math.round(g.edet * a.edet).toLocaleString()],
          ['Nonel 3m (Nos)', g.n3.toFixed(0), a.n3.toFixed(1), Math.round(g.n3 * a.n3).toLocaleString()],
          ['Nonel 4m (Nos)', g.n4.toFixed(0), a.n4.toFixed(1), Math.round(g.n4 * a.n4).toLocaleString()],
          [{ content: 'TOTAL EXPLOSIVE COST', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: '₹' + Math.round(totalGbCost).toLocaleString(), styles: { fontStyle: 'bold' } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Check for page break
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    // 3. Advances Table
    doc.setFontSize(14); doc.text('II. ADVANCES TAKEN', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Reason / Notes', 'Amount (₹)']],
      body: [
        ...advanceLogs.map(a => [formatDate(a.transaction_date), a.reason || a.notes || 'Advance', a.amount_given.toLocaleString()]),
        [{ content: 'TOTAL ADVANCES', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: '₹' + advanceLogs.reduce((s,a)=>s+a.amount_given,0).toLocaleString(), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [153, 27, 27], fontSize: 9 },
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    // 4. Diesel Table
    doc.setFontSize(14); doc.text('III. DIESEL DISPATCHES', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Item Name', 'Quantity (Ltrs)', 'Amount (₹)']],
      body: [
        ...dieselLogs.map(d => [formatDate(d.dispatch_date), d.item_name, d.quantity_dispatched.toFixed(1), Math.round(d.quantity_dispatched * d.given_price).toLocaleString()]),
        [{ content: 'TOTAL DIESEL COST', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: '₹' + Math.round(dieselLogs.reduce((s,d)=>s+(d.quantity_dispatched*d.given_price),0)).toLocaleString(), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [153, 27, 27], fontSize: 9 },
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    // 5. Production Summary (Always new page for table width)
    doc.addPage('landscape'); // Landscape for more columns
    doc.setFontSize(14); doc.text('IV. DAILY PRODUCTION LOG', 14, 20);
    autoTable(doc, {
      startY: 27,
      head: [['Date', 'Q-C', 'Q-Stock', 'Q-Sales', 'S-C', 'Soil Exc', 'Soil Trp', 'WR Drill', 'Crush Exc']],
      body: [
        ...dailyData.map(d => [
          formatDate(d.date), d.qcQty.toFixed(1), d.qsQty.toFixed(1), d.qSalesQty.toFixed(1), d.scQty.toFixed(1), 
          d.soilExcHrs.toFixed(1), d.soilTipperTrips, d.wrDrillingFt.toFixed(0), d.crusherExcHrs.toFixed(1)
        ]),
        [
          { content: 'TOTALS', styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.qcQty,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.qsQty,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.qSalesQty,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.scQty,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.soilExcHrs,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.soilTipperTrips,0).toString(), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.wrDrillingFt,0).toFixed(0), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } },
          { content: dailyData.reduce((s,d)=>s+d.crusherExcHrs,0).toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 249, 255] } }
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
      styles: { fontSize: 7 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')} | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Master_Report_${contractorName}_${format(new Date(), 'ddMMMyy')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Contractor Master Report</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{contractorName} - Combined Performance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <Calendar className="w-4 h-4 text-blue-500 ml-2" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none focus:ring-0"
              />
              <span className="text-slate-400 font-black text-[10px]">TO</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none focus:ring-0"
              />
            </div>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-100"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 flex items-center gap-2 shadow-lg shadow-rose-100"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="lg:col-span-3 py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm">
             <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
             <p className="font-bold text-slate-400">Syncing contractor metrics...</p>
          </div>
        ) : (
          <>
            {/* Left Column: Production & Billing */}
            <div className="lg:col-span-2 space-y-6">
              {/* Production Summary */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Factory className="w-5 h-5 text-blue-600" />
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">Production Summary</h4>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-2 py-4 text-right">Q-C</th>
                        <th className="px-2 py-4 text-right">Q-Stock</th>
                        <th className="px-2 py-4 text-right">Q-Sales</th>
                        <th className="px-2 py-4 text-right">S-C</th>
                        <th className="px-2 py-4 text-right">Soil Exc</th>
                        <th className="px-2 py-4 text-right">Trips</th>
                        <th className="px-2 py-4 text-right">Drilling</th>
                        <th className="px-2 py-4 text-right">Crusher Exc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700">
                      {dailyData.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-slate-500">{formatDate(d.date)}</td>
                          <td className="px-2 py-3 text-right">{d.qcQty.toFixed(1)}</td>
                          <td className="px-2 py-3 text-right">{d.qsQty.toFixed(1)}</td>
                          <td className="px-2 py-3 text-right">{d.qSalesQty.toFixed(1)}</td>
                          <td className="px-2 py-3 text-right">{d.scQty.toFixed(1)}</td>
                          <td className="px-2 py-3 text-right">{d.soilExcHrs.toFixed(1)}</td>
                          <td className="px-2 py-3 text-right">{d.soilTipperTrips}</td>
                          <td className="px-2 py-3 text-right">{d.wrDrillingFt.toFixed(0)}</td>
                          <td className="px-2 py-3 text-right">{d.crusherExcHrs.toFixed(1)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2">
                        <td className="px-4 py-3 uppercase">Total</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.qcQty,0).toFixed(1)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.qsQty,0).toFixed(1)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.qSalesQty,0).toFixed(1)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.scQty,0).toFixed(1)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.soilExcHrs,0).toFixed(1)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.soilTipperTrips,0)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.wrDrillingFt,0).toFixed(0)}</td>
                        <td className="px-2 py-3 text-right">{dailyData.reduce((s,d)=>s+d.crusherExcHrs,0).toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Billing Items */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-emerald-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-emerald-900">Billing Summary</h4>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {billItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.description}</p>
                          <p className="text-sm font-bold text-slate-700">{item.qty.toLocaleString()} {item.uom}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black ${item.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {item.amount < 0 ? '-' : '+'}₹{Math.abs(item.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-8 pt-6 border-t-4 border-dashed border-slate-100 flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">Net Payable Amount</h5>
                        <p className="text-xs text-slate-400 font-bold italic">After all production bonuses and resource deductions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-slate-900 tracking-tight">
                          ₹{billItems.reduce((sum, i) => sum + i.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Deduction Breakdown */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MinusCircle className="w-5 h-5 text-red-600" />
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">Deduction Details</h4>
                </div>

                <div className="space-y-6">
                  {/* Diesel */}
                  <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Diesel Consumed</span>
                      <span className="text-xs font-bold text-slate-600">{dieselLogs.reduce((s,d)=>s+d.quantity_dispatched, 0).toFixed(1)} Ltrs</span>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      ₹{dieselLogs.reduce((s,d)=>s+(d.quantity_dispatched*d.given_price), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  {/* Advances */}
                  <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Cash Advances</span>
                      <span className="text-xs font-bold text-slate-600">{advanceLogs.length} Txns</span>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      ₹{advanceLogs.reduce((s,a)=>s+a.amount_given, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  {/* Explosives */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-white/60">Explosives (Good Boulders)</span>
                      <span className="text-xs font-bold text-white/80 italic">Itemized</span>
                    </div>
                    <div className="text-2xl font-black text-white mb-4">
                      ₹{totalGbCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="space-y-2 text-[10px] font-bold text-white/60">
                      {gbExplosivesSummary && (
                        <>
                          <div className="flex justify-between"><span>PowerGel</span><span>{gbExplosivesSummary.gbExp.pg.toFixed(1)} Boxes</span></div>
                          <div className="flex justify-between"><span>ED + EDET</span><span>{(gbExplosivesSummary.gbExp.ed + gbExplosivesSummary.gbExp.edet).toFixed(0)} Nos</span></div>
                          <div className="flex justify-between"><span>Nonel (3m/4m)</span><span>{(gbExplosivesSummary.gbExp.n3 + gbExplosivesSummary.gbExp.n4).toFixed(0)} Nos</span></div>
                        </>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => {}} // Could link to full deduction report tab
                    className="w-full py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-colors"
                  >
                    View Full Itemized Logs
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl p-8 text-white">
                <TrendingUp className="w-10 h-10 mb-4 opacity-50" />
                <h4 className="text-xl font-black mb-2">Performance Tip</h4>
                <p className="text-sm font-medium text-blue-100 leading-relaxed">
                  Based on the current period, the production yield is stable. Focus on reducing Diesel consumption per MT to optimize the net payable margins.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
