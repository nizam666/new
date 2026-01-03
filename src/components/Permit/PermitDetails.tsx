import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface Permit {
  id: string;
  permit_number: string;
  permit_type: string;
  approval_date: string;
  expiry_date: string;
  issuing_authority: string;
  status: string;
  description: string;
  document_url: string;
  created_at: string;
}

export function PermitDetails() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermits();
  }, []);

  const fetchPermits = async () => {
    try {
      const { data, error } = await supabase
        .from('permits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPermits(data || []);
    } catch (error) {
      console.error('Error fetching permits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pending_renewal':
        return <Clock className="w-5 h-5 text-amber-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'pending_renewal':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const formatPermitType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading permits...</p>
      </div>
    );
  }

  if (permits.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600">No permits found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {permits.map((permit) => (
        <div
          key={permit.id}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{permit.permit_number}</h3>
                <p className="text-sm text-slate-600">{formatPermitType(permit.permit_type)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(permit.status)}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(permit.status)}`}>
                {permit.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Issuing Authority</p>
              <p className="text-sm font-medium text-slate-900">{permit.issuing_authority}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Approval Date</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {new Date(permit.approval_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Expiry Date</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-900">
                  {new Date(permit.expiry_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Days Until Expiry</p>
              <p className="text-sm font-medium text-slate-900">
                {Math.ceil((new Date(permit.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          </div>

          {permit.description && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-700">{permit.description}</p>
            </div>
          )}

          {permit.document_url && (
            <div className="pt-4 border-t border-slate-200">
              <a
                href={permit.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Document →
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
