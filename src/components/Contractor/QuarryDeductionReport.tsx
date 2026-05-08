import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Download,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DieselDeduction {
  dispatch_date: string;
  item_name: string;
  quantity_dispatched: number;
  unit: string;
  given_price: number;
}

interface AdvanceDeduction {
  transaction_date: string;
  amount_given: number;
  reason: string;
  notes: string;
}

interface ExplosiveUsage {
  date: string;
  material_type: string;
  location: string;
  pg_nos: number;
  ed_nos: number;
  edet_nos: number;
  nonel_3m_nos: number;
  nonel_4m_nos: number;
}

export function QuarryDeductionReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'diesel' | 'advances' | 'explosives' | 'explosives_wr'>('diesel');
  
  const [dieselLogs, setDieselLogs] = useState<DieselDeduction[]>([]);
  const [advanceLogs, setAdvanceLogs] = useState<AdvanceDeduction[]>([]);
  const [explosiveDispatches, setExplosiveDispatches] = useState<any[]>([]);
  const [explosiveWRLogs, setExplosiveWRLogs] = useState<ExplosiveUsage[]>([]);
  const [avgPrices, setAvgPrices] = useState({ pg: 0, ed: 0, edet: 0, nonel3: 0, nonel4: 0 });
  const [wrExplosives, setWrExplosives] = useState({ pg: 0, ed: 0, edet: 0, nonel3: 0, nonel4: 0 });

  const contractorName = 'Govindaraj';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd-MM-yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch all dispatch for Quarry (Diesel + Explosives)
      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('dispatch_date, item_name, quantity_dispatched, given_price, unit')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate)
        .not('given_price', 'is', null)
        .order('dispatch_date', { ascending: true });

      const explosives: any[] = [];
      const diesel: any[] = [];

      let totalPG = 0, totalED = 0, totalEDET = 0, totalN3 = 0, totalN4 = 0;
      let pgPriceSum = 0, pgCount = 0;
      let edPriceSum = 0, edCount = 0;
      let edetPriceSum = 0, edetCount = 0;
      let nonel3PriceSum = 0, nonel3Count = 0;
      let nonel4PriceSum = 0, nonel4Count = 0;

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

        if (isPG || isEDET || isED || isNonel) {
          explosives.push(d);
          
          if (isPG) {
            if (d.unit?.toLowerCase() === 'nos') qty = qty / 200;
            totalPG += qty; pgPriceSum += price; pgCount++;
          } else if (isED) {
            totalED += qty; edPriceSum += price; edCount++;
          } else if (isEDET) {
            totalEDET += qty; edetPriceSum += price; edetCount++;
          } else if (isN3) {
            totalN3 += qty; nonel3PriceSum += price; nonel3Count++;
          } else if (isN4) {
            totalN4 += qty; nonel4PriceSum += price; nonel4Count++;
          }
        } else {
          // Treat as Diesel
          diesel.push({
            ...d,
            quantity_dispatched: qty // ensure it's a number
          });
        }
      });

      setDieselLogs(diesel);
      setExplosiveDispatches(explosives);

      const averages = {
        pg: pgCount > 0 ? pgPriceSum / pgCount : 0,
        ed: edCount > 0 ? edPriceSum / edCount : 0,
        edet: edetCount > 0 ? edetPriceSum / edetCount : 0,
        nonel3: nonel3Count > 0 ? nonel3PriceSum / nonel3Count : 0,
        nonel4: nonel4Count > 0 ? nonel4PriceSum / nonel4Count : 0
      };
      setAvgPrices(averages);

      // 2. Fetch Advances
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('transaction_date, amount_given, reason, notes, transaction_type, customer_name')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .eq('transaction_type', 'expense');

      if (accountsData) {
        const advances = accountsData.filter((rec: any) => {
          if (!(rec.amount_given > 0)) return false;
          const matchesName = rec.customer_name?.toLowerCase().includes(contractorName.toLowerCase()) ||
                             rec.reason?.toLowerCase().includes(contractorName.toLowerCase());
          const matchesRef = rec.reason?.toLowerCase().includes('con-qry-001') || 
                             rec.notes?.toLowerCase().includes('con-qry-001');

          if (!matchesName && !matchesRef) return false;

          if (rec.notes) {
            const parts = rec.notes.split(' | ');
            const itemPart = parts.find((p: string) => p.startsWith('Item: '));
            if (itemPart) {
              const itemValue = itemPart.replace('Item: ', '').toLowerCase();
              if (itemValue.includes('payment')) return false;
              if (itemValue.includes('advance')) return true;
            }
          }
          return rec.reason?.toLowerCase().includes('advance') || 
                 rec.notes?.toLowerCase().includes('advance');
        });
        setAdvanceLogs(advances);
      }

      // 4. Fetch Blasting Records
      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      let wrPG = 0, wrED = 0, wrEDET = 0, wrN3 = 0, wrN4 = 0;
      const wrLogs = blastingData?.filter(b => b.material_type === 'Weathered Rocks') || [];
      wrLogs.forEach(b => {
        wrPG += b.pg_nos || 0;
        wrED += b.ed_nos || 0;
        wrEDET += b.edet_nos || 0;
        wrN3 += b.nonel_3m_nos || 0;
        wrN4 += b.nonel_4m_nos || 0;
      });

      setWrExplosives({ pg: wrPG, ed: wrED, edet: wrEDET, nonel3: wrN3, nonel4: wrN4 });

      if (blastingData) {
        setExplosiveWRLogs(blastingData.filter(b => b.material_type === 'Weathered Rocks'));
      }

    } catch (err) {
      console.error('Error fetching deduction breakdown report:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalDiesel = dieselLogs.reduce((sum, d) => sum + ((d.quantity_dispatched || 0) * (d.given_price || 0)), 0);
  const totalAdvances = advanceLogs.reduce((sum, a) => sum + (a.amount_given || 0), 0);

  const totalExplosivesDispatchCost = explosiveDispatches.reduce((sum, e) => {
    let qty = e.quantity_dispatched || 0;
    const name = (e.item_name || '').toUpperCase();
    if ((name === 'PG' || name.includes('POWERGEL')) && e.unit?.toLowerCase() === 'nos') {
      qty = qty / 200;
    }
    return sum + (qty * (e.given_price || 0));
  }, 0);



  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Quarry Deductions');

    // Title
    const titleRow = ws.addRow([`Quarry Itemized Deductions Report: ${contractorName}`]);
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, 6);

    const periodRow = ws.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]);
    periodRow.font = { italic: true };
    ws.mergeCells(periodRow.number, 1, periodRow.number, 6);
    ws.addRow([]);

    // --- Section 1: Diesel Deductions ---
    const sec1 = ws.addRow(['1. Diesel Deductions']);
    sec1.font = { bold: true, size: 12, color: { argb: 'FF991B1B' } };
    ws.mergeCells(sec1.number, 1, sec1.number, 6);

    const dHeader = ws.addRow(['Date', 'Item Name', 'Quantity', 'Unit', 'Price (₹)', 'Total Cost (₹)']);
    dHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dHeader.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } });
    
    dieselLogs.forEach(d => {
      ws.addRow([formatDate(d.dispatch_date), d.item_name, d.quantity_dispatched, d.unit || 'Ltrs', d.given_price, d.quantity_dispatched * d.given_price]);
    });
    const dTotal = ws.addRow(['Total Diesel', '', '', '', '', totalDiesel]);
    dTotal.font = { bold: true };
    dTotal.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } });
    ws.mergeCells(dTotal.number, 1, dTotal.number, 5);
    ws.addRow([]);
    ws.addRow([]);

    // --- Section 2: Cash Advances ---
    ws.addRow(['2. Cash Advances']).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }; 
    const aHeader = ws.addRow(['Date', 'Amount (₹)', 'Reason', 'Notes']);
    aHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    aHeader.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }); 
    
    advanceLogs.forEach(a => {
      ws.addRow([formatDate(a.transaction_date), a.amount_given, a.reason, a.notes]);
    });
    const aTotal = ws.addRow(['Total Advances', totalAdvances, '', '']);
    aTotal.font = { bold: true };
    aTotal.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }); 
    ws.mergeCells(aTotal.number, 2, aTotal.number, 4);
    ws.addRow([]);

    // --- Section 3: Explosives Dispatches ---
    const sec3 = ws.addRow(['3. Total Explosives Dispatched']);
    sec3.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }; 
    ws.mergeCells(sec3.number, 1, sec3.number, 6);

    const eHeader = ws.addRow(['Date', 'Item Name', 'Quantity', 'Unit', 'Price (₹)', 'Total Cost (₹)']);
    eHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    eHeader.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }); 
    
    explosiveDispatches.forEach(e => {
      const name = (e.item_name || '').toUpperCase();
      let qty = e.quantity_dispatched || 0;
      if ((name === 'PG' || name.includes('POWERGEL')) && e.unit?.toLowerCase() === 'nos') {
        qty = qty / 200;
      }
      ws.addRow([formatDate(e.dispatch_date), e.item_name, qty, (name === 'PG' || name.includes('POWERGEL')) ? 'Box' : (e.unit || 'Nos'), e.given_price, Math.round(qty * e.given_price)]);
    });

    const eTotal = ws.addRow(['Total Explosives', '', '', '', '', totalExplosivesDispatchCost]);
    eTotal.font = { bold: true };
    eTotal.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } });
    ws.mergeCells(eTotal.number, 1, eTotal.number, 5);
    ws.addRow([]);

    // --- Section 4: Explosives (Weathered Rocks) ---
    const sec4 = ws.addRow(['4. Explosives Usage - Weathered Rocks']);
    sec4.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } };
    ws.mergeCells(sec4.number, 1, sec4.number, 7);

    const eWRHeader = ws.addRow(['Date', 'Location', 'PG (Boxes)', 'ED (Nos)', 'EDET (Nos)', 'NLO 3m (Nos)', 'NLO 4m (Nos)']);
    eWRHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    eWRHeader.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }); 
    
    explosiveWRLogs.forEach(e => {
      ws.addRow([formatDate(e.date), e.location, e.pg_nos, e.ed_nos, e.edet_nos, e.nonel_3m_nos, e.nonel_4m_nos]);
    });

    ws.addRow([]);
    const wrCHeaderRow = ws.addRow(['Weathered Rocks Cost Summary']);
    wrCHeaderRow.font = { bold: true };
    ws.mergeCells(wrCHeaderRow.number, 1, wrCHeaderRow.number, 4);

    const wrCHeader = ws.addRow(['Item', 'Qty', 'Unit Price (₹)', 'Total Cost (₹)']);
    wrCHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wrCHeader.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } });

    const cwrPG = wrExplosives.pg * avgPrices.pg;
    const cwrED = wrExplosives.ed * avgPrices.ed;
    const cwrEDET = wrExplosives.edet * avgPrices.edet;
    const cwrN3 = wrExplosives.nonel3 * avgPrices.nonel3;
    const cwrN4 = wrExplosives.nonel4 * avgPrices.nonel4;
    const cwrTotal = cwrPG + cwrED + cwrEDET + cwrN3 + cwrN4;

    ws.addRow(['PowerGel (PG)', wrExplosives.pg, Math.round(avgPrices.pg), Math.round(cwrPG)]);
    ws.addRow(['Electric Detonator', wrExplosives.ed, Math.round(avgPrices.ed), Math.round(cwrED)]);
    ws.addRow(['Electronic Detonator', wrExplosives.edet, Math.round(avgPrices.edet), Math.round(cwrEDET)]);
    ws.addRow(['Nonel 3m', wrExplosives.nonel3, Math.round(avgPrices.nonel3), Math.round(cwrN3)]);
    ws.addRow(['Nonel 4m', wrExplosives.nonel4, Math.round(avgPrices.nonel4), Math.round(cwrN4)]);
    const wrCExpTotal = ws.addRow(['Total Explosives Cost (Weathered Rocks)', '', '', Math.round(cwrTotal)]);
    wrCExpTotal.font = { bold: true };
    wrCExpTotal.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } });
    ws.mergeCells(wrCExpTotal.number, 1, wrCExpTotal.number, 3);
    ws.addRow([]);
    ws.addRow([]);

    const grandTotal = totalDiesel + totalAdvances + totalExplosivesDispatchCost;
    const gRow = ws.addRow(['GRAND TOTAL DEDUCTIONS (1+2+3)', '', '', '', '', Math.round(grandTotal)]);
    gRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    gRow.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } });
    ws.mergeCells(gRow.number, 1, gRow.number, 5);
    ws.addRow([]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarry_Full_Deductions_${startDate}_to_${endDate}.xlsx`;
    a.click();
  };



  const exportToPDF = () => {
    const doc = new jsPDF('portrait');
    const title = `Quarry Full Deductions Report: ${contractorName}`;
    const period = `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`;

    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(period, 14, 22);

    let currentY = 30;

    // 1. Diesel Deductions
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text("1. Diesel Deductions", 14, currentY);
    const dieselRows = dieselLogs.map(d => [
      formatDate(d.dispatch_date), 
      d.item_name, 
      d.quantity_dispatched.toString(), 
      d.unit || 'Ltrs', 
      d.given_price.toLocaleString(), 
      (d.quantity_dispatched * d.given_price).toLocaleString()
    ]);
    dieselRows.push(['Total Diesel', '', '', '', '', totalDiesel.toLocaleString()]);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Item', 'Qty', 'Unit', 'Price', 'Total Cost']],
      body: dieselRows,
      headStyles: { fillColor: [220, 38, 38] },
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 2. Cash Advances
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text("2. Cash Advances", 14, currentY);
    const advanceRows = advanceLogs.map(a => [
      formatDate(a.transaction_date), 
      a.amount_given.toLocaleString(), 
      a.reason || '', 
      a.notes || ''
    ]);
    advanceRows.push(['Total Advances', totalAdvances.toLocaleString(), '', '']);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Amount', 'Reason', 'Notes']],
      body: advanceRows,
      headStyles: { fillColor: [220, 38, 38] },
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 3. Explosives Dispatched
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text("3. Total Explosives Dispatched", 14, currentY);
    const explosiveRows = explosiveDispatches.map(e => {
      const name = (e.item_name || '').toUpperCase();
      let qty = e.quantity_dispatched || 0;
      if ((name === 'PG' || name.includes('POWERGEL')) && e.unit?.toLowerCase() === 'nos') {
        qty = qty / 200;
      }
      return [
        formatDate(e.dispatch_date), 
        e.item_name, 
        qty.toFixed(2), 
        (name === 'PG' || name.includes('POWERGEL')) ? 'Box' : (e.unit || 'Nos'), 
        e.given_price.toLocaleString(), 
        Math.round(qty * e.given_price).toLocaleString()
      ];
    });
    explosiveRows.push(['Total Explosives', '', '', '', '', Math.round(totalExplosivesDispatchCost).toLocaleString()]);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Item Name', 'Qty', 'Unit', 'Price', 'Total Cost']],
      body: explosiveRows,
      headStyles: { fillColor: [220, 38, 38] },
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 4. Explosives WR Logs
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text("4. Explosives (Weather Rock) Blasting Logs", 14, currentY);
    const wrRows = explosiveWRLogs.map(e => [
      formatDate(e.date), 
      e.location, 
      e.pg_nos.toString(), 
      e.ed_nos.toString(), 
      e.edet_nos.toString(), 
      e.nonel_3m_nos.toString(), 
      e.nonel_4m_nos.toString()
    ]);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Loc', 'PG', 'ED', 'EDET', 'NLO 3m', 'NLO 4m']],
      body: wrRows,
      headStyles: { fillColor: [220, 38, 38] },
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Grand Total
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    const grandTotal = totalDiesel + totalAdvances + totalExplosivesDispatchCost;
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(14, currentY, 182, 10, 'F');
    doc.text(`GRAND TOTAL DEDUCTIONS: Rs. ${Math.round(grandTotal).toLocaleString()}`, 105, currentY + 7, { align: 'center' });

    doc.save(`Quarry_Full_Deductions_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Deduction Logs</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Itemized break-ups</p>
            </div>
          </div>

          {/* Date Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold" />
              <span className="text-xs font-black text-slate-400">TO</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold" />
            </div>

            <button onClick={exportToExcel} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center gap-2">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={exportToPDF} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 flex items-center gap-2">
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-4">
          <button onClick={() => setActiveTab('diesel')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'diesel' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            Diesel
          </button>
          <button onClick={() => setActiveTab('advances')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'advances' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            Cash Advance
          </button>
          <button onClick={() => setActiveTab('explosives')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'explosives' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            Explosives
          </button>
          <button onClick={() => setActiveTab('explosives_wr')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'explosives_wr' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            Explosives (Weather Rock)
          </button>
        </div>

        {/* Dynamic Log Render */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-bold">Loading log data...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              {activeTab === 'diesel' && (
                <>
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-400">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Price (₹)</th>
                      <th className="px-4 py-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm font-semibold">
                    {dieselLogs.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs">{formatDate(d.dispatch_date)}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{d.item_name}</td>
                        <td className="px-4 py-3 text-right">{d.quantity_dispatched}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{d.unit || 'Ltrs'}</td>
                        <td className="px-4 py-3 text-right">₹{d.given_price}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-bold">₹{Math.round(d.quantity_dispatched * d.given_price).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td colSpan={5} className="px-4 py-3 text-right">Total Diesel Cost:</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{totalDiesel.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </>
              )}

              {activeTab === 'advances' && (
                <>
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-400">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount (₹)</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm font-semibold">
                    {advanceLogs.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs">{formatDate(a.transaction_date)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-bold">₹{a.amount_given.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{a.reason}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{a.notes}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-right">Total Advances:</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{totalAdvances.toLocaleString('en-IN')}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </>
              )}

              {activeTab === 'explosives' && (
                <>
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-400">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Price (₹)</th>
                      <th className="px-4 py-3 text-right">Total Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm font-semibold">
                    {explosiveDispatches.map((e, i) => {
                      const name = (e.item_name || '').toUpperCase();
                      let qty = e.quantity_dispatched || 0;
                      if ((name === 'PG' || name.includes('POWERGEL')) && e.unit?.toLowerCase() === 'nos') {
                        qty = qty / 200;
                      }
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs">{formatDate(e.dispatch_date)}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{e.item_name}</td>
                          <td className="px-4 py-3 text-right">{qty.toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{(name === 'PG' || name.includes('POWERGEL')) ? 'Box' : (e.unit || 'Nos')}</td>
                          <td className="px-4 py-3 text-right">₹{e.given_price}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-bold">₹{Math.round(qty * e.given_price).toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td colSpan={5} className="px-4 py-3 text-right">Total Explosives Given:</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{Math.round(totalExplosivesDispatchCost).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </>
              )}

              {activeTab === 'explosives_wr' && (
                <>
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-400 text-center">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th>PG (Boxes)</th>
                      <th>ED (Nos)</th>
                      <th>EDET (Nos)</th>
                      <th>NLO 3m (Nos)</th>
                      <th>NLO 4m (Nos)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-bold text-center">
                    {explosiveWRLogs.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-left">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 text-left font-black text-slate-900">{e.location}</td>
                        <td className="py-3 bg-orange-50/50 text-orange-600">{e.pg_nos.toFixed(2)}</td>
                        <td className="py-3">{e.ed_nos}</td>
                        <td className="py-3">{e.edet_nos}</td>
                        <td className="py-3">{e.nonel_3m_nos}</td>
                        <td className="py-3">{e.nonel_4m_nos}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          )}
        </div>


      </div>
    </div>
  );
}
