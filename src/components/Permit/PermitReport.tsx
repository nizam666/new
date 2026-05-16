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

        // Header Details - Similar to Excel Image
        doc.setFontSize(14);
        doc.text('Quarry Permit Data', 14, 15);

        doc.setFontSize(10);
        // Company Details Box (Simplified for now)
        doc.rect(14, 20, 270, 20); // Main Box
        doc.text(`Company: ${companyName || 'All Companies'}`, 16, 26);
        doc.text('SF No: 20/1A', 70, 26); // Hardcoded sample
        doc.text('Area: 0.78.13 Hectares', 120, 26); // Hardcoded sample

        const tableColumn = [
            "S.No", "Payment Date", "Permit Date", "Ton",
            "Royalty (Base)", "DMF (Base)", "GF (Base)", "MBL", "TDS",
            "Royalty GST", "DMF GST", "GF GST", "Misc",
            "Total without Misc", "GST Total", "Grand Total",
            "Ref / Serials"
        ];

        const tableRows = permits.map((permit, index) => {
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

            const details = `App: ${permit.application_no || '-'}\nSrl: ${permit.permit_serial_start || ''}-${permit.permit_serial_end || ''}`;

            return [
                index + 1,
                permit.payment_date || '-',
                permit.approval_date || '-',
                qty.toLocaleString(),
                royaltyBase.toFixed(2),
                dmfBase.toFixed(2),
                gfBase.toFixed(2),
                mbl.toFixed(2),
                tds.toFixed(2),
                royaltyGst.toFixed(2),
                dmfGst.toFixed(2),
                gfGst.toFixed(2),
                misc.toFixed(2),
                totalWithoutMisc,
                gstTotal,
                grandTotal,
                details
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fillColor: [255, 255, 0], textColor: [0, 0, 0] }, // Yellow header
        });

        doc.save(`Permit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportExcel = async () => {
        const rows = permits.map((permit, index) => ({
            "S.No": index + 1,
            "Payment Date": permit.payment_date,
            "Permit Date": permit.approval_date,
            "Quantity (MT)": permit.quantity_in_mt,
            "Royalty Base": permit.royalty_base,
            "DMF Base": permit.dmf_base,
            "GF Base": permit.gf_base,
            "MBL": permit.mbl,
            "TDS": permit.tds,
            "Royalty GST": permit.royalty_gst,
            "DMF GST": permit.dmf_gst,
            "GF GST": permit.gf_gst,
            "Misc": permit.miscellaneous,
            "Total without Misc": (parseFloat(permit.royalty_base || '0') + parseFloat(permit.dmf_base || '0') + parseFloat(permit.gf_base || '0') + parseFloat(permit.mbl || '0') + parseFloat(permit.tds || '0')).toFixed(2),
            "GST Total": (parseFloat(permit.royalty_gst || '0') + parseFloat(permit.dmf_gst || '0') + parseFloat(permit.gf_gst || '0')).toFixed(2),
            "Grand Total": permit.total_cost,
            "App No": permit.application_no,
            "Serials": `${permit.permit_serial_start || ''} - ${permit.permit_serial_end || ''}`,
            "Postal Date": permit.postal_received_date
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Permits');
        worksheet.columns = Object.keys(rows[0] || {
            "S.No": '',
            "Payment Date": '',
            "Permit Date": '',
            "Quantity (MT)": '',
            "Royalty Base": '',
            "DMF Base": '',
            "GF Base": '',
            "MBL": '',
            "TDS": '',
            "Royalty GST": '',
            "DMF GST": '',
            "GF GST": '',
            "Misc": '',
            "Total without Misc": '',
            "GST Total": '',
            "Grand Total": '',
            "App No": '',
            "Serials": '',
            "Postal Date": ''
        }).map((header) => ({ header, key: header, width: Math.max(12, header.length + 2) }));
        worksheet.addRows(rows);
        worksheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'Permit_Report.xlsx';
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
