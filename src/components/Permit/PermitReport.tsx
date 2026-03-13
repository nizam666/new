import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileDown, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
    royalty_gst: string;
    dmf_gst: string;
    gf_gst: string;
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
            "S.No", "Date of Payment", "Date of Permit", "Applied Ton",
            "Royalty", "MBL", "GF", "Total Amount",
            "Payment Ref", "TDS", "TDS Ref", "DMF", "DMF Ref",
            "GST Total", "GST Ref", "Permit Serials", "Postal Date"
        ];

        const tableRows = permits.map((permit, index) => {
            // Calculate GST Total
            const gstTotal = (
                (parseFloat(permit.royalty_gst) || 0) +
                (parseFloat(permit.dmf_gst) || 0) +
                (parseFloat(permit.gf_gst) || 0)
            ).toFixed(2);

            // Construct Payment Ref
            const payRef = `App: ${permit.application_no || '-'} \nChallan: ${permit.challan_no || '-'} \nBank: ${permit.bank_ref || '-'}`;

            return [
                index + 1,
                permit.payment_date,
                permit.approval_date,
                permit.quantity_in_mt,
                permit.royalty_amount,
                permit.mbl,
                permit.gf,
                permit.total_cost,
                payRef,
                permit.tds,
                permit.bsr_code,
                permit.dmf,
                permit.dmf_reference,
                gstTotal,
                permit.gst_reference,
                `${permit.permit_serial_start || ''} - ${permit.permit_serial_end || ''}`,
                permit.postal_received_date
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

    const exportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(permits.map((permit, index) => ({
            "S.No": index + 1,
            "Date of Payment": permit.payment_date,
            "Date of Permit": permit.approval_date,
            "Applied Ton": permit.quantity_in_mt,
            "Royalty": permit.royalty_amount,
            "MBL": permit.mbl,
            "GF": permit.gf,
            "Total Amount": permit.total_cost,
            "Application No": permit.application_no,
            "Challan No": permit.challan_no,
            "Bank Ref": permit.bank_ref,
            "TDS Amount": permit.tds,
            "BSR Code": permit.bsr_code,
            "DMF Amount": permit.dmf,
            "DMF Ref": permit.dmf_reference,
            "GST Total": (parseFloat(permit.royalty_gst) + parseFloat(permit.dmf_gst) + parseFloat(permit.gf_gst)).toFixed(2),
            "GST Ref": permit.gst_reference,
            "Serial Start": permit.permit_serial_start,
            "Serial End": permit.permit_serial_end,
            "Postal Date": permit.postal_received_date
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Permits");
        XLSX.writeFile(workbook, `Permit_Report.xlsx`);
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
                            <th className="px-4 py-3 whitespace-nowrap">S.No</th>
                            <th className="px-4 py-3 whitespace-nowrap">Payment Date</th>
                            <th className="px-4 py-3 whitespace-nowrap">Permit Date</th>
                            <th className="px-4 py-3 whitespace-nowrap">Ton</th>
                            <th className="px-4 py-3 whitespace-nowrap">Royalty</th>
                            <th className="px-4 py-3 whitespace-nowrap">MBL</th>
                            <th className="px-4 py-3 whitespace-nowrap">GF</th>
                            <th className="px-4 py-3 whitespace-nowrap">Total</th>
                            <th className="px-4 py-3 min-w-[200px]">Payment Ref</th>
                            <th className="px-4 py-3 whitespace-nowrap">TDS</th>
                            <th className="px-4 py-3 whitespace-nowrap">BSR Code</th>
                            <th className="px-4 py-3 whitespace-nowrap">DMF</th>
                            <th className="px-4 py-3 whitespace-nowrap">DMF Ref</th>
                            <th className="px-4 py-3 whitespace-nowrap">GST Total</th>
                            <th className="px-4 py-3 whitespace-nowrap">GST Ref</th>
                            <th className="px-4 py-3 whitespace-nowrap">Serials</th>
                            <th className="px-4 py-3 whitespace-nowrap">Postal Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {permits.map((permit, index) => (
                            <tr key={permit.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{index + 1}</td>
                                <td className="px-4 py-3">{permit.payment_date}</td>
                                <td className="px-4 py-3">{permit.approval_date}</td>
                                <td className="px-4 py-3 font-medium">{permit.quantity_in_mt}</td>
                                <td className="px-4 py-3">{permit.royalty_amount}</td>
                                <td className="px-4 py-3">{permit.mbl}</td>
                                <td className="px-4 py-3">{permit.gf}</td>
                                <td className="px-4 py-3 font-bold text-slate-900">{permit.total_cost}</td>
                                <td className="px-4 py-3 text-xs">
                                    <div className="space-y-1">
                                        <p><span className="text-slate-500">App:</span> {permit.application_no}</p>
                                        <p><span className="text-slate-500">Challan:</span> {permit.challan_no}</p>
                                        <p><span className="text-slate-500">Bank:</span> {permit.bank_ref}</p>
                                    </div>
                                </td>
                                <td className="px-4 py-3">{permit.tds}</td>
                                <td className="px-4 py-3">{permit.bsr_code}</td>
                                <td className="px-4 py-3">{permit.dmf}</td>
                                <td className="px-4 py-3">{permit.dmf_reference}</td>
                                <td className="px-4 py-3 text-blue-600 font-medium">
                                    {((parseFloat(permit.royalty_gst) || 0) +
                                        (parseFloat(permit.dmf_gst) || 0) +
                                        (parseFloat(permit.gf_gst) || 0)).toFixed(2)}
                                </td>
                                <td className="px-4 py-3">{permit.gst_reference}</td>
                                <td className="px-4 py-3 text-xs">
                                    {permit.permit_serial_start} - {permit.permit_serial_end}
                                </td>
                                <td className="px-4 py-3">{permit.postal_received_date}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
