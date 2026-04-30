import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BillItem {
  slNo: string | number;
  description: string;
  uom: string;
  rate: number;
  qty: number;
  amount: number;
  category: string;
  group: string;
}

export function QuarryProductionCostReportModule() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchCostReport = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Transport Records
      const { data: transportData } = await supabase
        .from('transport_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 2. Fetch Invoices
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('items, invoice_date')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      // 3. Fetch Loading Records
      const { data: loadingData } = await supabase
        .from('loading_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 4. Fetch Drilling Records
      const { data: drillingData } = await supabase
        .from('drilling_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      // 5. Fetch Blasting Records for Group D (Explosives)
      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('pg_nos, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('material_type', 'Weathered Rocks');

      // 7. Fetch Dispatches for Group E (Given Items to Quarry Store)
      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, unit')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);

      let givenDiesel = 0;
      let givenPg = 0;
      let givenEd = 0;
      let givenEdet = 0;
      let givenN3 = 0;
      let givenN4 = 0;

      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase();
        const qty = parseFloat(d.quantity_dispatched) || 0;
        const unit = (d.unit || '').toLowerCase();

        if (name.includes('DIESEL') || name === 'HSD') {
          givenDiesel += qty;
        } else if (name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL')) {
          givenPg += (unit === 'nos' ? qty / 200 : qty);
        } else if (name === 'ED' || name.includes('ELECTRIC DETONATOR')) {
          givenEd += qty;
        } else if (name === 'EDET' || name.includes('ELECTRONIC DETONATOR')) {
          givenEdet += qty;
        } else if (name.includes('NONEL') && name.includes('3M')) {
          givenN3 += qty;
        } else if (name.includes('NONEL') && name.includes('4M')) {
          givenN4 += qty;
        }
      });

      // 6. Fetch Inventory Transactions to determine explosive rate
      const { data: invTrans } = await supabase
        .from('inventory_transactions')
        .select('notes, inventory_items(item_name)')
        .eq('transaction_type', 'in');

      const itemPrices: Record<string, { sum: number; count: number }> = {};
      invTrans?.forEach(t => {
        const itemName = (t.inventory_items as any)?.item_name || '';
        const notes = t.notes || '';
        const rateMatch = notes.match(/Rate:\s*([\d.]+)/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          const key = itemName.trim().toUpperCase();
          if (!itemPrices[key]) {
            itemPrices[key] = { sum: 0, count: 0 };
          }
          itemPrices[key].sum += rate;
          itemPrices[key].count += 1;
        }
      });

      const explosiveRates: Record<string, number> = {};
      Object.entries(itemPrices).forEach(([name, data]) => {
        explosiveRates[name] = data.sum / data.count;
      });

      const getExplosiveRate = (names: string[], defaultRate: number) => {
        for (const name of names) {
          const key = name.toUpperCase();
          if (explosiveRates[key]) return explosiveRates[key];
        }
        return defaultRate;
      };

      const pgRate = getExplosiveRate(['PG', 'POWERGEL'], 0);
      const edRate = getExplosiveRate(['ED', 'ELECTRIC DETONATOR'], 0);
      const edetRate = getExplosiveRate(['EDET', 'ELECTRONIC DETONATOR'], 0);
      const n3Rate = getExplosiveRate(['NONEL 3M', 'NONEL_3M'], 0);
      const n4Rate = getExplosiveRate(['NONEL 4M', 'NONEL_4M'], 0);
      const dieselRate = getExplosiveRate(['DIESEL', 'HSD'], 0);

      let totalPg = 0;
      let totalEd = 0;
      let totalEdet = 0;
      let totalN3 = 0;
      let totalN4 = 0;

      blastingData?.forEach(b => {
        totalPg += (b.pg_nos || 0);
        totalEd += (b.ed_nos || 0);
        totalEdet += (b.edet_nos || 0);
        totalN3 += (b.nonel_3m_nos || 0);
        totalN4 += (b.nonel_4m_nos || 0);
      });

      // Calculations:
      const qcQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      const qsQty = transportData
        ?.filter(r => r.from_location === 'Quarry' && r.to_location === 'Stockyard' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

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

      const scQty = transportData
        ?.filter(r => r.from_location === 'Stockyard' && r.to_location === 'Crusher' && r.material_transported === 'Good Boulders')
        .reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;

      const excavatorHours = loadingData
        ?.filter(r => ['KVSS Soil', 'KVSS Weather Rocks'].includes(r.material_type))
        .reduce((sum, r) => {
          const run = (r.ending_hours || 0) - (r.starting_hours || 0);
          return sum + (run > 0 ? run : 0);
        }, 0) || 0;

      const tipperTrips = transportData
        ?.filter(r => ['Soil', 'Weather Rocks'].includes(r.material_transported))
        .reduce((sum, r) => sum + (r.number_of_trips || 0), 0) || 0;

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

      const dieselDrilling = drillingData
        ?.filter(r => r.material_type === 'Weathered Rocks' || r.material_type === 'Weather Rock')
        .reduce((sum, r) => sum + (parseFloat(r.diesel_consumed) || 0), 0) || 0;

      const dieselLoading = loadingData
        ?.filter(r => r.material_type === 'KVSS Weather Rocks' || r.material_type === 'Weather Rocks')
        .reduce((sum, r) => sum + (parseFloat(r.quantity_loaded) || 0), 0) || 0;

      const totalDieselWR = dieselDrilling + dieselLoading;

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
          description: 'Soil/WR Excavation - Excavator',
          uom: 'HRS',
          rate: 1650,
          qty: excavatorHours,
          amount: excavatorHours * 1650,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 5,
          description: 'Soil/WR Excavation - Tipper Loading',
          uom: 'Trips',
          rate: 200,
          qty: tipperTrips,
          amount: tipperTrips * 200,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 6,
          description: 'Weather Rock Drilling and Blasting',
          uom: 'Feet',
          rate: 22,
          qty: drillingFeet,
          amount: drillingFeet * 22,
          category: 'production',
          group: 'B'
        },
        {
          slNo: 7,
          description: 'Stock - Crusher - Good Boulders',
          uom: 'MT',
          rate: 40,
          qty: scQty,
          amount: scQty * 40,
          category: 'production',
          group: 'C'
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
        },
        {
          slNo: 9,
          description: 'Explosives - PG (Weathered Rocks)',
          uom: 'Box',
          rate: pgRate,
          qty: totalPg / 200,
          amount: (totalPg / 200) * pgRate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 10,
          description: 'Explosives - ED (Weathered Rocks)',
          uom: 'Nos',
          rate: edRate,
          qty: totalEd,
          amount: totalEd * edRate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 11,
          description: 'Explosives - EDET (Weathered Rocks)',
          uom: 'Nos',
          rate: edetRate,
          qty: totalEdet,
          amount: totalEdet * edetRate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 12,
          description: 'Explosives - NONEL 3M (Weathered Rocks)',
          uom: 'Nos',
          rate: n3Rate,
          qty: totalN3,
          amount: totalN3 * n3Rate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 13,
          description: 'Explosives - NONEL 4M (Weathered Rocks)',
          uom: 'Nos',
          rate: n4Rate,
          qty: totalN4,
          amount: totalN4 * n4Rate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 14,
          description: 'Diesel (Weathered Rocks)',
          uom: 'Liters',
          rate: dieselRate,
          qty: totalDieselWR,
          amount: totalDieselWR * dieselRate,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 15,
          description: 'Remaining - Diesel (Quarry Ops)',
          uom: 'Liters',
          rate: dieselRate,
          qty: givenDiesel - totalDieselWR,
          amount: (givenDiesel - totalDieselWR) * dieselRate,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 16,
          description: 'Remaining - PG (Quarry Ops)',
          uom: 'Box',
          rate: pgRate,
          qty: givenPg - (totalPg / 200),
          amount: (givenPg - (totalPg / 200)) * pgRate,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 17,
          description: 'Remaining - ED (Quarry Ops)',
          uom: 'Nos',
          rate: edRate,
          qty: givenEd - totalEd,
          amount: (givenEd - totalEd) * edRate,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 18,
          description: 'Remaining - EDET (Quarry Ops)',
          uom: 'Nos',
          rate: edetRate,
          qty: givenEdet - totalEdet,
          amount: (givenEdet - totalEdet) * edetRate,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 19,
          description: 'Remaining - NONEL 3M (Quarry Ops)',
          uom: 'Nos',
          rate: n3Rate,
          qty: givenN3 - totalN3,
          amount: (givenN3 - totalN3) * n3Rate,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 20,
          description: 'Remaining - NONEL 4M (Quarry Ops)',
          uom: 'Nos',
          rate: n4Rate,
          qty: givenN4 - totalN4,
          amount: (givenN4 - totalN4) * n4Rate,
          category: 'production',
          group: 'E'
        }
      ];

      setBillItems(productionItems);
    } catch (err) {
      console.error('Error fetching cost report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCostReport();
  }, [fetchCostReport]);

  const totalCostAmount = billItems.reduce((sum, item) => sum + item.amount, 0);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quarry Production Costs');

    worksheet.addRow(['Quarry Production Cost Report']).font = { name: 'Arial', size: 14, bold: true };
    worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]).font = { name: 'Arial', size: 11, italic: true };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['Sl.No.', 'Item Description', 'UOM', 'Rate (₹)', 'QTY', 'Amount (₹)']);
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const groups = [
      { id: 'A', label: 'Group A: Quarry Good Boulders', color: 'FFDBEAFE', fontColor: 'FF1D4ED8' },
      { id: 'B', label: 'Group B: Soil/Weather Rocks', color: 'FFFFEDD5', fontColor: 'FFC2410C' },
      { id: 'C', label: 'Group C: Crusher works', color: 'FFFEE2E2', fontColor: 'FFB91C1C' },
      { id: 'D', label: 'Group D: Explosives (Weather Rocks)', color: 'FFF3E8FF', fontColor: 'FF6B21A8' },
      { id: 'E', label: 'Group E: Remaining items (Total Given - Used)', color: 'FFE0F2FE', fontColor: 'FF0369A1' }
    ];

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length > 0) {
        const gRow = worksheet.addRow([g.label]);
        worksheet.mergeCells(`A${gRow.number}:F${gRow.number}`);
        gRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: g.fontColor } };
        gRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.color } }; });

        items.forEach(item => {
          const iRow = worksheet.addRow([item.slNo, item.description, item.uom, item.rate, item.qty, item.amount]);
          iRow.font = { name: 'Arial', size: 10 };
          iRow.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
          iRow.getCell(4).alignment = { horizontal: 'right' };
          iRow.getCell(5).alignment = { horizontal: 'right' };
          iRow.getCell(6).alignment = { horizontal: 'right' };
        });

        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const sRow = worksheet.addRow(['', 'Section Subtotal:', '', '', '', subtotal]);
        worksheet.mergeCells(`B${sRow.number}:E${sRow.number}`);
        sRow.font = { name: 'Arial', size: 10, bold: true };
        sRow.getCell(2).alignment = { horizontal: 'right' };
        sRow.getCell(6).alignment = { horizontal: 'right' };
        sRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
        worksheet.addRow([]);
      }
    });

    const totalRow = worksheet.addRow(['', 'Overall Net Cost:', '', '', '', totalCostAmount]);
    worksheet.mergeCells(`B${totalRow.number}:E${totalRow.number}`);
    totalRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.getCell(2).alignment = { horizontal: 'right' };
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarry_Production_Cost_${startDate}_to_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Quarry Production Cost Report', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 22);

    const tableRows: any[] = [];
    const groups = [
      { id: 'A', label: 'Group A: Quarry Good Boulders', color: [219, 234, 254], fontColor: [29, 78, 216] },
      { id: 'B', label: 'Group B: Soil/Weather Rocks', color: [255, 237, 213], fontColor: [194, 65, 12] },
      { id: 'C', label: 'Group C: Crusher works', color: [254, 226, 226], fontColor: [185, 28, 28] },
      { id: 'D', label: 'Group D: Explosives (Weather Rocks)', color: [243, 232, 255], fontColor: [107, 33, 168] },
      { id: 'E', label: 'Group E: Remaining items (Total Given - Used)', color: [224, 242, 254], fontColor: [3, 105, 161] }
    ];

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length > 0) {
        tableRows.push([{ content: g.label, colSpan: 6, styles: { fillColor: g.color, textColor: g.fontColor, fontStyle: 'bold' } }]);
        items.forEach(item => {
          tableRows.push([
            item.slNo,
            item.description,
            item.uom,
            `₹${item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);
        });
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        tableRows.push([
          { content: 'Section Subtotal:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' } }
        ]);
      }
    });

    tableRows.push([
      { content: 'Overall Net Cost:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
      { content: `₹${totalCostAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'right' } }
    ]);

    autoTable(doc, {
      head: [['Sl.No.', 'Item Description', 'UOM', 'Rate', 'QTY', 'Amount']],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] }
    });

    doc.save(`Quarry_Production_Cost_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Quarry Production Cost Report</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cumulative Yield & Financial Cost Matrices</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-1">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-500"
              />
              <span className="text-slate-400 font-black text-xs">TO</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-500"
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

        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white border-b border-slate-700">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Sl.No</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Item Description</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">UOM</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Rate (₹)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">QTY</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">Loading operational costs...</td>
                </tr>
              ) : billItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center font-bold text-slate-400">No operations records found for this period.</td>
                </tr>
              ) : (
                <>
                  {/* Group A */}
                  <tr className="bg-blue-50 text-blue-900 border-t-2 border-blue-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group A: Quarry Good Boulders</td>
                  </tr>
                  {billItems.filter(i => i.group === 'A').map((item, idx) => (
                    <tr key={`A-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-slate-500">Group A Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-blue-800 font-black">
                      {billItems.filter(i => i.group === 'A').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group B */}
                  <tr className="bg-orange-50 text-orange-900 border-t-2 border-orange-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group B: Soil/Weather Rocks</td>
                  </tr>
                  {billItems.filter(i => i.group === 'B').map((item, idx) => (
                    <tr key={`B-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-slate-500">Group B Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-orange-800 font-black">
                      {billItems.filter(i => i.group === 'B').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group C */}
                  <tr className="bg-red-50 text-red-900 border-t-2 border-red-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group C: Crusher works</td>
                  </tr>
                  {billItems.filter(i => i.group === 'C').map((item, idx) => (
                    <tr key={`C-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-slate-500">Group C Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-red-800 font-black">
                      {billItems.filter(i => i.group === 'C').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group D */}
                  <tr className="bg-purple-50 text-purple-900 border-t-2 border-purple-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Explosives (Weather Rocks)</td>
                  </tr>
                  {billItems.filter(i => i.group === 'D').map((item, idx) => (
                    <tr key={`D-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-slate-500">Group D Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-purple-800 font-black">
                      {billItems.filter(i => i.group === 'D').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group E */}
                  <tr className="bg-sky-50 text-sky-900 border-t-2 border-sky-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Remaining items (Total Given - Used)</td>
                  </tr>
                  {billItems.filter(i => i.group === 'E').map((item, idx) => (
                    <tr key={`E-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-slate-500">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-800 font-black">
                      {billItems.filter(i => i.group === 'E').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Net Overall */}
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={5} className="px-6 py-4 text-right text-sm">Overall Operational Cost:</td>
                    <td className="px-6 py-4 text-right text-sm tracking-wide">
                      ₹{totalCostAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
