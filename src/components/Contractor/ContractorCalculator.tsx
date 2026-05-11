import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calculator, 
  Calendar, 
  AlertCircle,
  Download,
  FileText,
  Save
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
  const [recentBills, setRecentBills] = useState<any[]>([]);

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

            // Any expense or payment related to the contractor should be a deduction
            // except if it's explicitly a "Contractor Bill" (which is the output of this calculator)
            if (rec.transaction_type === 'contractor_bill') return;

            totalAdvanceAmount += (rec.amount_given || 0);
            if (rec.amount > 0 && !rec.amount_given) {
              totalAdvanceAmount += rec.amount;
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

        // Fetch Blasting Records for WR calculation
        const { data: blastingData } = await supabase
          .from('blasting_records')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate);

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
          
          let totalPG = 0, totalED = 0, totalEDET = 0, totalN3 = 0, totalN4 = 0;
          let pgPriceSum = 0, pgCount = 0;
          let edPriceSum = 0, edCount = 0;
          let edetPriceSum = 0, edetCount = 0;
          let nonel3PriceSum = 0, nonel3Count = 0;
          let nonel4PriceSum = 0, nonel4Count = 0;

          dispatchData.forEach(d => {
            const rawName = d.item_name || 'Other Item';
            const name = rawName.toUpperCase().trim();
            
            const isPG   = name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
            const isEDET = name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET') || name.includes('ELECTRONIC DET') || name.includes('E DETONATOR');
            const isED   = !isEDET && (name === 'ED' || name.startsWith('ELEC DET') || name.includes('ELECTRIC DET') || (name.length <= 4 && name.includes('ED')));
            const isN3   = name.includes('NONEL') && (name.includes('3M') || name.includes('3 M') || name.includes('3MTR') || name.includes('3 MTR'));
            const isN4   = name.includes('NONEL') && (name.includes('4M') || name.includes('4 M') || name.includes('4MTR') || name.includes('4 MTR'));
            const isNonel = name.includes('NONEL');

            const isExplosive = isPG || isEDET || isED || isNonel;
            const key = isExplosive ? 'Explosives' : rawName;

            const price = d.given_price || 0;
            let qty = d.quantity_dispatched || 0;

            if (isExplosive) {
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

          // Calculate WR usage
          let wrPG = 0, wrED = 0, wrEDET = 0, wrN3 = 0, wrN4 = 0;
          const wrLogs = blastingData?.filter(b => b.material_type === 'Weathered Rocks') || [];
          wrLogs.forEach(b => {
            // Standardize WR PG to Boxes (1 box = 200 nos)
            const pgVal = (b.pg_nos || 0);
            wrPG += b.pg_unit === 'nos' ? pgVal / 200 : pgVal;
            
            wrED += b.ed_nos || 0;
            wrEDET += b.edet_nos || 0;
            wrN3 += b.nonel_3m_nos || 0;
            wrN4 += b.nonel_4m_nos || 0;
          });

          const avgPrices = {
            pg: pgCount > 0 ? pgPriceSum / pgCount : 0,
            ed: edCount > 0 ? edPriceSum / edCount : 0,
            edet: edetCount > 0 ? edetPriceSum / edetCount : 0,
            nonel3: nonel3Count > 0 ? nonel3PriceSum / nonel3Count : 0,
            nonel4: nonel4Count > 0 ? nonel4PriceSum / nonel4Count : 0
          };

          const gbExplosives = {
            pg: Math.max(0, totalPG - wrPG),
            ed: Math.max(0, totalED - wrED),
            edet: Math.max(0, totalEDET - wrEDET),
            nonel3: Math.max(0, totalN3 - wrN3),
            nonel4: Math.max(0, totalN4 - wrN4),
          };

          const totalGbCost = 
            (gbExplosives.pg * avgPrices.pg) +
            (gbExplosives.ed * avgPrices.ed) +
            (gbExplosives.edet * avgPrices.edet) +
            (gbExplosives.nonel3 * avgPrices.nonel3) +
            (gbExplosives.nonel4 * avgPrices.nonel4);

          // Add Explosives Deductions (Good Boulders Only)
          if (totalGbCost > 0) {
            deductions.push({
              slNo: 'EXP-GB',
              description: 'Resource: Explosives (Good Boulders)',
              uom: 'Value',
              rate: 1,
              qty: 1,
              amount: -totalGbCost,
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

      // Fetch Last Month Bill (Group E)
      try {
        const prevMonthDate = new Date(startDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        
        const { data: lastMonthBill } = await supabase
          .from('accounts')
          .select('amount')
          .eq('transaction_type', 'contractor_bill')
          .eq('customer_name', contractorName)
          .eq('reason', prevMonthStr)
          .maybeSingle();
        
        if (lastMonthBill && parseFloat(lastMonthBill.amount) > 0) {
          const amt = parseFloat(lastMonthBill.amount);
          productionItems.push({
            slNo: 'LMB',
            description: `Last Month Bill (${prevMonthStr})`,
            uom: 'Value',
            rate: 1,
            qty: amt,
            amount: amt,
            category: 'production',
            group: 'E'
          });
        }
      } catch (err) {
        console.error('Error fetching last month bill:', err);
      }

      setBillItems([...productionItems, ...deductions]);
    } catch (err) {
      console.error('Error calculating contractor bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const grossBillAmount = billItems.reduce((sum, item) => sum + item.amount, 0);
  const netPayable = Math.max(0, grossBillAmount);
  const remainingAdvance = grossBillAmount < 0 ? Math.abs(grossBillAmount) : 0;

  useEffect(() => {
    if (!loading && billItems.length > 0) {
      try {
        const isStartOfMonth = startDate === format(startOfMonth(new Date(startDate)), 'yyyy-MM-dd');
        const isEndOfMonth = endDate === format(endOfMonth(new Date(endDate)), 'yyyy-MM-dd');
        const isPastMonthEnd = new Date() > new Date(endDate);
        
        if (isStartOfMonth && isEndOfMonth && isPastMonthEnd) {
          saveCalculation(true);
        }
      } catch (err) {
        // Date parsing error, ignore
      }
    }
  }, [loading, billItems, startDate, endDate]);

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
        fgColor: { argb: 'FF2563EB' }
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
      { id: 'D', label: 'Group D: Advance / Deductions', color: 'FFF3E8FF', fontColor: 'FF6B21A8' },
      { id: 'E', label: 'Group E: Brought Forward', color: 'FFE0E7FF', fontColor: 'FF4338CA' }
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

    if (remainingAdvance > 0) {
      const advRow = worksheet.addRow(['', 'Remaining Advance Balance:', '', '', '', remainingAdvance]);
      worksheet.mergeCells(`B${advRow.number}:E${advRow.number}`);
      advRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB45309' } };
      advRow.getCell(2).alignment = { horizontal: 'right' };
      advRow.getCell(6).alignment = { horizontal: 'right' };
      advRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      });
    }

    const totalRow = worksheet.addRow(['', 'Estimated Net Payable:', '', '', '', netPayable]);
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
      { id: 'D', label: 'Group D: Advance / Deductions', color: [243, 232, 255], fontColor: [107, 33, 168] },
      { id: 'E', label: 'Group E: Brought Forward', color: [224, 231, 255], fontColor: [67, 56, 202] }
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

    if (remainingAdvance > 0) {
      tableRows.push([
        { content: 'Remaining Advance Balance:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] } },
        { content: `Rs ${remainingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [180, 83, 9], halign: 'right' } }
      ]);
    }

    tableRows.push([
      { content: 'Estimated Net Payable:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
      { content: `Rs ${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: 'right' } }
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Sl.No.', 'Item Description', 'UOM', 'Rate', 'QTY', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }, 
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

  const fetchRecentBills = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('transaction_type', 'contractor_bill')
      .eq('customer_name', contractorName)
      .order('transaction_date', { ascending: false })
      .limit(5);
    setRecentBills(data || []);
  };

  const saveCalculation = async (silent = false) => {
    try {
      const monthStr = new Date(startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('transaction_type', 'contractor_bill')
        .eq('customer_name', contractorName)
        .eq('reason', monthStr)
        .maybeSingle();

      const payload = {
        transaction_type: 'contractor_bill',
        customer_name: contractorName,
        amount: netPayable,
        reason: monthStr,
        notes: `[BILL_SNAPSHOT] ${startDate} to ${endDate}`,
        transaction_date: endDate,
        status: 'pending',
        updated_at: new Date().toISOString()
      };

      if (existing) {
        const { error } = await supabase.from('accounts').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounts').insert([payload]);
        if (error) throw error;
      }
      
      if (!silent) alert('Net Payable Amount saved to database successfully!');
      fetchRecentBills();
    } catch (err) {
      console.error('Error saving calculation:', err);
      if (!silent) alert('Failed to save calculation to database.');
    }
  };

  useEffect(() => {
    fetchRecentBills();
  }, []);

  return (
    <div className="space-y-4 md:space-y-6">
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
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Calculator className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight text-center sm:text-left">Contractor Bill Calculator</h3>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest text-center sm:text-left">Automated Quarry billing system</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-1 print:hidden">
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-auto pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-slate-400 font-black text-xs hidden sm:inline">TO</span>
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-auto pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => saveCalculation(false)}
                className="flex-1 sm:flex-none px-4 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" /> Save
              </button>
              
              <button
                onClick={exportToExcel}
                className="flex-1 sm:flex-none px-4 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
              
              <button
                onClick={exportToPDF}
                className="flex-1 sm:flex-none px-4 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-2">Estimated Net Payable</p>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter">
                ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              {remainingAdvance > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                  <span className="text-[10px] md:text-xs font-black text-amber-400 uppercase tracking-widest">
                    Remaining Advance Balance:
                  </span>
                  <span className="text-sm md:text-base font-black text-amber-300">
                    ₹{remainingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center md:items-end">
              <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl mb-3">
                <span className="text-blue-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">Contractor: {contractorName}</span>
              </div>
              <p className="text-slate-500 text-[10px] font-bold text-center md:text-right leading-relaxed max-w-[200px]">
                Net amount after itemized resource deductions and production credits.
              </p>
            </div>
          </div>
        </div>

        {/* Bill Data - Desktop Table View */}
        <div className="hidden md:block overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
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

                  {/* Group E: Brought Forward */}
                  {billItems.filter(i => i.group === 'E').length > 0 && (
                    <>
                      <tr className="bg-indigo-50/50">
                        <td colSpan={6} className="px-6 py-3">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Group E: Brought Forward</span>
                        </td>
                      </tr>
                      {billItems.filter(i => i.group === 'E').map((item) => (
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
                      <tr className="bg-indigo-50/30 border-b border-indigo-100">
                        <td colSpan={5} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-indigo-400">Section Subtotal</td>
                        <td className="px-6 py-3 text-right text-sm font-black text-indigo-600">
                          ₹{billItems.filter(i => i.group === 'E').reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </>
                  )}

                  <tr className="bg-emerald-600 text-white shadow-xl">
                    <td colSpan={5} className="px-6 py-6 text-right text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Net Payable Amount</td>
                    <td className="px-6 py-6 text-right text-2xl font-black text-white">
                      ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Bill Data - Mobile Card View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400">Processing Quarry Data...</p>
            </div>
          ) : billItems.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-sm font-bold text-slate-400 italic">No records found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                { id: 'A', label: 'Group A: Quarry Production', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-100' },
                { id: 'B', label: 'Group B: Soil/Weather Rocks', bgColor: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-100' },
                { id: 'C', label: 'Group C: Crusher Works', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-100' },
                { id: 'D', label: 'Group D: Deductions', bgColor: 'bg-rose-50', textColor: 'text-rose-600', borderColor: 'border-rose-100' },
                { id: 'E', label: 'Group E: Brought Forward', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-100' }
              ].map(group => {
                const items = billItems.filter(i => i.group === group.id);
                if (items.length === 0) return null;
                
                const groupSubtotal = items.reduce((s, i) => s + i.amount, 0);

                return (
                  <div key={group.id} className="space-y-3">
                    <div className={`${group.bgColor} ${group.textColor} px-4 py-2 rounded-xl border ${group.borderColor}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{group.label}</span>
                    </div>
                    
                    {items.map(item => (
                      <div key={item.slNo} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3">
                            <span className="text-xs font-black text-slate-400 mt-0.5">{item.slNo}</span>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.description}</h4>
                          </div>
                          <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-500 uppercase">{item.uom}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rate / QTY</p>
                            <p className="text-xs font-black text-slate-700">
                              ₹{item.rate.toLocaleString()} × {item.qty.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                            <p className={`text-sm font-black ${item.category === 'deduction' ? 'text-rose-600' : 'text-slate-900'}`}>
                              ₹{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section Subtotal</span>
                      <span className={`text-sm font-black ${group.id === 'D' ? 'text-rose-600' : group.textColor}`}>
                        ₹{groupSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="mt-8 bg-slate-900 rounded-2xl p-5 shadow-xl">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Total</span>
                  <span className="text-lg font-black text-blue-400">
                    ₹{billItems.filter(i => i.category === 'production').reduce((s, i) => s + i.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Net Payable</span>
                  <span className="text-2xl font-black text-white">
                    ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-blue-800 leading-relaxed">
            <strong>Note:</strong> Itemized deductions are based on verified field records for {contractorName}. Production values reflect automated logs from transport, loading, and drilling modules.
          </p>
        </div>

        {/* Recent Saved Bills Registry */}
        {recentBills.length > 0 && (
          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 tracking-tight">Recent Saved Bills</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Historical Snapshot Registry</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBills.map((bill) => (
                <div key={bill.id} className="bg-white border border-slate-100 rounded-[30px] p-6 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                      {bill.reason}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {format(new Date(bill.transaction_date), 'dd MMM yyyy')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Payable</p>
                    <h5 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      ₹{bill.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h5>
                  </div>
                  <p className="text-[9px] font-medium text-slate-400 mt-4 italic line-clamp-1 border-t border-slate-50 pt-3">
                    {bill.notes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
