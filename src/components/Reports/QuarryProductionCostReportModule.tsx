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

      // 5. Fetch Blasting Records for WR (to calculate WR explosives cost)
      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('pg_nos, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('material_type', 'Weathered Rocks');

      // Fetch Vendor Bills for Original Cost (from VendorManagement)
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('amount, notes, reason')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .eq('transaction_type', 'expense');

      const EXPLOSIVE_KEYWORDS = ['EXPLOSIVE', 'POWERGEL', 'POWER GEL', 'DETONATOR', 'NONEL',
        ' ED ', 'EDET', ' PG ', 'BLASTING', 'AMMONIUM', 'ANFO'];
      const DIESEL_KEYWORDS = ['DIESEL', 'HSD', 'PETROL', 'FUEL OIL'];

      let totalExplosiveVendorBills = 0;
      let totalDieselVendorBills = 0;

      accountsData?.forEach(acc => {
        if (acc.notes && acc.notes.includes('[BILL_ENTRY]')) {
          const amt = parseFloat(acc.amount) || 0;
          // Combine notes + reason into one searchable string
          const combined = `${acc.notes || ''} ${acc.reason || ''}`.toUpperCase();

          if (DIESEL_KEYWORDS.some(kw => combined.includes(kw))) {
            totalDieselVendorBills += amt;
          } else if (EXPLOSIVE_KEYWORDS.some(kw => combined.includes(kw))) {
            totalExplosiveVendorBills += amt;
          }
          // Bills that don't match either are not counted in Group D or E
        }
      });


      // 7. Fetch Dispatches for Group D & E
      const { data: dispatchData } = await supabase
        .from('inventory_dispatch')
        .select('item_name, quantity_dispatched, unit, given_price')
        .eq('department', 'Quarry Operations')
        .gte('dispatch_date', startDate)
        .lte('dispatch_date', endDate);

      let givenDiesel = 0;
      let givenPg = 0;     // in boxes
      let givenEd = 0;
      let givenEdet = 0;
      let givenN3 = 0;
      let givenN4 = 0;

      // Per-item given prices (for WR cost calculation from blasting records)
      let pgGivenPrice = 0;
      let edGivenPrice = 0;
      let edetGivenPrice = 0;
      let n3GivenPrice = 0;
      let n4GivenPrice = 0;
      let dieselGivenPrice = 0;        // price per litre from dispatch
      let totalExplosivesDispatched = 0; // total cost of all explosives dispatched
      let totalDieselDispatched = 0;   // total cost of diesel dispatched

      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase().trim();
        let qty = parseFloat(d.quantity_dispatched) || 0;
        const unit = (d.unit || '').toLowerCase();
        const price = parseFloat(d.given_price) || 0;

        // Helper: is this item a known explosive type?
        const isPG   = name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
        const isEDET = name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET')
                    || name.includes('ELECTRONIC DET') || name.includes('E DETONATOR');
        const isED   = !isEDET && (name === 'ED' || name.startsWith('ELEC DET')
                    || name.includes('ELECTRIC DET') || (name.length <= 4 && name.includes('ED')));
        const isN3   = name.includes('NONEL') && (name.includes('3M') || name.includes('3 M') || name.includes('3MTR') || name.includes('3 MTR'));
        const isN4   = name.includes('NONEL') && (name.includes('4M') || name.includes('4 M') || name.includes('4MTR') || name.includes('4 MTR'));
        const isNonel= name.includes('NONEL'); // catch-all for any NONEL variant

        if (isPG) {
          if (unit === 'nos') qty = qty / 200;  // convert Nos → Boxes
          givenPg += qty;
          pgGivenPrice = price;
          totalExplosivesDispatched += qty * price;
        } else if (isEDET) {
          givenEdet += qty;
          edetGivenPrice = price;
          totalExplosivesDispatched += qty * price;
        } else if (isED) {
          givenEd += qty;
          edGivenPrice = price;
          totalExplosivesDispatched += qty * price;
        } else if (isN3) {
          givenN3 += qty;
          n3GivenPrice = price;
          totalExplosivesDispatched += qty * price;
        } else if (isN4) {
          givenN4 += qty;
          n4GivenPrice = price;
          totalExplosivesDispatched += qty * price;
        } else if (isNonel) {
          // Any other NONEL variant — sum into total explosives
          totalExplosivesDispatched += qty * price;
        } else {
          // Everything non-explosive dispatched to Quarry Operations is diesel
          givenDiesel += qty;
          dieselGivenPrice = price;
          totalDieselDispatched += qty * price;
        }
      });


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

      // WR explosives cost = what was used in blasting × given_price from dispatch
      const wrExplosivesCost =
        (totalPg / 200) * pgGivenPrice +    // PG in boxes × price/box
        totalEd * edGivenPrice +
        totalEdet * edetGivenPrice +
        totalN3 * n3GivenPrice +
        totalN4 * n4GivenPrice;

      // GB explosives cost = what remains after WR
      const gbExplosivesCost = Math.max(0, totalExplosivesDispatched - wrExplosivesCost);

      // Combined contractor explosives cost (WR + GB)
      const contractorExplosivesValue = wrExplosivesCost + gbExplosivesCost; // = totalExplosivesDispatched

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
          description: `Original Cost (Vendor Bills — Explosives)`,
          uom: '—',
          rate: totalExplosiveVendorBills,
          qty: 1,
          amount: totalExplosiveVendorBills,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 10,
          description: `Contractor Expense: WR Blasting ₹${wrExplosivesCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + GB (All Inventory Dispatched) ₹${gbExplosivesCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          uom: '—',
          rate: contractorExplosivesValue,
          qty: 1,
          amount: contractorExplosivesValue,
          category: 'production',
          group: 'D'
        },

        {
          slNo: 11,
          description: 'Original Cost (Vendor Bills — Diesel)',
          uom: '—',
          rate: totalDieselVendorBills,
          qty: 1,
          amount: totalDieselVendorBills,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 12,
          description: `Contractor Diesel Expense (All Dispatched): ${givenDiesel.toFixed(2)} Ltrs × ₹${dieselGivenPrice.toFixed(2)}`,
          uom: 'Liters',
          rate: dieselGivenPrice,
          qty: givenDiesel,
          amount: totalDieselDispatched,
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

  // Overall = Group A+B+C (sum normally) + Group D subtotal (original−contractor) + Group E subtotal (original−contractor)
  const groupABC = billItems.filter(i => ['A', 'B', 'C'].includes(i.group)).reduce((sum, i) => sum + i.amount, 0);
  const groupDSubtotal = (billItems.find(i => i.group === 'D' && i.slNo === 9)?.amount || 0)
                       - (billItems.find(i => i.group === 'D' && i.slNo === 10)?.amount || 0);
  const groupESubtotal = (billItems.find(i => i.group === 'E' && i.slNo === 11)?.amount || 0)
                       - (billItems.find(i => i.group === 'E' && i.slNo === 12)?.amount || 0);
  const totalCostAmount = groupABC + groupDSubtotal + groupESubtotal;

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quarry Production Costs');

    worksheet.addRow(['Quarry Production Cost Report']).font = { name: 'Arial', size: 14, bold: true };
    worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]).font = { name: 'Arial', size: 11, italic: true };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['Sl.No.', 'Item Description', 'UOM', 'Rate (₹)', 'QTY', 'Amount (₹)']);
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const groups = [
      { id: 'A', label: 'Group A: Quarry Good Boulders', color: 'FFDBEAFE', fontColor: 'FF1D4ED8' },
      { id: 'B', label: 'Group B: Soil/Weather Rocks', color: 'FFFFEDD5', fontColor: 'FFC2410C' },
      { id: 'C', label: 'Group C: Crusher works', color: 'FFFEE2E2', fontColor: 'FFB91C1C' },
      { id: 'D', label: 'Group D: Contractors Expense (Explosives)', color: 'FFF3E8FF', fontColor: 'FF6B21A8' },
      { id: 'E', label: 'Group E: Diesel Expense', color: 'FFE0F2FE', fontColor: 'FF0369A1' }
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

        // For D and E: subtotal = Original Cost − Contractor Expense (difference)
        let subtotal: number;
        if (g.id === 'D') {
          subtotal = (items.find(i => i.slNo === 9)?.amount || 0) - (items.find(i => i.slNo === 10)?.amount || 0);
        } else if (g.id === 'E') {
          subtotal = (items.find(i => i.slNo === 11)?.amount || 0) - (items.find(i => i.slNo === 12)?.amount || 0);
        } else {
          subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        }
        const sRow = worksheet.addRow(['', `${g.id === 'D' || g.id === 'E' ? 'Group ' + g.id + ' Subtotal' : 'Section Subtotal'}:`, '', '', '', subtotal]);
        worksheet.mergeCells(`B${sRow.number}:E${sRow.number}`);
        sRow.font = { name: 'Arial', size: 10, bold: true };
        sRow.getCell(2).alignment = { horizontal: 'right' };
        sRow.getCell(6).alignment = { horizontal: 'right' };
        sRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
        worksheet.addRow([]);
      }
    });

    const totalRow = worksheet.addRow(['', 'Overall Operational Cost:', '', '', '', totalCostAmount]);
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
    const doc = new jsPDF('l', 'mm', 'a4'); // Use landscape for better alignment
    doc.setFontSize(18);
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
      { id: 'D', label: 'Group D: Contractors Expense (Explosives)', color: [243, 232, 255], fontColor: [107, 33, 168] },
      { id: 'E', label: 'Group E: Diesel Expense', color: [224, 242, 254], fontColor: [3, 105, 161] }
    ];

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length > 0) {
        tableRows.push([{ content: g.label, colSpan: 6, styles: { fillColor: g.color, textColor: g.fontColor, fontStyle: 'bold', fontSize: 10 } }]);
        items.forEach(item => {
          tableRows.push([
            item.slNo,
            item.description,
            item.uom,
            item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
          ]);
        });
        // For D and E: subtotal = Original Cost − Contractor Expense (difference)
        let subtotal: number;
        let subtotalLabel: string;
        if (g.id === 'D') {
          subtotal = (items.find(i => i.slNo === 9)?.amount || 0) - (items.find(i => i.slNo === 10)?.amount || 0);
          subtotalLabel = 'Group D Subtotal:';
        } else if (g.id === 'E') {
          subtotal = (items.find(i => i.slNo === 11)?.amount || 0) - (items.find(i => i.slNo === 12)?.amount || 0);
          subtotalLabel = 'Group E Subtotal:';
        } else {
          subtotal = items.reduce((sum, item) => sum + item.amount, 0);
          subtotalLabel = 'Section Subtotal:';
        }
        tableRows.push([
          { content: subtotalLabel, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' } }
        ]);
      }
    });

    tableRows.push([
      { content: 'Overall Operational Cost:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 11 } },
      { content: totalCostAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'right', fontSize: 11 } }
    ]);

    autoTable(doc, {
      head: [['Sl.No.', 'Item Description', 'UOM', 'Rate (Rs.)', 'QTY', 'Amount (Rs.)']],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35 },
        5: { halign: 'right', cellWidth: 45 }
      },
      margin: { top: 30 }
    });

    doc.save(`Quarry_Production_Cost_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Calculator className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Quarry Production Cost Report</h3>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest">Cumulative Yield & Financial Cost Matrices</p>
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
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group D: Contractors Expense</td>
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
                  <tr className="bg-purple-50/80 border-b border-purple-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-purple-700">Group D Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-purple-800 font-black">
                      {((billItems.find(i => i.group === 'D' && i.slNo === 9)?.amount || 0) - (billItems.find(i => i.group === 'D' && i.slNo === 10)?.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group E */}
                  <tr className="bg-sky-50 text-sky-900 border-t-2 border-sky-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group E: Diesel Expense</td>
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
                  <tr className="bg-sky-50/80 border-b border-sky-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-sky-700">Group E Subtotal:</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-800 font-black">
                      {((billItems.find(i => i.group === 'E' && i.slNo === 11)?.amount || 0) - (billItems.find(i => i.group === 'E' && i.slNo === 12)?.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
