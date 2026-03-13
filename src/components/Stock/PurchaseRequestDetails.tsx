import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Calendar, AlertCircle, DollarSign, CheckCircle } from 'lucide-react';

interface PurchaseRequest {
  id: string;
  request_number: string;
  material_name: string;
  quantity: number;
  unit: string;
  purpose: string;
  priority: string;
  required_by: string;
  estimated_cost: number;
  supplier_suggestion: string;
  status: string;
  approved_by: string;
  approval_date: string;
  notes: string;
  created_at: string;
}

export function PurchaseRequestDetails() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching purchase requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'ordered':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-emerald-100 text-emerald-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const filteredRequests = requests
    .filter(request => {
      if (filter === 'all') return true;
      return request.status === filter;
    })
    .filter(request => {
      if (!searchTerm) return true;
      return (
        request.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.purpose.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const calculateStats = () => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const totalCost = requests
      .filter(r => r.estimated_cost && r.status !== 'rejected')
      .reduce((sum, r) => sum + r.estimated_cost, 0);
    return { pending, approved, totalCost };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading purchase requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Pending Requests</p>
              <p className="text-xl font-bold text-amber-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Approved Requests</p>
              <p className="text-xl font-bold text-green-900">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Estimated Total Cost</p>
              <p className="text-xl font-bold text-blue-900">₹{stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by material, request #, or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <ShoppingCart className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No purchase requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-slate-900">{request.request_number}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                        {request.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-base font-medium text-slate-700">{request.material_name}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                  {request.status.toUpperCase()}
                </span>
              </div>

              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Purpose:</p>
                <p className="text-sm font-medium text-slate-900">{request.purpose}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Quantity</p>
                  <p className="text-base font-semibold text-slate-900">
                    {request.quantity.toFixed(2)} {request.unit}
                  </p>
                </div>
                {request.estimated_cost && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Estimated Cost</p>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <p className="text-base font-semibold text-slate-900">
                        {request.estimated_cost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
                {request.required_by && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Required By</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(request.required_by).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {request.supplier_suggestion && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Suggested Supplier</p>
                    <p className="text-sm font-medium text-slate-900">{request.supplier_suggestion}</p>
                  </div>
                )}
              </div>

              {request.notes && (
                <div className="pt-4 border-t border-slate-200 mb-4">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{request.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                {request.approval_date && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Approved: {new Date(request.approval_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
