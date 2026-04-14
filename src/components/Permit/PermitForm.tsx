import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText } from 'lucide-react';

interface PermitFormProps {
  onSuccess: () => void;
}

export function PermitForm({ onSuccess }: PermitFormProps) {
  const [loading, setLoading] = useState(false);
  // List of company options
  const companyOptions = [
    { value: 'sri_baba_blue_metals', label: 'Sri Baba Blue Metals' },
    { value: 'kvss', label: 'KVSS' }
  ];

  const [formData, setFormData] = useState({
    company_name: '',
    permit_type: '',
    approval_date: '',
    expiry_date: '',
    payment_date: '',
    royalty_amount: '',
    status: 'active',
    description: '',
    document_url: '',
    quantity_in_mt: '',
    gf: '',
    mbl: '',
    dmf: '',
    tds: '',
    miscellaneous: '',
    // Display only fields
    royalty_base: '',
    royalty_gst: '',
    dmf_base: '',
    dmf_gst: '',
    gf_base: '',
    gf_gst: '',
    total_base: '',
    total_gst: '',
    total_cost: '',
    // Report fields
    application_no: '',
    challan_no: '',
    challan_date: '',
    bank_ref: '',
    payment_mode: '',
    bsr_code: '',
    dmf_reference: '',
    gst_reference: '',
    gst_payment_date: '',
    permit_serial_start: '',
    permit_serial_end: '',
    postal_received_date: '',
    single_permit_ton: ''
  });


  // Calculate profit details when quantity changes
  useEffect(() => {
    const quantity = parseFloat(formData.quantity_in_mt);

    if (!isNaN(quantity) && quantity > 0) {
      // Base constants
      const baseRoyaltyRate = 33;
      const mblRate = 90;
      const gstRate = 0.18;

      // 1. Royalty: (Quantity * 33) * 1.18
      const baseRoyalty = quantity * baseRoyaltyRate;
      const royaltyGst = baseRoyalty * gstRate;
      const royaltyWithGst = baseRoyalty + royaltyGst;

      // 2. DMF: 10% of Base Royalty + 18% GST
      const dmfBase = baseRoyalty * 0.10;
      const dmfGst = dmfBase * gstRate;
      const dmfWithGst = dmfBase + dmfGst;

      // 3. GF (Green Fund): 10% of Base Royalty + 18% GST
      const gfBase = baseRoyalty * 0.10;
      const gfGst = gfBase * gstRate;
      const gfWithGst = gfBase + gfGst;

      // 4. TDS: 2% of Base Royalty (No GST)
      const tdsAmount = baseRoyalty * 0.02;

      // 5. MBL: Quantity * 90 (No GST)
      const mblAmount = quantity * mblRate;

      setFormData(prev => ({
        ...prev,
        royalty_amount: royaltyWithGst.toFixed(2),
        royalty_base: baseRoyalty.toFixed(2),
        royalty_gst: royaltyGst.toFixed(2),
        dmf: dmfWithGst.toFixed(2),
        dmf_base: dmfBase.toFixed(2),
        dmf_gst: dmfGst.toFixed(2),
        gf: gfWithGst.toFixed(2),
        gf_base: gfBase.toFixed(2),
        gf_gst: gfGst.toFixed(2),
        tds: tdsAmount.toFixed(2),
        mbl: mblAmount.toFixed(2)
      }));
    } else if (formData.quantity_in_mt === '') {
      // Reset fields if quantity is cleared
      setFormData(prev => ({
        ...prev,
        royalty_amount: '',
        royalty_base: '',
        royalty_gst: '',
        dmf: '',
        dmf_base: '',
        dmf_gst: '',
        gf: '',
        gf_base: '',
        gf_gst: '',
        tds: '',
        mbl: ''
      }));
    }
  }, [formData.quantity_in_mt]);


  // Calculate total cost whenever components change
  useEffect(() => {
    const royalty = parseFloat(formData.royalty_amount) || 0;
    const dmf = parseFloat(formData.dmf) || 0;
    const gf = parseFloat(formData.gf) || 0;
    const tds = parseFloat(formData.tds) || 0;
    const mbl = parseFloat(formData.mbl) || 0;
    const misc = parseFloat(formData.miscellaneous) || 0;

    // Calculate Base Totals
    const baseTotal =
      (parseFloat(formData.royalty_base) || 0) +
      (parseFloat(formData.dmf_base) || 0) +
      (parseFloat(formData.gf_base) || 0) +
      tds + mbl + misc;

    // Calculate GST Totals
    const gstTotal =
      (parseFloat(formData.royalty_gst) || 0) +
      (parseFloat(formData.dmf_gst) || 0) +
      (parseFloat(formData.gf_gst) || 0);

    const total = royalty + dmf + gf + tds + mbl + misc;

    setFormData(prev => ({
      ...prev,
      total_base: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      total_gst: gstTotal > 0 ? gstTotal.toFixed(2) : '',
      total_cost: total > 0 ? total.toFixed(2) : ''
    }));
  }, [
    formData.royalty_amount, formData.royalty_base, formData.royalty_gst,
    formData.dmf, formData.dmf_base, formData.dmf_gst,
    formData.gf, formData.gf_base, formData.gf_gst,
    formData.tds,
    formData.mbl,
    formData.miscellaneous
  ]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();



    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      // Create a copy of formData and remove display-only fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { royalty_base, royalty_gst, dmf_base, dmf_gst, gf_base, gf_gst, total_base, total_gst, total_cost, ...submissionData } = formData;

      const { error } = await supabase
        .from('permits')
        .insert([{
          ...submissionData,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Permit created successfully!');
      setFormData({
        company_name: '',
        permit_type: '',
        approval_date: '',
        expiry_date: '',
        payment_date: '',
        royalty_amount: '',
        status: 'active',
        description: '',
        document_url: '',
        quantity_in_mt: '',
        gf: '',
        mbl: '',
        dmf: '',
        tds: '',
        miscellaneous: '',
        royalty_base: '',
        royalty_gst: '',
        dmf_base: '',
        dmf_gst: '',
        gf_base: '',
        gf_gst: '',
        total_base: '',
        total_gst: '',
        total_cost: '',
        application_no: '',
        challan_no: '',
        challan_date: '',
        bank_ref: '',
        payment_mode: '',
        bsr_code: '',
        dmf_reference: '',
        gst_reference: '',
        gst_payment_date: '',
        permit_serial_start: '',
        permit_serial_end: '',
        postal_received_date: '',
        single_permit_ton: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">New Permit Application</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Name *
            </label>
            <select
              required
              value={formData.company_name}
              onChange={(e) => {
                const selectedCompany = e.target.value;
                let newPermitType = formData.permit_type;

                if (selectedCompany === 'sri_baba_blue_metals') {
                  newPermitType = 'crusher';
                } else if (selectedCompany === 'kvss') {
                  newPermitType = 'quarry';
                }

                setFormData({
                  ...formData,
                  company_name: selectedCompany,
                  permit_type: newPermitType
                });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Company</option>
              {companyOptions.map((company) => (
                <option key={company.value} value={company.value}>
                  {company.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Permit Type *
            </label>
            <select
              required
              value={formData.permit_type}
              onChange={(e) => setFormData({ ...formData, permit_type: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Type</option>
              <option value="quarry">Quarry Permit</option>
              <option value="crusher">Crusher Permit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantity (MT) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.quantity_in_mt}
              onChange={(e) => setFormData({ ...formData, quantity_in_mt: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter quantity in metric tons"
            />
          </div>



          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date of Approval *
            </label>
            <input
              type="date"
              required
              value={formData.approval_date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, approval_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date of Payment
            </label>
            <input
              type="date"
              value={formData.payment_date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Expiry Date *
            </label>
            <input
              type="date"
              required
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional details about the permit..."
            />
          </div>
        </div>
      </div>



      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Permit Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Royalty */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">Royalty</h4>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Cost
              </label>
              <input
                type="number"
                readOnly
                value={formData.royalty_base}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="Base"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                GST (18%)
              </label>
              <input
                type="number"
                readOnly
                value={formData.royalty_gst}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="GST"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.royalty_amount}
                className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700"
                placeholder="Total"
              />
            </div>
          </div>

          {/* DMF */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">DMF</h4>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Cost
              </label>
              <input
                type="number"
                readOnly
                value={formData.dmf_base}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="Base"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                GST (18%)
              </label>
              <input
                type="number"
                readOnly
                value={formData.dmf_gst}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="GST"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.dmf}
                className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700"
                placeholder="Total"
              />
            </div>
          </div>

          {/* GF */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">GF</h4>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Cost
              </label>
              <input
                type="number"
                readOnly
                value={formData.gf_base}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="Base"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                GST (18%)
              </label>
              <input
                type="number"
                readOnly
                value={formData.gf_gst}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700"
                placeholder="GST"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.gf}
                className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700"
                placeholder="Total"
              />
            </div>
          </div>

          {/* TDS */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">TDS</h4>
            <div className="pt-8"> {/* Spacer to align with others */}
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.tds}
                className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700"
                placeholder="Total"
              />
              <p className="text-xs text-slate-400 mt-1">2% on Base Royalty</p>
            </div>
          </div>

          {/* MBL */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">MBL</h4>
            <div className="pt-8">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.mbl}
                className="w-full px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700"
                placeholder="Total"
              />
              <p className="text-xs text-slate-400 mt-1">90/Ton Standard</p>
            </div>
          </div>

          {/* Miscellaneous */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 border-b border-slate-200 pb-2">Miscellaneous</h4>
            <div className="pt-8">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Total
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.miscellaneous}
                onChange={(e) => setFormData({ ...formData, miscellaneous: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                placeholder="Total"
              />
            </div>
          </div>
        </div>


        {/* Total Cost Display */}
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-6">
          <div className="bg-slate-50 rounded-lg p-4 min-w-[300px] space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-sm">Total Base Cost:</span>
              <span className="text-sm font-medium">
                ₹ {formData.total_base || '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-sm">Total GST (18%):</span>
              <span className="text-sm font-medium">
                ₹ {formData.total_gst || '0.00'}
              </span>
            </div>
            <div className="h-px bg-slate-200 my-2" />
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-sm font-semibold">Grand Total:</span>
              <span className="text-xl font-bold text-slate-900">
                ₹ {formData.total_cost || '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>


      <div className="flex justify-end pt-4 pb-6">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Permit'}
        </button>
      </div>
    </form >
  );
}
