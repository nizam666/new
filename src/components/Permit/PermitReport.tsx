import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileDown, Table } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PermitReportData {
    id: string;
    application_no: string;
    challan_no: string;
    challan_date: string;
    bank_ref: string;
    payment_mode: string;
    bsr_code: string;
    dmf_reference: string;
    gst_reference: string;
    gst_payment_date: string;
    payment_date: string;
    approval_date: string;
    quantity_in_mt: string;
    royalty_amount: string;
    mbl: string;
    gf: string;
    total_cost: string;
    tds: string;
    dmf: string;
    permit_serial_start: string;
    permit_serial_end: string;
    postal_received_date: string;
    company_name: string;
    royalty_base: string;
    royalty_gst: string;
    dmf_base: string;
    dmf_gst: string;
    gf_base: string;
    gf_gst: string;
    miscellaneous: string;
    single_permit_ton: string;
    expiry_date: string;
}

export function PermitReport({ companyName }: { companyName?: string }) {
    const [permits, setPermits] = useState<PermitReportData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermits = async () => {
            try {
                let query = supabase
                    .from('permits')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (companyName) {
                    query = query.eq('company_name', companyName);
                }

                const { data, error } = await query;

                if (error) throw error;
                setPermits(data || []);
            } catch (error) {
                console.error('Error fetching permits:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPermits();
    }, [companyName]);

    const exportPDF = () => {
        const doc = new jsPDF('landscape');

        const isKvss = companyName === 'kvss' || !companyName;

        // 1. Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Quarry Permit Data", 14, 15);

        // 2. Metadata Block Container (Light Gray Fill, Border)
        doc.setFillColor(242, 242, 242);
        doc.rect(14, 18, 269, 28, 'F');
        doc.setDrawColor(210, 210, 210);
        doc.rect(14, 18, 269, 28, 'D');
        
        // Column 1 - Company Details
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("COMPANY DETAILS:", 18, 23);
        doc.setFont("helvetica", "normal");
        doc.text(isKvss ? "K V S Subrahmaniyam\nHalekundani Vepannapali Road\nKrishnagiri" : "Sri Baba Blue Metals", 18, 27);
        doc.text(`Place: ${isKvss ? "Halekundani" : "-"} | Land: ${isKvss ? "Patta" : "-"}`, 18, 41);

        // Column 2 - Quarry Land References
        doc.setFont("helvetica", "bold");
        doc.text("QUARRY LAND REF:", 110, 23);
        doc.setFont("helvetica", "normal");
        doc.text(`SF No: ${isKvss ? "20/1A (Part)" : "-"}`, 110, 27);
        doc.text(`Area: ${isKvss ? "0.78.13 Hectares" : "-"}`, 110, 31);
        doc.text(`Ref: ${isKvss ? "2260/2023 Mines Dated 27.09.2024" : "-"}`, 110, 35);

        // Column 3 - Permitted Quantities
        doc.setFont("helvetica", "bold");
        doc.text("PERMITTED QUANTITIES:", 190, 23);
        doc.setFont("helvetica", "normal");
        doc.text(`Total Period: 27/09/2024 to 26/09/2029`, 190, 27);
        doc.text(`Total Allowed: 68690 cu.m / 1,88,897 MT`, 190, 31);
        doc.text(`Year 1 Period: 27/09/2024 to 26/09/2025`, 190, 35);
        doc.text(`Year 1 Allowed: 13738 cu.m / 37,779 MT`, 190, 39);

        // 3. Setup Table Structure
        const tableColumn = [
            "S.No", "Pay Date", "Permit Date", "Ton",
            "Royalty", "MBL Tax", "GF 10%", "Total Rs", "TDS 2%",
            "DMF 10%", "GST 18%", "GST Paid", "GST Bal",
            "Total Amt", "Total Paid", "Bal Pay",
            "Reference / Serials & Running Balances"
        ];

        const runningAllowedTotal = isKvss ? 37779 : 100000;
        let lastBalance = runningAllowedTotal;

        // Sort permits chronologically (ascending) for accurate running balance
        const sortedPermits = [...permits].sort((a, b) => {
            const dateA = a.payment_date || a.approval_date || '';
            const dateB = b.payment_date || b.approval_date || '';
            return dateA.localeCompare(dateB);
        });

        let totalQty = 0;
        let totalRoyalty = 0;
        let totalMbl = 0;
        let totalGf = 0;
        let totalTds = 0;
        let totalDmf = 0;
        let totalGstSeigniorage = 0;
        let totalGstDmf = 0;
        let totalGstGf = 0;
        let totalGstPayment = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalBalance = 0;

        const tableRows = sortedPermits.map((permit, index) => {
            const qty = parseFloat(permit.quantity_in_mt) || 0;
            const royaltyBase = parseFloat(permit.royalty_base) || (qty * 33);
            const mbl = parseFloat(permit.mbl) || 0;
            const gfBase = parseFloat(permit.gf_base) || (royaltyBase * 0.10);
            
            const totalAmountInRs = royaltyBase + mbl + gfBase;
            const tds = parseFloat(permit.tds) || (royaltyBase * 0.02);
            const dmfBase = parseFloat(permit.dmf_base) || (royaltyBase * 0.10);
            
            const royaltyGst = parseFloat(permit.royalty_gst) || (royaltyBase * 0.18);
            const dmfGst = parseFloat(permit.dmf_gst) || (dmfBase * 0.18);
            const gfGst = parseFloat(permit.gf_gst) || (gfBase * 0.18);
            
            const gstTotal = royaltyGst + dmfGst + gfGst;
            const hasGstPaid = !!(permit.gst_reference || permit.gst_payment_date);
            const gstPayment = hasGstPaid ? gstTotal : 0;
            const gstBalance = gstTotal - gstPayment;
            
            const rowTotalAmount = totalAmountInRs + tds + dmfBase + gstTotal;
            const rowTotalPaid = totalAmountInRs + tds + dmfBase + gstPayment;
            const balancePayment = rowTotalAmount - rowTotalPaid;
            
            const currentTotalQty = lastBalance;
            const balanceQty = currentTotalQty - qty;
            lastBalance = balanceQty;

            const singleTon = parseFloat(permit.single_permit_ton) || 25;
            const totalPermitsCount = Math.round(qty / singleTon);

            // Accumulate totals
            totalQty += qty;
            totalRoyalty += royaltyBase;
            totalMbl += mbl;
            totalGf += gfBase;
            totalTds += tds;
            totalDmf += dmfBase;
            totalGstSeigniorage += royaltyGst;
            totalGstDmf += dmfGst;
            totalGstGf += gfGst;
            totalGstPayment += gstPayment;
            totalAmount += rowTotalAmount;
            totalPaid += rowTotalPaid;
            totalBalance += balancePayment;

            // Compact Reference / details block
            const refs = [
                permit.application_no ? `App: ${permit.application_no}` : '',
                permit.bsr_code ? `TDS Ref: ${permit.bsr_code}` : '',
                permit.dmf_reference ? `DMF Ref: ${permit.dmf_reference}` : '',
                permit.gst_reference ? `GST Ref: ${permit.gst_reference}` : '',
                permit.challan_no ? `Bulk No: ${permit.challan_no}` : '',
                `Serials: ${permit.permit_serial_start || ''} to ${permit.permit_serial_end || ''}`,
                `Permits: ${totalPermitsCount} x ${singleTon}t`,
                `Run Bal: ${balanceQty.toLocaleString()} MT`
            ].filter(Boolean).join('\n');

            return [
                index + 1,
                permit.payment_date || '-',
                permit.approval_date || '-',
                qty.toLocaleString(),
                `₹${royaltyBase.toFixed(2)}`,
                `₹${mbl.toFixed(2)}`,
                `₹${gfBase.toFixed(2)}`,
                `₹${totalAmountInRs.toFixed(2)}`,
                `₹${tds.toFixed(2)}`,
                `₹${dmfBase.toFixed(2)}`,
                `₹${gstTotal.toFixed(2)}`,
                `₹${gstPayment.toFixed(2)}`,
                `₹${gstBalance.toFixed(2)}`,
                `₹${rowTotalAmount.toFixed(2)}`,
                `₹${rowTotalPaid.toFixed(2)}`,
                `₹${balancePayment.toFixed(2)}`,
                refs
            ];
        });

        // Construct dynamic Totals row at the very top (index 0) of body
        const totalRow = [
            "Total",
            "",
            "",
            totalQty.toLocaleString(),
            `₹${totalRoyalty.toFixed(2)}`,
            `₹${totalMbl.toFixed(2)}`,
            `₹${totalGf.toFixed(2)}`,
            `₹${(totalRoyalty + totalMbl + totalGf).toFixed(2)}`,
            `₹${totalTds.toFixed(2)}`,
            `₹${totalDmf.toFixed(2)}`,
            `₹${(totalGstSeigniorage + totalGstDmf + totalGstGf).toFixed(2)}`,
            `₹${totalGstPayment.toFixed(2)}`,
            `₹${(totalGstSeigniorage + totalGstDmf + totalGstGf - totalGstPayment).toFixed(2)}`,
            `₹${totalAmount.toFixed(2)}`,
            `₹${totalPaid.toFixed(2)}`,
            `₹${totalBalance.toFixed(2)}`,
            ""
        ];

        const finalTableRows = [totalRow, ...tableRows];

        // Draw AutoTable
        autoTable(doc, {
            head: [tableColumn],
            body: finalTableRows,
            startY: 50,
            styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
            headStyles: { fillColor: [255, 255, 0], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { cellWidth: 7, halign: 'center' },  // S.no
                1: { cellWidth: 14, halign: 'center' }, // Pay Date
                2: { cellWidth: 14, halign: 'center' }, // Permit Date
                3: { cellWidth: 11, halign: 'right' },  // Ton
                4: { cellWidth: 13, halign: 'right' },  // Royalty
                5: { cellWidth: 13, halign: 'right' },  // MBL
                6: { cellWidth: 13, halign: 'right' },  // GF
                7: { cellWidth: 15, halign: 'right' },  // Total Rs
                8: { cellWidth: 11, halign: 'right' },  // TDS
                9: { cellWidth: 11, halign: 'right' },  // DMF
                10: { cellWidth: 13, halign: 'right' }, // GST Total
                11: { cellWidth: 13, halign: 'right' }, // GST Paid
                12: { cellWidth: 13, halign: 'right' }, // GST Bal
                13: { cellWidth: 15, halign: 'right' }, // Total Amt
                14: { cellWidth: 15, halign: 'right' }, // Total Paid
                15: { cellWidth: 15, halign: 'right' }, // Bal Pay
                16: { cellWidth: 'auto', fontSize: 5 }   // Reference details
            },
            didParseCell: (data) => {
                // Total row styles
                if (data.row.index === 0) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [230, 240, 250]; // soft light blue
                    data.cell.styles.textColor = [0, 0, 0];
                }
                
                // Highlight yellow visual structure matching the excel cells
                if (data.row.index > 0 && [3, 8, 9, 10, 11, 12, 13, 14, 15].includes(data.column.index)) {
                    data.cell.styles.fillColor = [255, 255, 224];
                }
            }
        });

        doc.save(`Permit_Report_${companyName || 'All'}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportExcel = async () => {
        // Sort permits chronologically (ascending) for accurate running balance
        const sortedPermits = [...permits].sort((a, b) => {
            const dateA = a.payment_date || a.approval_date || '';
            const dateB = b.payment_date || b.approval_date || '';
            return dateA.localeCompare(dateB);
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Year 1 - 27.09.2024-26.09.2029');

        // Define column structures & widths
        const columnWidths = [
            { key: 'A', width: 8 },   // S.no
            { key: 'B', width: 15 },  // Date of Payment
            { key: 'C', width: 15 },  // Date of Permit
            { key: 'D', width: 14 },  // Applied Ton
            { key: 'E', width: 16 },  // Royalty in Rs
            { key: 'F', width: 16 },  // MBL TAX
            { key: 'G', width: 16 },  // GF 10% in Rs
            { key: 'H', width: 18 },  // Total Amount in Rs
            { key: 'I', width: 22 },  // Payment Reference
            { key: 'J', width: 14 },  // TDS 2%
            { key: 'K', width: 16 },  // TDS Reference
            { key: 'L', width: 14 },  // DMF 10%
            { key: 'M', width: 20 },  // DMF Reference
            { key: 'N', width: 18 },  // GST 18% Seigniorage
            { key: 'O', width: 14 },  // GST 18% DMF
            { key: 'P', width: 14 },  // GST 18% GF
            { key: 'Q', width: 16 },  // GST Payment
            { key: 'R', width: 22 },  // GST Ref
            { key: 'S', width: 18 },  // GST Balance Payment
            { key: 'T', width: 18 },  // Total Amount
            { key: 'U', width: 18 },  // Total Paid
            { key: 'V', width: 18 },  // Balance Payment
            { key: 'W', width: 16 },  // Permit Start Date
            { key: 'X', width: 16 },  // Permit Last Date
            { key: 'Y', width: 20 },  // Bulk Permit no
            { key: 'Z', width: 20 },  // Permit Serial Start no
            { key: 'AA', width: 20 }, // Permit Serial End no
            { key: 'AB', width: 16 }, // Postal Received Date
            { key: 'AC', width: 16 }, // Total no of Permits
            { key: 'AD', width: 14 }, // Single Permit Ton
            { key: 'AE', width: 16 }, // Quantity Applied in Tons
            { key: 'AF', width: 18 }, // Total Quantity in Tons
            { key: 'AG', width: 18 }  // Balance Quantity in Tons
        ];

        worksheet.columns = columnWidths.map(col => ({ key: col.key, width: col.width }));

        // 1. Setup metadata rows (Row 1 and Row 2)
        const row1 = worksheet.getRow(1);
        row1.height = 45;
        worksheet.getRow(2).height = 15;

        const isKvss = companyName === 'kvss' || !companyName;
        const metadata = {
            A1: 'Quarry Permit Data',
            B1: isKvss ? 'K V S Subrahmaniyam\nHalekundani Vepannapali\nRoad Krishnagiri' : 'Sri Baba Blue Metals',
            C1: isKvss ? 'SF no: 20/1A\n(Part)' : 'SF no: [Not Specified]',
            D1: isKvss ? 'Area: 0.78.13\nHectares' : 'Area: [Not Specified]',
            E1: isKvss ? 'Ref: 2260/2023\nMines Dated\n27.09.2024' : 'Ref: [Not Specified]',
            F1: isKvss ? 'Place:\nHalekundani' : 'Place: [Not Specified]',
            G1: isKvss ? 'Land: Patta' : 'Land: [Not Specified]',
            H1: isKvss ? 'Quarry Permitted date:\n27/09/2024 to\n26/09/2029' : 'Permit Date: [Not Specified]',
            I1: isKvss ? 'Total Permitted\nQuantity 68690 cu.m\nor 1,88,897 MT' : 'Total Permitted Quantity',
            J1: isKvss ? 'Quarry Permitted date:\n27/09/2024 to\n26/09/2025' : 'Yearly Date: [Not Specified]',
            K1: isKvss ? 'Total Permitted\nQuantity 13738 cu.m\nor 37,779 MT' : 'Yearly Quantity: [Not Specified]'
        };

        const styleMetadataCell = (cell: any, text: string) => {
            cell.value = text;
            cell.font = { bold: true, name: 'Calibri', size: 9, color: { argb: '000000' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F2F2F2' }
            };
            cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        };

        Object.entries(metadata).forEach(([cellRef, text]) => {
            const cell = worksheet.getCell(cellRef);
            styleMetadataCell(cell, text);
        });

        // 2. Setup Headers (Row 4)
        const headerRow = worksheet.getRow(4);
        headerRow.height = 28;

        const headers: { [key: string]: string } = {
            A: 'S.no',
            B: 'Date of Payment',
            C: 'Date of Permit',
            D: 'Applied Ton',
            E: 'Royalty in Rs',
            F: 'MBL TAX',
            G: 'GF 10% in Rs',
            H: 'Total Amount in Rs',
            I: 'Payment Reference',
            J: 'TDS 2%',
            K: 'TDS Reference',
            L: 'DMF 10%',
            M: 'DMF Reference',
            N: 'GST 18% Seigniorage',
            O: 'GST 18% DMF',
            P: 'GST 18% GF',
            Q: 'GST Payment',
            R: 'GST Ref',
            S: 'GST Balance Payment',
            T: 'Total Amount',
            U: 'Total Paid',
            V: 'Balance Payment',
            W: 'Permit Start Date',
            X: 'Permit Last Date',
            Y: 'Bulk Permit no',
            Z: 'Permit Serial Start no',
            AA: 'Permit Serial End no',
            AB: 'Postal Received Date',
            AC: 'Total no of Permits',
            AD: 'Single Permit Ton',
            AE: 'Quantity Applied in Tons',
            AF: 'Total Quantity in Tons',
            AG: 'Balance Quantity in Tons'
        };

        Object.entries(headers).forEach(([col, text]) => {
            const cell = headerRow.getCell(col);
            cell.value = text;
            cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: '000000' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF00' }
            };
            cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 3. Process Data and compute values
        const runningAllowedTotal = isKvss ? 37779 : 100000;
        let lastBalance = runningAllowedTotal;

        const dataRows = sortedPermits.map((permit, index) => {
            const qty = parseFloat(permit.quantity_in_mt) || 0;
            const royaltyBase = parseFloat(permit.royalty_base) || (qty * 33);
            const mbl = parseFloat(permit.mbl) || 0;
            const gfBase = parseFloat(permit.gf_base) || (royaltyBase * 0.10);
            
            const totalAmountInRs = royaltyBase + mbl + gfBase;
            const tds = parseFloat(permit.tds) || (royaltyBase * 0.02);
            const dmfBase = parseFloat(permit.dmf_base) || (royaltyBase * 0.10);
            
            const royaltyGst = parseFloat(permit.royalty_gst) || (royaltyBase * 0.18);
            const dmfGst = parseFloat(permit.dmf_gst) || (dmfBase * 0.18);
            const gfGst = parseFloat(permit.gf_gst) || (gfBase * 0.18);
            
            const gstTotal = royaltyGst + dmfGst + gfGst;
            const hasGstPaid = !!(permit.gst_reference || permit.gst_payment_date);
            const gstPayment = hasGstPaid ? gstTotal : 0;
            
            const gstBalance = gstTotal - gstPayment;
            const totalAmount = totalAmountInRs + tds + dmfBase + gstTotal;
            const totalPaid = totalAmountInRs + tds + dmfBase + gstPayment;
            const balancePayment = totalAmount - totalPaid;
            
            const currentTotalQty = lastBalance;
            const balanceQty = currentTotalQty - qty;
            lastBalance = balanceQty;

            const singleTon = parseFloat(permit.single_permit_ton) || 25;
            const totalPermitsCount = qty / singleTon;

            return {
                A: index + 1,
                B: permit.payment_date ? new Date(permit.payment_date) : '-',
                C: permit.approval_date ? new Date(permit.approval_date) : '-',
                D: qty,
                E: royaltyBase,
                F: mbl,
                G: gfBase,
                H: totalAmountInRs,
                I: permit.application_no ? `Application no: ${permit.application_no}` : '-',
                J: tds,
                K: permit.bsr_code || '-',
                L: dmfBase,
                M: permit.dmf_reference ? `Paid thro ${permit.dmf_reference}` : '-',
                N: royaltyGst,
                O: dmfGst,
                P: gfGst,
                Q: permit.gst_payment_date ? new Date(permit.gst_payment_date) : '-',
                R: permit.gst_reference || '-',
                S: gstBalance,
                T: totalAmount,
                U: totalPaid,
                V: balancePayment,
                W: permit.approval_date ? new Date(permit.approval_date) : '-',
                X: permit.expiry_date ? new Date(permit.expiry_date) : '-',
                Y: permit.challan_no || '-',
                Z: permit.permit_serial_start || '-',
                AA: permit.permit_serial_end || '-',
                AB: permit.postal_received_date ? new Date(permit.postal_received_date) : '-',
                AC: Math.round(totalPermitsCount),
                AD: singleTon,
                AE: qty,
                AF: currentTotalQty,
                AG: balanceQty
            };
        });

        // 4. Populate Data Rows starting from row 5
        dataRows.forEach((rowData, i) => {
            const rowNumber = i + 5;
            const row = worksheet.getRow(rowNumber);
            row.height = 20;

            Object.entries(rowData).forEach(([col, val]) => {
                const cell = row.getCell(col);
                cell.value = val;
                
                if (col === 'A' || col === 'B' || col === 'C' || col === 'Q' || col === 'W' || col === 'X' || col === 'AB') {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (typeof val === 'number') {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                }

                if (['E', 'F', 'G', 'H', 'J', 'L', 'N', 'O', 'P', 'S', 'T', 'U', 'V'].includes(col)) {
                    cell.numFmt = '₹ #,##0.00';
                } else if (['D', 'AC', 'AD', 'AE', 'AF', 'AG'].includes(col)) {
                    cell.numFmt = '#,##0';
                }

                if (val instanceof Date) {
                    cell.numFmt = 'dd/mm/yy';
                }

                cell.font = { name: 'Calibri', size: 10 };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                if (['D', 'J', 'L', 'N', 'O', 'P', 'T', 'U', 'V', 'AE', 'AF', 'AG'].includes(col)) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFE0' }
                    };
                }
            });
        });

        // 5. Total Row (Row 3)
        const actualTotalRow = worksheet.getRow(3);
        actualTotalRow.height = 24;
        actualTotalRow.getCell('A').value = 'Total';
        
        const endRow = dataRows.length > 0 ? dataRows.length + 4 : 4;
        const startRow = 5;
        const sumFormula = (col: string) => ({ formula: `SUM(${col}${startRow}:${col}${endRow})` });

        actualTotalRow.getCell('D').value = sumFormula('D');
        actualTotalRow.getCell('E').value = sumFormula('E');
        actualTotalRow.getCell('F').value = sumFormula('F');
        actualTotalRow.getCell('G').value = sumFormula('G');
        actualTotalRow.getCell('H').value = sumFormula('H');
        actualTotalRow.getCell('J').value = sumFormula('J');
        actualTotalRow.getCell('L').value = sumFormula('L');
        actualTotalRow.getCell('N').value = sumFormula('N');
        actualTotalRow.getCell('O').value = sumFormula('O');
        actualTotalRow.getCell('P').value = sumFormula('P');
        
        actualTotalRow.getCell('Q').value = sumFormula('Q');
        actualTotalRow.getCell('S').value = { formula: `SUM(N${startRow}:P${endRow})-Q3` };

        actualTotalRow.getCell('T').value = sumFormula('T');
        actualTotalRow.getCell('U').value = sumFormula('U');
        actualTotalRow.getCell('V').value = sumFormula('V');

        Object.keys(headers).forEach(col => {
            const cell = actualTotalRow.getCell(col);
            cell.font = { bold: true, name: 'Calibri', size: 10 };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'double' },
                right: { style: 'thin' }
            };

            if (['E', 'F', 'G', 'H', 'J', 'L', 'N', 'O', 'P', 'S', 'T', 'U', 'V'].includes(col)) {
                cell.numFmt = '₹ #,##0.00';
            } else if (['D'].includes(col)) {
                cell.numFmt = '#,##0';
            }

            if (col === 'A') {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (cell.value) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });

        worksheet.views = [
            { state: 'frozen', ySplit: 4 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Quarry_Permit_Report_${companyName || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) return <div>Loading report...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Permit Report</h2>
                <div className="flex gap-3">
                    <button
                        onClick={exportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        <Table className="w-4 h-4" />
                        Export Excel
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        <FileDown className="w-4 h-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-700 uppercase bg-yellow-100 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-3">S.No</th>
                            <th className="px-3 py-3">Payment Date</th>
                            <th className="px-3 py-3">Permit Date</th>
                            <th className="px-3 py-3">Ton</th>
                            <th className="px-1 py-3 bg-blue-50/50">Royalty (Base)</th>
                            <th className="px-1 py-3 bg-blue-50/50">DMF (Base)</th>
                            <th className="px-1 py-3 bg-blue-50/50">GF (Base)</th>
                            <th className="px-1 py-3">MBL</th>
                            <th className="px-1 py-3">TDS</th>
                            <th className="px-1 py-3">Royalty GST</th>
                            <th className="px-1 py-3">DMF GST</th>
                            <th className="px-1 py-3">GF GST</th>
                            <th className="px-1 py-3">Misc</th>
                            <th className="px-1 py-3 font-bold text-slate-600 bg-slate-50">Total w/o Misc</th>
                            <th className="px-1 py-3 font-bold text-blue-600">GST Total</th>
                            <th className="px-1 py-3 font-bold text-slate-900">Grand Total</th>
                            <th className="px-1 py-3 min-w-[100px]">Ref / Serials</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {permits.map((permit, index) => {
                            const qty = parseFloat(permit.quantity_in_mt) || 0;
                            const royaltyBase = parseFloat(permit.royalty_base) || (qty * 33);
                            const royaltyGst = parseFloat(permit.royalty_gst) || (royaltyBase * 0.18);
                            const dmfBase = parseFloat(permit.dmf_base) || (royaltyBase * 0.10);
                            const dmfGst = parseFloat(permit.dmf_gst) || (dmfBase * 0.18);
                            const gfBase = parseFloat(permit.gf_base) || (royaltyBase * 0.10);
                            const gfGst = parseFloat(permit.gf_gst) || (gfBase * 0.18);
                            const mbl = parseFloat(permit.mbl) || 0;
                            const tds = parseFloat(permit.tds) || 0;
                            const misc = parseFloat(permit.miscellaneous) || 0;
                            const totalWithoutMisc = (royaltyBase + dmfBase + gfBase + mbl + tds).toFixed(2);
                            const gstTotal = (royaltyGst + dmfGst + gfGst).toFixed(2);
                            const grandTotal = permit.total_cost || (parseFloat(totalWithoutMisc) + misc + parseFloat(gstTotal)).toFixed(2);

                            return (
                                <tr key={permit.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 text-[9px]">
                                    <td className="px-1 py-3 font-medium text-slate-900">{index + 1}</td>
                                    <td className="px-1 py-3 whitespace-nowrap">{permit.payment_date || '-'}</td>
                                    <td className="px-1 py-3 whitespace-nowrap">{permit.approval_date || '-'}</td>
                                    <td className="px-1 py-3 font-bold text-slate-700">{qty.toLocaleString()}</td>
                                    <td className="px-1 py-3 bg-blue-50/30 font-medium">₹{royaltyBase.toFixed(2)}</td>
                                    <td className="px-1 py-3 bg-blue-50/30 font-medium">₹{dmfBase.toFixed(2)}</td>
                                    <td className="px-1 py-3 bg-blue-50/30 font-medium">₹{gfBase.toFixed(2)}</td>
                                    <td className="px-1 py-3">₹{mbl.toLocaleString()}</td>
                                    <td className="px-1 py-3">₹{tds.toLocaleString()}</td>
                                    <td className="px-1 py-3 text-slate-500">₹{royaltyGst.toFixed(2)}</td>
                                    <td className="px-1 py-3 text-slate-500">₹{dmfGst.toFixed(2)}</td>
                                    <td className="px-1 py-3 text-slate-500">₹{gfGst.toFixed(2)}</td>
                                    <td className="px-1 py-3 italic text-slate-400">₹{misc.toLocaleString()}</td>
                                    <td className="px-1 py-3 font-bold text-slate-500 bg-slate-50">₹{parseFloat(totalWithoutMisc).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-1 py-3 text-blue-600 font-bold">₹{gstTotal}</td>
                                    <td className="px-1 py-3 font-black text-slate-900 text-[11px]">₹{parseFloat(grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="px-1 py-3 text-[7px] leading-tight">
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-slate-500">App: <span className="text-slate-900">{permit.application_no || '-'}</span></p>
                                            <p className="font-bold text-slate-500">Srl: <span className="text-slate-900">{permit.permit_serial_start || ''}-{permit.permit_serial_end || ''}</span></p>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
