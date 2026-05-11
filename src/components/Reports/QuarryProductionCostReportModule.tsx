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

      // 5. Fetch Blasting Records for WR (Handled below)
      
      // 6. Fetch Permit Records for Group F
      const { data: permitData } = await supabase
        .from('permits')
        .select('*')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

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

      // Fetch Latest Purchase Prices for Original Cost calculation
      const { data: purchaseTransactions } = await supabase
        .from('inventory_transactions')
        .select('notes, date, inventory_items(item_name)')
        .eq('transaction_type', 'in')
        .lte('date', endDate)
        .order('date', { ascending: false });

      const purchasePrices: Record<string, number> = {};
      purchaseTransactions?.forEach(t => {
        const name = ((t.inventory_items as any)?.item_name || '').toUpperCase().trim();
        if (purchasePrices[name]) return; // Only take the latest

        const match = (t.notes || '').match(/Rate:\s*([\d.]+)/);
        if (match) purchasePrices[name] = parseFloat(match[1]);
      });

      // Helper to find purchase price by item type at a specific date
      const getPriceAtDate = (type: 'PG' | 'ED' | 'EDET' | 'N3' | 'N4', date: string) => {
        // Find the latest transaction for this type on or before the given date
        const applicable = purchaseTransactions?.find(t => {
          const name = ((t.inventory_items as any)?.item_name || '').toUpperCase().trim();
          const tDate = t.date;
          if (tDate > date) return false;

          if (type === 'PG') return name === 'PG' || name.includes('POWERGEL') || name.includes('POWER GEL');
          if (type === 'EDET') return name === 'EDET' || name.startsWith('E DET') || name.startsWith('E-DET') || name.includes('ELECTRONIC DET');
          if (type === 'ED') return !name.includes('EDET') && (name === 'ED' || name.startsWith('ELEC DET') || name.includes('ELECTRIC DET'));
          if (type === 'N3') return name.includes('NONEL') && (name.includes('3M') || name.includes('3 M'));
          if (type === 'N4') return name.includes('NONEL') && (name.includes('4M') || name.includes('4 M'));
          return false;
        });

        if (applicable) {
          const match = (applicable.notes || '').match(/Rate:\s*([\d.]+)/);
          return match ? parseFloat(match[1]) : 0;
        }
        return 0;
      };


      let givenDiesel = 0;
      let totalExplosivesDispatched = 0; // total cost of all explosives dispatched
      let totalDieselDispatched = 0;   // total cost of diesel dispatched

      // Per-item given prices (normalized to consumption units)
      let pgGivenPrice = 0;      // price per box
      let edGivenPrice = 0;      // price per nos
      let edetGivenPrice = 0;    // price per nos
      let n3GivenPrice = 0;      // price per nos
      let n4GivenPrice = 0;      // price per nos
      let dieselGivenPrice = 0;  // price per litre

      let totalDispatchedPgBoxes = 0;
      let totalDispatchedEd = 0;
      let totalDispatchedEdet = 0;
      let totalDispatchedN3 = 0;
      let totalDispatchedN4 = 0;

      dispatchData?.forEach(d => {
        const name = (d.item_name || '').toUpperCase().trim();
        const originalQty = parseFloat(d.quantity_dispatched) || 0;
        const unit = (d.unit || '').toLowerCase();
        const price = parseFloat(d.given_price) || 0;
        const cost = originalQty * price;

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
          totalExplosivesDispatched += cost;
          pgGivenPrice = (unit === 'nos') ? price * 200 : price;
          totalDispatchedPgBoxes += (unit === 'nos' ? originalQty / 200 : originalQty);
        } else if (isEDET) {
          totalExplosivesDispatched += cost;
          edetGivenPrice = price;
          totalDispatchedEdet += originalQty;
        } else if (isED) {
          totalExplosivesDispatched += cost;
          edGivenPrice = price;
          totalDispatchedEd += originalQty;
        } else if (isN3) {
          totalExplosivesDispatched += cost;
          n3GivenPrice = price;
          totalDispatchedN3 += originalQty;
        } else if (isN4) {
          totalExplosivesDispatched += cost;
          n4GivenPrice = price;
          totalDispatchedN4 += originalQty;
        } else if (isNonel) {
          totalExplosivesDispatched += cost;
        } else {
          // Everything non-explosive dispatched to Quarry Operations is diesel
          givenDiesel += originalQty;
          dieselGivenPrice = price;
          totalDieselDispatched += cost;
        }
      });


      // 5. Fetch Blasting Records for WR (to calculate WR explosives cost)
      const { data: blastingData } = await supabase
        .from('blasting_records')
        .select('date, pg_nos, pg_unit, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('material_type', 'Weathered Rocks');

      let totalWrExplosivesOriginalCost = 0;

      blastingData?.forEach(b => {
        const recordDate = b.date;
        
        // Calculate Qty
        let pg = (b.pg_nos || 0);
        if (b.pg_unit === 'nos') pg = pg / 200;
        
        const ed = (b.ed_nos || 0);
        const edet = (b.edet_nos || 0);
        const n3 = (b.nonel_3m_nos || 0);
        const n4 = (b.nonel_4m_nos || 0);

        // Get prices active on THIS record date
        const pgPrice = getPriceAtDate('PG', recordDate);
        const edPrice = getPriceAtDate('ED', recordDate);
        const edetPrice = getPriceAtDate('EDET', recordDate);
        const n3Price = getPriceAtDate('N3', recordDate);
        const n4Price = getPriceAtDate('N4', recordDate);

        totalWrExplosivesOriginalCost += (pg * pgPrice) + (ed * edPrice) + (edet * edetPrice) + (n3 * n3Price) + (n4 * n4Price);
      });

      // Total WR usage stats (for display qty if needed, though we use cost directly now)
      // Total WR usage stats (for GB deduction)
      let totalPgBoxes = blastingData?.reduce((s, b) => s + (b.pg_unit === 'nos' ? (b.pg_nos || 0) / 200 : (b.pg_nos || 0)), 0) || 0;
      const totalEd = blastingData?.reduce((s, b) => s + (b.ed_nos || 0), 0) || 0;
      const totalEdet = blastingData?.reduce((s, b) => s + (b.edet_nos || 0), 0) || 0;
      const totalN3 = blastingData?.reduce((s, b) => s + (b.nonel_3m_nos || 0), 0) || 0;
      const totalN4 = blastingData?.reduce((s, b) => s + (b.nonel_4m_nos || 0), 0) || 0;

      // WR explosives cost = what was used in blasting × given_price from dispatch

      
      // GB explosives = what was dispatched − what was used for WR
      const gbPg = Math.max(0, totalDispatchedPgBoxes - totalPgBoxes);
      const gbEd = Math.max(0, totalDispatchedEd - totalEd);
      const gbEdet = Math.max(0, totalDispatchedEdet - totalEdet);
      const gbN3 = Math.max(0, totalDispatchedN3 - totalN3);
      const gbN4 = Math.max(0, totalDispatchedN4 - totalN4);
      
      const gbExplosivesCost = (gbPg * pgGivenPrice) + (gbEd * edGivenPrice) + (gbEdet * edetGivenPrice) + (gbN3 * n3GivenPrice) + (gbN4 * n4GivenPrice);
      
      const wrExplosivesOriginalCost = totalWrExplosivesOriginalCost;
      
      // Group F: Permit Calculations
      let permitTotalWithoutMiscPlusGst = 0;
      let permitMiscTotal = 0;

      permitData?.forEach(p => {
        const qty = parseFloat(p.quantity_in_mt) || 0;
        const royaltyBase = parseFloat(p.royalty_base) || (qty * 33);
        const royaltyGst = parseFloat(p.royalty_gst) || (royaltyBase * 0.18);
        const dmfBase = parseFloat(p.dmf_base) || (royaltyBase * 0.10);
        const dmfGst = parseFloat(p.dmf_gst) || (dmfBase * 0.18);
        const gfBase = parseFloat(p.gf_base) || (royaltyBase * 0.10);
        const gfGst = parseFloat(p.gf_gst) || (gfBase * 0.18);
        const mbl = parseFloat(p.mbl) || 0;
        const tds = parseFloat(p.tds) || 0;
        const misc = parseFloat(p.miscellaneous) || 0;

        const totalWithoutMisc = (royaltyBase + dmfBase + gfBase + mbl + tds);
        const gstTotal = (royaltyGst + dmfGst + gfGst);

        permitTotalWithoutMiscPlusGst += (totalWithoutMisc + gstTotal);
        permitMiscTotal += misc;
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
          description: `Original Cost (Explosives Used on Weather Rock)`,
          uom: 'Boxes',
          rate: totalPgBoxes > 0 ? wrExplosivesOriginalCost / totalPgBoxes : 0,
          qty: totalPgBoxes,
          amount: wrExplosivesOriginalCost,
          category: 'production',
          group: 'D'
        },
        {
          slNo: 11,
          description: `Contractor Expense on GB`,
          uom: '—',
          rate: gbExplosivesCost,
          qty: 1,
          amount: gbExplosivesCost,
          category: 'production',
          group: 'D'
        },

        {
          slNo: 12,
          description: 'Original Cost (Vendor Bills — Diesel)',
          uom: '—',
          rate: totalDieselVendorBills,
          qty: 1,
          amount: totalDieselVendorBills,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 13,
          description: `Contractor Diesel Expense: ${givenDiesel.toFixed(2)} Ltrs × ₹${dieselGivenPrice.toFixed(2)}`,
          uom: 'Liters',
          rate: dieselGivenPrice,
          qty: givenDiesel,
          amount: totalDieselDispatched,
          category: 'production',
          group: 'E'
        },
        {
          slNo: 14,
          description: 'Quarry Permit (Statutory Fees + GST)',
          uom: '—',
          rate: permitTotalWithoutMiscPlusGst,
          qty: 1,
          amount: permitTotalWithoutMiscPlusGst,
          category: 'production',
          group: 'F'
        },
        {
          slNo: 15,
          description: 'Miscellaneous Permit Charges',
          uom: '—',
          rate: permitMiscTotal,
          qty: 1,
          amount: permitMiscTotal,
          category: 'production',
          group: 'F'
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
                       - (billItems.find(i => i.group === 'D' && i.slNo === 10)?.amount || 0)
                       - (billItems.find(i => i.group === 'D' && i.slNo === 11)?.amount || 0);
  const groupESubtotal = (billItems.find(i => i.group === 'E' && i.slNo === 13)?.amount || 0)
                       - (billItems.find(i => i.group === 'E' && i.slNo === 12)?.amount || 0);
  const groupFSubtotal = billItems.filter(i => i.group === 'F').reduce((sum, i) => sum + i.amount, 0);
  const totalCostAmount = groupABC + groupDSubtotal + groupESubtotal + groupFSubtotal;

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
      { id: 'E', label: 'Group E: Diesel Expense', color: 'FFE0F2FE', fontColor: 'FF0369A1' },
      { id: 'F', label: 'Group F: Permit Details', color: 'FFF0FDF4', fontColor: 'FF15803D' }
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
          subtotal = (items.find(i => i.slNo === 9)?.amount || 0) - (items.find(i => i.slNo === 10)?.amount || 0) - (items.find(i => i.slNo === 11)?.amount || 0);
        } else if (g.id === 'E') {
          subtotal = (items.find(i => i.slNo === 12)?.amount || 0) - (items.find(i => i.slNo === 13)?.amount || 0);
        } else {
          subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        }
        let label = 'Section Subtotal';
        if (g.id === 'D') label = 'Additional Explosive Cost (Group D Subtotal)';
        else if (g.id === 'E') label = 'Additional Diesel Cost (Group E Subtotal)';
        
        const sRow = worksheet.addRow(['', `${label}:`, '', '', '', subtotal]);
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

    // ── Financial Methodology Notes ──
    worksheet.addRow([]);
    worksheet.addRow([]);
    const noteHeader = worksheet.addRow(['Calculation Methodology & Data Sources']);
    noteHeader.font = { name: 'Arial', size: 10, bold: true };
    
    const note1 = worksheet.addRow(['1. Original Cost (Explosives on WR): Computed as (Actual Consumption from Blasting Form for "Weathered Rocks") × (Latest Original Procurement Price from Inventory Transactions).']);
    const note2 = worksheet.addRow(['2. Contractor Expense on GB: Represents the value of explosives dispatched to Good Boulder operations at site-specific given rates.']);
    const note3 = worksheet.addRow(['3. Net Explosive Cost (Group D Subtotal): Represents the net company cost for explosives (Vendor Bills - WR Original Cost - GB Contractor Charge).']);
    
    [note1, note2, note3].forEach(row => {
      row.font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
    });

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
      { id: 'E', label: 'Group E: Diesel Expense', color: [224, 242, 254], fontColor: [3, 105, 161] },
      { id: 'F', label: 'Group F: Permit Details', color: [240, 253, 244], fontColor: [21, 128, 61] }
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
          subtotal = (items.find(i => i.slNo === 9)?.amount || 0) - (items.find(i => i.slNo === 10)?.amount || 0) - (items.find(i => i.slNo === 11)?.amount || 0);
          subtotalLabel = 'Additional Explosive Cost (Group D Subtotal):';
        } else if (g.id === 'E') {
          subtotal = (items.find(i => i.slNo === 12)?.amount || 0) - (items.find(i => i.slNo === 13)?.amount || 0);
          subtotalLabel = 'Additional Diesel Cost (Group E Subtotal):';
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
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-purple-700">Additional Explosive Cost (Group D Subtotal):</td>
                    <td className="px-6 py-3 text-right text-xs text-purple-800 font-black">
                      {groupDSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-sky-700">Additional Diesel Cost (Group E Subtotal):</td>
                    <td className="px-6 py-3 text-right text-xs text-sky-800 font-black">
                      {groupESubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Group F */}
                  <tr className="bg-emerald-50 text-emerald-900 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-6 py-3 font-black text-xs">Group F: Permit Details</td>
                  </tr>
                  {billItems.filter(i => i.group === 'F').map((item, idx) => (
                    <tr key={`F-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{item.slNo}</td>
                      <td className="px-6 py-3 text-slate-800 text-xs">{item.description}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{item.uom}</td>
                      <td className="px-6 py-3 text-right text-slate-600 text-xs">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right text-slate-800 text-xs">{item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900 text-xs">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/80 border-b border-emerald-200 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-right text-xs text-emerald-700">Permit Cost Subtotal (Group F):</td>
                    <td className="px-6 py-3 text-right text-xs text-emerald-800 font-black">
                      {groupFSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
