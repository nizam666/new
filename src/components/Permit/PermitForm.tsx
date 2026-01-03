import { useState, useRef, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Upload, FileCheck } from 'lucide-react';

interface PermitFormProps {
  onSuccess: () => void;
}

export function PermitForm({ onSuccess }: PermitFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    status: 'active',
    description: '',
    document_url: '',
    quantity_in_mt: ''
  });

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Check if file is PDF
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file');
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      // Set to 100% when upload completes successfully
      setUploadProgress(100);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload the file
      const uploadTask = supabase.storage
        .from('permit-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      // Simulate progress since Supabase doesn't support it directly
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 10, 90); // Simulate progress up to 90%
          return newProgress;
        });
      }, 300);

      const { error: uploadError } = await uploadTask;
      clearInterval(interval);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('permit-documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        document_url: publicUrl
      }));

    } catch (error) {
      alert(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.document_url) {
      alert('Please upload a PDF document');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('permits')
        .insert([{
          ...formData,
          created_by: user.id
        }]);

      if (error) throw error;

      alert('Permit created successfully!');
      setFormData({
        company_name: '',
        permit_type: '',
        approval_date: '',
        expiry_date: '',
        status: 'active',
        description: '',
        document_url: '',
        quantity_in_mt: ''
      });
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
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
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
            Approval Date *
          </label>
          <input
            type="date"
            required
            value={formData.approval_date}
            onChange={(e) => setFormData({ ...formData, approval_date: e.target.value })}
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


        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="pending_renewal">Pending Renewal</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Upload Document (PDF only) {formData.document_url && <span className="text-green-600 ml-1">✓</span>}
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg">
            <div className="space-y-1 text-center">
              {formData.document_url ? (
                <div className="flex flex-col items-center text-green-600">
                  <FileCheck className="mx-auto h-12 w-12" />
                  <p className="mt-2 text-sm">Document uploaded successfully</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500"
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-400" />
                  </div>
                  <div className="flex text-sm text-slate-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".pdf,application/pdf"
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                        disabled={uploading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-500">PDF up to 10MB</p>
                </>
              )}
              {uploading && (
                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
          {formData.document_url && (
            <div className="mt-2 text-sm text-slate-600">
              <a
                href={formData.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View uploaded document
              </a>
            </div>
          )}
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

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Permit'}
        </button>
      </div>
    </form>
  );
}
