import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  TrendingUp,
  Users,
  Drill,
  Factory,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Zap
} from 'lucide-react';

interface DashboardStats {
  totalDrillingRecords: number;
  totalBlastingRecords: number;
  totalProductionRecords: number;
  totalSalesOrders: number;
  totalRevenue: number;
  pendingApprovals: number;
  activeUsers: number;
  todayAttendance: number;
  totalEBReports: number;
  totalUnitsConsumed: number;
  totalEBCost: number;
}

interface Approval {
  id: string;
  record_type: string;
  record_id: string;
  submitted_by: string;
  status: string;
  submitted_at: string;
  users: { full_name: string };
}

export function DirectorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDrillingRecords: 0,
    totalBlastingRecords: 0,
    totalProductionRecords: 0,
    totalSalesOrders: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    activeUsers: 0,
    todayAttendance: 0,
    totalEBReports: 0,
    totalUnitsConsumed: 0,
    totalEBCost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const loadDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        drillingCount,
        blastingCount,
        productionCount,
        salesOrdersData,
        approvalsCount,
        usersCount,
        attendanceCount,
        ebReportsData
      ] = await Promise.all([
        supabase.from('drilling_records').select('id', { count: 'exact', head: true }),
        supabase.from('blasting_records').select('id', { count: 'exact', head: true }),
        supabase.from('production_records').select('id', { count: 'exact', head: true }),
        supabase.from('sales_orders').select('total_amount'),
        supabase.from('approval_workflows').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('eb_reports').select('units_consumed, total_cost')
      ]);

      const totalRevenue = salesOrdersData.data?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;

      // Calculate EB report statistics
      const totalEBReports = ebReportsData.data?.length || 0;
      const totalUnitsConsumed = ebReportsData.data?.reduce((sum, report) => sum + (Number(report.units_consumed) || 0), 0) || 0;
      const totalEBCost = ebReportsData.data?.reduce((sum, report) => sum + (Number(report.total_cost) || 0), 0) || 0;

      setStats({
        totalDrillingRecords: drillingCount.count || 0,
        totalBlastingRecords: blastingCount.count || 0,
        totalProductionRecords: productionCount.count || 0,
        totalSalesOrders: salesOrdersData.data?.length || 0,
        totalRevenue,
        pendingApprovals: approvalsCount.count || 0,
        activeUsers: usersCount.count || 0,
        todayAttendance: attendanceCount.count || 0,
        totalEBReports,
        totalUnitsConsumed,
        totalEBCost,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApprovals = useCallback(async () => {
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
    }
  }, [filter]);

  useEffect(() => {
    loadDashboardData();
    loadApprovals();
  }, [loadDashboardData, loadApprovals]);

  useEffect(() => {
    loadApprovals();
  }, [filter, loadApprovals]);

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
      await loadDashboardData();
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

  const statCards = [
    {
      name: 'Total Revenue',
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'bg-green-500',
      trend: '+12.5%',
      href: '#sales'
    },
    {
      name: 'Drilling Records',
      value: stats.totalDrillingRecords,
      icon: Drill,
      color: 'bg-blue-500',
      trend: '+8.2%',
      href: '#drilling'
    },
    {
      name: 'Production Records',
      value: stats.totalProductionRecords,
      icon: Factory,
      color: 'bg-orange-500',
      trend: '+5.7%',
      href: '#production'
    },
    {
      name: 'Sales Orders',
      value: stats.totalSalesOrders,
      icon: ShoppingCart,
      color: 'bg-slate-900',
      trend: '+15.3%',
      href: '#sales'
    },
    {
      name: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: AlertCircle,
      color: 'bg-yellow-500',
      trend: '',
      href: '#approvals'
    },
    {
      name: 'Active Users',
      value: stats.activeUsers,
      icon: Users,
      color: 'bg-cyan-500',
      trend: '',
      href: '#user-management'
    },
    {
      name: 'Today Attendance',
      value: stats.todayAttendance,
      icon: CheckCircle,
      color: 'bg-green-500',
      trend: '',
      href: '#attendance'
    },
    {
      name: 'Blasting Records',
      value: stats.totalBlastingRecords,
      icon: Factory,
      color: 'bg-red-500',
      trend: '+3.1%',
      href: '#blasting'
    },
    {
      name: 'EB Reports',
      value: stats.totalEBReports,
      icon: TrendingUp,
      color: 'bg-yellow-500',
      trend: '',
      href: '#eb-reports'
    },
    {
      name: 'EB Units Consumed',
      value: stats.totalUnitsConsumed.toFixed(2),
      icon: Zap,
      color: 'bg-purple-500',
      trend: '',
      href: '#eb-reports'
    },
    {
      name: 'Total EB Cost',
      value: `₹${stats.totalEBCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-green-500',
      trend: '',
      href: '#eb-reports'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Director Dashboard</h2>
        <p className="text-slate-600 mt-1">Overview of all operations and key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <a
            key={stat.name}
            href={stat.href}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                {stat.trend && (
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500 font-medium">{stat.trend}</span>
                  </div>
                )}
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activities</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Drill className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">New drilling record submitted</p>
                <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">New sales order created</p>
                <p className="text-xs text-slate-500 mt-1">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Factory className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">Production report approved</p>
                <p className="text-xs text-slate-500 mt-1">5 hours ago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <a href="#approvals" className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition-all">
              <AlertCircle className="w-6 h-6 text-slate-900 mb-2" />
              <p className="text-sm font-medium text-slate-900">Review Approvals</p>
            </a>
            <a href="#reports" className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition-all">
              <Users className="w-6 h-6 text-slate-900 mb-2" />
              <p className="text-sm font-medium text-slate-900">View Reports</p>
            </a>
            <a href="#sales" className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition-all">
              <ShoppingCart className="w-6 h-6 text-slate-900 mb-2" />
              <p className="text-sm font-medium text-slate-900">Sales Overview</p>
            </a>
            <a href="#production" className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition-all">
              <Factory className="w-6 h-6 text-slate-900 mb-2" />
              <p className="text-sm font-medium text-slate-900">Production Stats</p>
            </a>
          </div>
        </div>
      </div>

      {/* Approvals Section */}
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
            {approvals.length === 0 ? (
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
    </div>
  );
}
