import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface Approval {
  id: string;
  record_type: string;
  record_id: string;
  submitted_by: string;
  status: string;
  submitted_at: string;
  users: { full_name: string };
}

export function ApprovalsModule() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('approval_workflows')
        .select('*, users!approval_workflows_submitted_by_fkey(full_name)')
        .order('submitted_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setApprovals(data || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleApproval = async (approvalId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('approval_workflows')
        .update({
          status: newStatus,
          approver_id: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', approvalId);

      if (error) throw error;

      await loadApprovals();
      alert(`Request ${newStatus} successfully!`);
    } catch (error) {
      alert('Error updating approval: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getRecordTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      drilling: 'Drilling Record',
      blasting: 'Blasting Record',
      loading: 'Loading Record',
      production: 'Production Record',
      quotation: 'Quotation',
      order: 'Sales Order',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Approvals</h2>
        <p className="text-slate-600 mt-1">Review and approve pending requests</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 p-4">
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${filter === status
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-600">Loading approvals...</div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No approval requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-slate-900">
                          {getRecordTypeLabel(approval.record_type)}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(approval.status)}`}>
                          {approval.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Submitted by {approval.users?.full_name} on{' '}
                        {new Date(approval.submitted_at).toLocaleDateString()}
                      </p>
                    </div>

                    {approval.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproval(approval.id, 'approved')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleApproval(approval.id, 'rejected')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-6 text-white">
          <Clock className="w-10 h-10 mb-3 opacity-80" />
          <p className="text-2xl font-bold">
            {approvals.filter(a => a.status === 'pending').length}
          </p>
          <p className="text-yellow-100 mt-1">Pending Approvals</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
          <CheckCircle className="w-10 h-10 mb-3 opacity-80" />
          <p className="text-2xl font-bold">
            {approvals.filter(a => a.status === 'approved').length}
          </p>
          <p className="text-green-100 mt-1">Approved Today</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-pink-500 rounded-xl p-6 text-white">
          <XCircle className="w-10 h-10 mb-3 opacity-80" />
          <p className="text-2xl font-bold">
            {approvals.filter(a => a.status === 'rejected').length}
          </p>
          <p className="text-red-100 mt-1">Rejected Today</p>
        </div>
      </div>
    </div>
  );
}
