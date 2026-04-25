import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Calendar, 
  AlertCircle,
  Download,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export function ContractorCalculator() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const contractorName = 'Govindaraj';
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  useEffect(() => {
    calculateBill();
  }, [startDate, endDate]);

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
        // Fetch all expenses related to Govindaraj or reference ID
        const { data: accountsData } = await supabase
          .from('accounts')
          .select('customer_name, amount_given, reason, notes, transaction_type, transaction_date')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);

        if (accountsData) {
          let totalAdvanceAmount = 0;
          
          accountsData.forEach((rec: any) => {
            if (rec.transaction_type !== 'expense' || !(rec.amount_given > 0)) return;
            
            // Check if matches Govindaraj or CON-QRY-001
            const matchesName = rec.customer_name?.toLowerCase().includes(contractorName.toLowerCase());
                               
            const matchesRef = rec.reason?.toLowerCase().includes('con-qry-001') || 
                               rec.notes?.toLowerCase().includes('con-qry-001') || 
                               rec.customer_name?.toLowerCase().includes('con-qry-001');

            if (!matchesName && !matchesRef) return;

            const checkIsAdvance = () => {
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
            };

            if (checkIsAdvance()) {
              totalAdvanceAmount += (rec.amount_given || 0);
            }
          });

          if (totalAdvanceAmount > 0) {
            deductions.push({
              slNo: 'ADV-1',
              description: 'Advance Taken',
              uom: 'Amount',
              rate: 1,
              qty: totalAdvanceAmount,
              amount: -totalAdvanceAmount,
              category: 'deduction',
              group: 'D'
            });
          }
        }

        // Resource Items from Dispatch (Quarry Operations)
        const { data: dispatchData } = await supabase
          .from('inventory_dispatch')
          .select('item_name, quantity_dispatched, given_price, unit')
          .eq('department', 'Quarry Operations')
          .gte('dispatch_date', startDate)
          .lte('dispatch_date', endDate)
          .not('given_price', 'is', null);

        // Fetch Blasting Records for Weathered Rocks
        const { data: blastingData } = await supabase
          .from('blasting_records')
          .select('pg_nos, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos, material_type')
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('material_type', 'Weathered Rocks');
        
        if (dispatchData) {
          const groupedResources: Record<string, { qty: number, amount: number, unit: string, rate: number }> = {};
          
          let totalExplosivesAmount = 0;
          let pgPriceSum = 0, pgCount = 0;
          let edPriceSum = 0, edCount = 0;
          let edetPriceSum = 0, edetCount = 0;
          let nonel3PriceSum = 0, nonel3Count = 0;
          let nonel4PriceSum = 0, nonel4Count = 0;

          dispatchData.forEach(d => {
            const rawName = d.item_name || 'Other Item';
            const isExplosive = /PG|NONEL|DETONATOR|EXPLOSIVE/i.test(rawName);
            const key = isExplosive ? 'Explosives' : rawName;
            
            const isPG = rawName.toUpperCase() === 'PG' || rawName.toUpperCase().includes('POWERGEL');
            const isED = rawName.toUpperCase() === 'ED' || rawName.toUpperCase().includes('ELECTRIC DETONATOR');
            const isEDET = rawName.toUpperCase() === 'EDET' || rawName.toUpperCase().includes('ELECTRONIC DETONATOR');
            const isN3 = rawName.toUpperCase().includes('NONEL') && rawName.toUpperCase().includes('3M');
            const isN4 = rawName.toUpperCase().includes('NONEL') && rawName.toUpperCase().includes('4M');

            const price = d.given_price || 0;
            let qty = d.quantity_dispatched || 0;
            if (isPG && d.unit?.toLowerCase() === 'nos') qty = qty / 200;

            if (isPG) { pgPriceSum += price; pgCount++; }
            else if (isED) { edPriceSum += price; edCount++; }
            else if (isEDET) { edetPriceSum += price; edetCount++; }
            else if (isN3) { nonel3PriceSum += price; nonel3Count++; }
            else if (isN4) { nonel4PriceSum += price; nonel4Count++; }

            if (isExplosive) {
              totalExplosivesAmount += qty * price;
            } else {
              if (!groupedResources[key]) {
                groupedResources[key] = { 
                  qty: 0, 
                  amount: 0, 
                  unit: d.unit || 'Nos', 
                  rate: price 
                };
              }
              groupedResources[key].qty += qty;
              groupedResources[key].amount += qty * price;
            }
          });

          // Calculate average prices
          const avgPrices = {
            pg: pgCount > 0 ? pgPriceSum / pgCount : 0,
            ed: edCount > 0 ? edPriceSum / edCount : 0,
            edet: edetCount > 0 ? edetPriceSum / edetCount : 0,
            nonel3: nonel3Count > 0 ? nonel3PriceSum / nonel3Count : 0,
            nonel4: nonel4Count > 0 ? nonel4PriceSum / nonel4Count : 0
          };

          // Weather Rock explosives cost
          let wrExplosivesCost = 0;
          blastingData?.forEach(b => {
            const pgCost = (b.pg_nos || 0) * (avgPrices.pg || 0);
            const edCost = (b.ed_nos || 0) * (avgPrices.ed || 0);
            const edetCost = (b.edet_nos || 0) * (avgPrices.edet || 0);
            const n3Cost = (b.nonel_3m_nos || 0) * (avgPrices.nonel3 || 0);
            const n4Cost = (b.nonel_4m_nos || 0) * (avgPrices.nonel4 || 0);
            wrExplosivesCost += (pgCost + edCost + edetCost + n3Cost + n4Cost);
          });

          const gbExplosivesCost = Math.max(0, totalExplosivesAmount - wrExplosivesCost);

          // Add Explosives Deductions (ONLY for Good Boulders as requested)
          if (gbExplosivesCost > 0) {
            deductions.push({
              slNo: 'EXP-GB',
              description: 'Resource: Explosives (Good Boulders)',
              uom: 'Value',
              rate: 1,
              qty: gbExplosivesCost,
              amount: -gbExplosivesCost,
              category: 'deduction',
              group: 'D'
            });
          }

          // Add remaining non-explosive individual resources
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

  const exportToExcel = async () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contractor Bill');

    const titleRow = worksheet.addRow([`Contractor Bill: ${contractorName}`]);
    titleRow.font = { name: 'Arial', size: 14, bold: true };

    const periodRow = worksheet.addRow([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]);
    periodRow.font = { name: 'Arial', size: 11, italic: true };
    worksheet.addRow([]); 

    const headerRow = worksheet.addRow(['Sl.No.', 'Item Description', 'UOM', 'Rate (₹)', 'QTY', 'Amount (₹)']);
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const groups = [
      { id: 'A', label: 'Group A: Quarry Good Boulders', color: 'FFDBEAFE', fontColor: 'FF1D4ED8' },
      { id: 'B', label: 'Group B: Soil/Weather Rocks', color: 'FFFFEDD5', fontColor: 'FFC2410C' },
      { id: 'C', label: 'Group C: Crusher works', color: 'FFFEE2E2', fontColor: 'FFB91C1C' },
      { id: 'D', label: 'Group D: Advance / Deductions', color: 'FFF3E8FF', fontColor: 'FF6B21A8' }
    ];

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length > 0) {
        const gRow = worksheet.addRow([g.label]);
        worksheet.mergeCells(`A${gRow.number}:F${gRow.number}`);
        gRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: g.fontColor } };
        gRow.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: g.color }
          };
        });

        items.forEach(item => {
          const iRow = worksheet.addRow([
            item.slNo,
            item.description,
            item.uom,
            item.rate,
            item.qty,
            item.amount
          ]);
          iRow.font = { name: 'Arial', size: 10 };
          iRow.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
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
        sRow.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        });
        worksheet.addRow([]);
      }
    });

    const totalRow = worksheet.addRow(['', 'Estimated Net Payable:', '', '', '', totalBillAmount]);
    worksheet.mergeCells(`B${totalRow.number}:E${totalRow.number}`);
    totalRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.getCell(2).alignment = { horizontal: 'right' };
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };
    });

    if (worksheet.columns) {
      worksheet.columns.forEach(col => {
        if (!col) return;
        let maxLen = 0;
        col.eachCell?.({ includeEmpty: false }, cell => {
          const cellLen = cell.value ? cell.value.toString().length : 0;
          if (cellLen > maxLen) maxLen = cellLen;
        });
        col.width = Math.max(maxLen + 3, 10);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contractor_Bill_${contractorName}_${startDate}_to_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    };

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); 
    doc.text(`Contractor Bill: ${contractorName}`, 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); 
    doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 22);

    const tableRows: any[] = [];
    const groups = [
      { id: 'A', label: 'Group A: Quarry Good Boulders', color: [219, 234, 254], fontColor: [29, 78, 216] },
      { id: 'B', label: 'Group B: Soil/Weather Rocks', color: [255, 237, 213], fontColor: [194, 65, 12] },
      { id: 'C', label: 'Group C: Crusher works', color: [254, 226, 226], fontColor: [185, 28, 28] },
      { id: 'D', label: 'Group D: Advance / Deductions', color: [243, 232, 255], fontColor: [107, 33, 168] }
    ];

    groups.forEach(g => {
      const items = billItems.filter(i => i.group === g.id);
      if (items.length > 0) {
        tableRows.push([
          { content: g.label, colSpan: 6, styles: { fillColor: g.color, textColor: g.fontColor, fontStyle: 'bold' } }
        ]);

        items.forEach(item => {
          tableRows.push([
            item.slNo,
            item.description,
            item.uom,
            `Rs ${item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            `Rs ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);
        });

        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        tableRows.push([
          { content: 'Section Subtotal:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: `Rs ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' } }
        ]);
      }
    });

    tableRows.push([
      { content: 'Estimated Net Payable:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
      { content: `Rs ${totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'right' } }
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Sl.No.', 'Item Description', 'UOM', 'Rate', 'QTY', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }, 
      columnStyles: {
        0: { cellWidth: 15 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      },
      styles: { fontSize: 9 }
    });

    doc.save(`Contractor_Bill_${contractorName}_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            background-color: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-2xl {
            box-shadow: none !important;
          }
          .border {
            border-color: #cbd5e1 !important;
          }
        }
      `}</style>
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 print:border-none print:shadow-none print:p-0">
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

          <div className="flex flex-wrap items-center gap-4 p-1 print:hidden">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-slate-400 font-black text-xs">TO</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={exportToExcel}
              className="px-4 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-200 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            
            <button
              onClick={exportToPDF}
              className="px-4 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
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
