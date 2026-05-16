import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Download, BarChart3, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CostSummary {
  description: string;
  originalCost: number;
  qty: number; // Production MT
  costPerTon: number;
  usageQty: number;
  uom: string;
}

export function QuarryDetailCostReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [summaries, setSummaries] = useState<CostSummary[]>([]);
  const [totalProductionQty, setTotalProductionQty] = useState(0);

  const fmt = (num: number) => num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Total Production Qty (QC + QS + Q-Boulders Sale)
      const { data: transportData } = await supabase
        .from('transport_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const qcQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      const qsQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('items')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      let qSalesQty = 0;
      invoiceData?.forEach(inv => {
        let items = [];
        try {
          items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        } catch (e) {}
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const matName = (item.material || item.material_name || '').toLowerCase();
            if (matName.includes('q-boulder') || matName.includes('q-bolders')) {
              qSalesQty += parseFloat(item.quantity) || (parseFloat(item.gross_weight) - parseFloat(item.empty_weight)) || 0;
            }
          });
        }
      });

      const totalQty = qcQty + qsQty + qSalesQty;
      setTotalProductionQty(totalQty);

      const { data: purchaseTransactions } = await supabase
        .from('inventory_transactions')
        .select('notes, date, inventory_items(item_name)')
        .eq('transaction_type', 'in')
        .lte('date', endDate)
        .order('date', { ascending: false });

      const DIESEL_KEYWORDS = ['DIESEL', 'HSD', 'PETROL', 'FUEL OIL'];

      const EXPLOSIVE_TYPES = [
        { id: 'PG', label: 'Powergel (PG)', keywords: ['PG', 'POWERGEL', 'POWER GEL'] },
        { id: 'ED', label: 'Electric Detonator (ED)', keywords: ['ED ', 'ELECTRIC DET'] },
        { id: 'EDET', label: 'Electronic Detonator (EDET)', keywords: ['EDET', 'ELECTRONIC DET'] },
        { id: 'NONEL_3M', label: 'NONEL 3 Mtrs', keywords: ['NONEL 3M', 'NONEL 3 M', 'NONEL-3M', 'N3'] },
        { id: 'NONEL_4M', label: 'NONEL 4 Mtrs', keywords: ['NONEL 4M', 'NONEL 4 M', 'NONEL-4M', 'N4'] }
      ];
      
      const avgPriceMap: Record<string, { total: number, count: number }> = {
        PG: { total: 0, count: 0 },
        ED: { total: 0, count: 0 },
        EDET: { total: 0, count: 0 },
        NONEL_3M: { total: 0, count: 0 },
        NONEL_4M: { total: 0, count: 0 },
        DIESEL: { total: 0, count: 0 }
      };

      purchaseTransactions?.forEach((t: any) => {
        const itemObj = Array.isArray(t.inventory_items) ? t.inventory_items[0] : t.inventory_items;
        const name = (itemObj?.item_name || '').toUpperCase();
        const match = (t.notes || '').match(/Rate:\s*([\d.]+)/);
        const rate = match ? parseFloat(match[1]) : 0;
        if (rate <= 0) return;

        if (name.includes('POWERGEL') || name.includes('POWER GEL') || name === 'PG') {
          avgPriceMap.PG.total += rate; avgPriceMap.PG.count++;
        } else if (name.includes('ELECTRONIC DET') || name === 'EDET') {
          avgPriceMap.EDET.total += rate; avgPriceMap.EDET.count++;
        } else if (name.includes('ELECTRIC DET') || name === 'ED') {
          avgPriceMap.ED.total += rate; avgPriceMap.ED.count++;
        } else if (name.includes('NONEL') && (name.includes('3M') || name.includes('3 M'))) {
          avgPriceMap.NONEL_3M.total += rate; avgPriceMap.NONEL_3M.count++;
        } else if (name.includes('NONEL') && (name.includes('4M') || name.includes('4 M'))) {
          avgPriceMap.NONEL_4M.total += rate; avgPriceMap.NONEL_4M.count++;
        } else if (DIESEL_KEYWORDS.some(kw => name.includes(kw))) {
          avgPriceMap.DIESEL.total += rate; avgPriceMap.DIESEL.count++;
        }
      });
      const getAvg = (id: string) => {
        const item = avgPriceMap[id];
        return (item && item.count > 0) ? (item.total / item.count) : getPriceAtDate(id === 'NONEL_3M' ? 'N3' : id === 'NONEL_4M' ? 'N4' : id, endDate);
      };

      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('date, pg_nos, pg_unit, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('material_type', 'Weathered Rocks');


      const getPriceAtDate = (type: string, date: string) => {
        const applicable = purchaseTransactions?.find((t: any) => {
          const itemObj = Array.isArray(t.inventory_items) ? t.inventory_items[0] : t.inventory_items;
          const name = (itemObj?.item_name || '').toUpperCase().trim();
          if (t.date > date) return false;
          if (type === 'PG') return name.includes('POWERGEL') || name.includes('POWER GEL') || name === 'PG';
          if (type === 'EDET') return name === 'EDET' || name.includes('ELECTRONIC DET');
          if (type === 'ED') return !name.includes('EDET') && (name === 'ED' || name.includes('ELECTRIC DET'));
          if (type === 'N3') return name.includes('NONEL') && name.includes('3M');
          if (type === 'N4') return name.includes('NONEL') && name.includes('4M');
          if (type === 'DIESEL') return name.includes('DIESEL') || name === 'HSD';
          return false;
        });
        if (applicable) {
          const match = (applicable.notes || '').match(/Rate:\s*([\d.]+)/);
          return match ? parseFloat(match[1]) : 0;
        }
        return 0;
      };

      const wrCostMap: Record<string, number> = { PG: 0, ED: 0, EDET: 0, NONEL_3M: 0, NONEL_4M: 0 };
      blastingData?.forEach(b => {
        const pg = b.pg_unit === 'nos' ? (b.pg_nos || 0) / 200 : (b.pg_nos || 0);
        wrCostMap.PG += (pg * getPriceAtDate('PG', b.date));
        wrCostMap.ED += ((b.ed_nos || 0) * getPriceAtDate('ED', b.date));
        wrCostMap.EDET += ((b.edet_nos || 0) * getPriceAtDate('EDET', b.date));
        wrCostMap.NONEL_3M += ((b.nonel_3m_nos || 0) * getPriceAtDate('N3', b.date));
        wrCostMap.NONEL_4M += ((b.nonel_4m_nos || 0) * getPriceAtDate('N4', b.date));
      });

      // 4. Dispatch Totals for Usage tracking
      const usageMap: Record<string, { qty: number, uom: string }> = { 
        PG: { qty: 0, uom: 'Boxes' }, 
        ED: { qty: 0, uom: 'Nos' }, 
        EDET: { qty: 0, uom: 'Nos' }, 
        NONEL_3M: { qty: 0, uom: 'Nos' },
        NONEL_4M: { qty: 0, uom: 'Nos' },
        DIESEL: { qty: 0, uom: 'Ltrs' } 
      };
      
      const wrUsageMap: Record<string, number> = { PG: 0, ED: 0, EDET: 0, NONEL_3M: 0, NONEL_4M: 0 };
      blastingData?.forEach(b => {
        wrUsageMap.PG += (b.pg_unit === 'nos' ? (b.pg_nos || 0) / 200 : (b.pg_nos || 0));
        wrUsageMap.ED += (b.ed_nos || 0);
        wrUsageMap.EDET += (b.edet_nos || 0);
        wrUsageMap.NONEL_3M += (b.nonel_3m_nos || 0);
        wrUsageMap.NONEL_4M += (b.nonel_4m_nos || 0);
      });

      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, given_price, unit, dispatch_date')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);

      let contractorDieselCost = 0;
      dispatchData?.forEach((d: any) => {
        const name = (d.item_name || '').toUpperCase();
        const dQty = parseFloat(d.quantity_dispatched) || 0;
        const dUnit = (d as any).unit?.toLowerCase();

        const isPG   = name.includes('POWERGEL') || name.includes('POWER GEL') || name === 'PG';
        const isEDET = name === 'EDET' || name.includes('ELECTRONIC DET');
        const isED   = !isEDET && (name === 'ED' || name.includes('ELECTRIC DET'));
        const isN3   = name.includes('NONEL') && (name.includes('3M') || name.includes('3 M'));
        const isN4   = name.includes('NONEL') && (name.includes('4M') || name.includes('4 M'));

        if (isPG) usageMap.PG.qty += (dUnit === 'nos' ? dQty / 200 : dQty);
        else if (isEDET) usageMap.EDET.qty += dQty;
        else if (isED) usageMap.ED.qty += dQty;
        else if (isN3) usageMap.NONEL_3M.qty += dQty;
        else if (isN4) usageMap.NONEL_4M.qty += dQty;
        else {
          const originalPrice = getPriceAtDate('DIESEL', (d as any).dispatch_date);
          contractorDieselCost += dQty * originalPrice;
          usageMap.DIESEL.qty += dQty;
        }
      });

      // Summary Construction
      const totalQtySafe = totalQty || 1;
      const newSummaries: CostSummary[] = [];
      const EXPLOSIVE_TYPES_LIST = [...EXPLOSIVE_TYPES];

      EXPLOSIVE_TYPES_LIST.forEach(type => {
        const netUsage = Math.max(0, (usageMap[type.id]?.qty || 0) - (wrUsageMap[type.id] || 0));
        const avgRate = getAvg(type.id);
        const originalCost = netUsage * avgRate;

        if (originalCost > 0 || netUsage > 0) {
          newSummaries.push({
            description: type.label,
            originalCost: originalCost,
            qty: totalQty,
            costPerTon: originalCost / totalQtySafe,
            usageQty: netUsage,
            uom: usageMap[type.id]?.uom || '—'
          });
        }
      });

      // Add Diesel
      const dieselAvg = getAvg('DIESEL');
      const dieselNetUsage = usageMap.DIESEL.qty;
      const dieselOriginalCost = dieselNetUsage * dieselAvg;

      newSummaries.push({
        description: 'Diesel Expense',
        originalCost: dieselOriginalCost,
        qty: totalQty,
        costPerTon: dieselOriginalCost / totalQtySafe,
        usageQty: dieselNetUsage,
        uom: 'Ltrs'
      });

      setSummaries(newSummaries);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quarry Detail Cost');
    
    // ── Header Section ────────────────────────────────────────────────────────
    ws.addRow(['QUARRY DETAIL COST ANALYSIS REPORT']).font = { bold: true, size: 16, color: { argb: 'FF1E293B' } };
    ws.addRow([`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`]).font = { italic: true, size: 11, color: { argb: 'FF64748B' } };
    ws.addRow([`Generated on: ${new Date().toLocaleString()}`]).font = { size: 10, color: { argb: 'FF94A3B8' } };
    ws.addRow([]);

    // ── Summary Cards Section (Simulation in Excel) ───────────────────────────
    const summaryRow = ws.addRow(['KEY PERFORMANCE INDICATORS']);
    summaryRow.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
    ws.addRow(['Total Production:', `${fmt(totalProductionQty)} MT`]).font = { bold: true };
    
    const totalExplosiveOriginal = summaries.filter(s => s.description !== 'Diesel Expense').reduce((a, b) => a + b.originalCost, 0);
    ws.addRow(['Explosives Cost / Ton:', `Rs. ${fmt(totalExplosiveOriginal / (totalProductionQty || 1))}`]).font = { bold: true };
    
    const dieselOriginal = summaries.find(s => s.description === 'Diesel Expense')?.originalCost || 0;
    ws.addRow(['Diesel Cost / Ton:', `Rs. ${fmt(dieselOriginal / (totalProductionQty || 1))}`]).font = { bold: true };
    ws.addRow([]);

    // ── Explosives Section ────────────────────────────────────────────────────
    const expLabel = ws.addRow(['EXPLOSIVES SECTION']);
    expLabel.font = { bold: true, size: 12, color: { argb: 'FF6366F1' } };
    
    const head = ws.addRow(['Item Description', 'Net Usage Qty', 'Original Cost (Rs.)', 'Production (MT)', 'Cost / Ton (Rs.)']);
    head.height = 30;
    head.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const explosives = summaries.filter(s => s.description !== 'Diesel Expense');
    explosives.forEach((s, idx) => {
      const row = ws.addRow([s.description, `${fmt(s.usageQty)} ${s.uom}`, s.originalCost, s.qty, s.costPerTon]);
      row.height = 25;
      row.alignment = { vertical: 'middle' };
      row.eachCell(c => {
        if (idx % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      row.getCell(3).numFmt = '"Rs." #,##0.00';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '"Rs." #,##0.00';
    });

    ws.addRow([]); // Gap

    // ── Diesel Section ────────────────────────────────────────────────────────
    const dLabel = ws.addRow(['DIESEL SECTION']);
    dLabel.font = { bold: true, size: 12, color: { argb: 'FFF59E0B' } };
    
    const dHead = ws.addRow(['Item Description', 'Net Usage Qty', 'Diesel per Ton', 'Original Cost (₹)', 'Cost / Ton (₹)']);
    dHead.height = 30;
    dHead.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const diesel = summaries.find(s => s.description === 'Diesel Expense');
    if (diesel) {
      const dieselPerTon = totalProductionQty > 0 ? diesel.usageQty / totalProductionQty : 0;
      const dRow = ws.addRow([diesel.description, `${fmt(diesel.usageQty)} ${diesel.uom}`, dieselPerTon, diesel.originalCost, diesel.costPerTon]);
      dRow.height = 25;
      dRow.alignment = { vertical: 'middle' };
      dRow.eachCell(c => {
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      dRow.getCell(3).numFmt = '0.000 "Ltrs/MT"';
      dRow.getCell(4).numFmt = '"Rs." #,##0.00';
      dRow.getCell(5).numFmt = '"Rs." #,##0.00';
    }

    ws.addRow([]); // Gap

    // ── Totals Row ────────────────────────────────────────────────────────────
    const totalOriginal = summaries.reduce((acc, s) => acc + s.originalCost, 0);
    const avgCostPerTon = totalOriginal / (totalProductionQty || 1);
    const totalRow = ws.addRow(['GRAND CONSOLIDATED TOTAL', '', '', totalOriginal, avgCostPerTon]);
    totalRow.height = 35;
    totalRow.font = { bold: true, size: 12 };
    totalRow.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      c.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
      c.alignment = { vertical: 'middle' };
    });
    totalRow.getCell(4).numFmt = '"Rs." #,##0.00';
    totalRow.getCell(5).numFmt = '"Rs." #,##0.00';

    // Auto-fit columns
    ws.columns.forEach(col => {
      col.width = 25;
      col.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    ws.getColumn(1).width = 40;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarry_Detail_Cost_${startDate}_to_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // ── Header Branding ───────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('QUARRY DETAIL COST ANALYSIS', 14, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 37);

    // ── Summary Cards Section ─────────────────────────────────────────────────
    const totalExplosiveOriginal = summaries.filter(s => s.description !== 'Diesel Expense').reduce((a, b) => a + b.originalCost, 0);
    const dieselOriginal = summaries.find(s => s.description === 'Diesel Expense')?.originalCost || 0;
    const grandTotal = summaries.reduce((acc, s) => acc + s.originalCost, 0);

    // Cards Container
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(10, 50, 190, 30, 2, 2, 'F');
    
    // Total Production
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text('TOTAL PRODUCTION', 14, 60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fmt(totalProductionQty)} MT`, 14, 72);

    // Explosives / Ton
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('EXPLOSIVES COST / MT', 60, 60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(`Rs. ${fmt(totalExplosiveOriginal / (totalProductionQty || 1))}`, 60, 72);

    // Diesel / Ton
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('DIESEL COST / MT', 110, 60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text(`Rs. ${fmt(dieselOriginal / (totalProductionQty || 1))}`, 110, 72);

    // Grand Total / Ton
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('CONSOLIDATED / MT', 160, 60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`Rs. ${fmt(grandTotal / (totalProductionQty || 1))}`, 160, 72);

    // ── Explosives Table ──────────────────────────────────────────────────────
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(12);
    doc.text('EXPLOSIVES DETAILED BREAKDOWN', 14, 92);
    
    const explosives = summaries.filter(s => s.description !== 'Diesel Expense');
    autoTable(doc, {
      startY: 95,
      head: [['Item Description', 'Net Usage Qty', 'Original Cost', 'Production', 'Cost / Ton']],
      body: explosives.map(s => [
        s.description,
        `${fmt(s.usageQty || 0)} ${s.uom}`,
        `Rs. ${fmt(s.originalCost)}`,
        `${fmt(s.qty)} MT`,
        `Rs. ${fmt(s.costPerTon)}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9, halign: 'center' },
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    // ── Diesel Table ──────────────────────────────────────────────────────────
    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.setTextColor(217, 119, 6);
    doc.setFontSize(12);
    doc.text('DIESEL CONSUMPTION ANALYSIS', 14, nextY - 3);
    
    const diesel = summaries.find(s => s.description === 'Diesel Expense');
    if (diesel) {
      const dieselPerTon = totalProductionQty > 0 ? diesel.usageQty / totalProductionQty : 0;
      autoTable(doc, {
        startY: nextY,
        head: [['Item Description', 'Usage Qty', 'Consumption Rate', 'Original Cost', 'Costing / Ton']],
        body: [[
          diesel.description,
          `${fmt(diesel.usageQty || 0)} Ltrs`,
          `${dieselPerTon.toFixed(3)} Ltrs/MT`,
          `Rs. ${fmt(diesel.originalCost)}`,
          `Rs. ${fmt(diesel.costPerTon)}`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9, halign: 'center' },
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(10, 282, 200, 282);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Quarry Detail Cost Analysis Report - Confidential', 10, 288);
      doc.text(`Page ${i} of ${pageCount}`, 200, 288, { align: 'right' });
    }

    doc.save(`Quarry_Detail_Cost_${startDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Quarry Detail Cost Report</h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Explosives & Diesel Costing per Ton</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              />
              <span className="text-slate-400 font-bold">→</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              />
            </div>
            <button onClick={exportToExcel} className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-colors border border-emerald-100">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={exportToPDF} className="p-3 bg-red-50 text-red-700 rounded-2xl hover:bg-red-100 transition-colors border border-red-100">
              <BarChart3 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-blue-900 font-black text-sm uppercase tracking-wider">Total Production</span>
            </div>
            <div className="text-3xl font-black text-blue-900">{fmt(totalProductionQty)} <span className="text-lg">MT</span></div>
          </div>

          {(() => {
            const totalExplosiveOriginal = summaries.filter(s => s.description !== 'Diesel Expense').reduce((a, b) => a + b.originalCost, 0);
            const dieselOriginal = summaries.find(s => s.description === 'Diesel Expense')?.originalCost || 0;
            return (
              <>
                <div className="bg-purple-50 border border-purple-100 p-6 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Calculator className="w-5 h-5 text-purple-600" />
                    <span className="text-purple-900 font-black text-sm uppercase tracking-wider">Total Explosives / Ton</span>
                  </div>
                  <div className="text-3xl font-black text-purple-900">₹{fmt(totalExplosiveOriginal / (totalProductionQty || 1))} <span className="text-lg">/ MT</span></div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Calculator className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-900 font-black text-sm uppercase tracking-wider">Diesel Expense / Ton</span>
                  </div>
                  <div className="text-3xl font-black text-amber-900">₹{fmt(dieselOriginal / (totalProductionQty || 1))} <span className="text-lg">/ MT</span></div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Explosives Table Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 ml-2">
            <div className="w-2 h-6 bg-purple-600 rounded-full" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Explosives Section</h4>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Item Description</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Net Usage Qty</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Original Cost (₹)</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Costing / Ton (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold italic">Loading report data...</td></tr>
                ) : summaries.filter(s => s.description !== 'Diesel Expense').length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold italic">No explosive records found.</td></tr>
                ) : summaries.filter(s => s.description !== 'Diesel Expense').map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="font-black text-slate-900 text-sm">{s.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-slate-500">
                      {fmt(s.usageQty || 0)} <span className="text-[10px] text-slate-400">{s.uom}</span>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-slate-600">₹{fmt(s.originalCost)}</td>
                    <td className="px-6 py-5 text-right">
                      <span className="px-4 py-2 rounded-xl font-black text-sm bg-purple-100 text-purple-700">
                        ₹{fmt(s.costPerTon)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diesel Table Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 ml-2">
            <div className="w-2 h-6 bg-amber-600 rounded-full" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Diesel Section</h4>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">Item Description</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Net Usage Qty</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Diesel / Ton</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Original Cost (₹)</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-right">Costing / Ton (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold italic">Loading report data...</td></tr>
                ) : (() => {
                  const s = summaries.find(x => x.description === 'Diesel Expense');
                  if (!s) return <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold italic">No diesel records found.</td></tr>;
                  const dieselPerTon = totalProductionQty > 0 ? s.usageQty / totalProductionQty : 0;
                  return (
                    <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="font-black text-slate-900 text-sm">{s.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-slate-500">
                        {fmt(s.usageQty || 0)} <span className="text-[10px] text-slate-400">{s.uom}</span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-blue-600">
                        {dieselPerTon.toFixed(3)} <span className="text-[10px] text-blue-400">Ltrs/MT</span>
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-slate-600">₹{fmt(s.originalCost)}</td>
                      <td className="px-6 py-5 text-right">
                        <span className="px-4 py-2 rounded-xl font-black text-sm bg-amber-100 text-amber-700">
                          ₹{fmt(s.costPerTon)}
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && summaries.length === 0 && (
          <div className="p-12 text-center">
            <Calculator className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">No expense records found for the selected period.</p>
          </div>
        )}
      </div>
    </div>
  );
}
