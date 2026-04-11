import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
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
  Zap,
  ArrowRight,
  Activity,
  Layers
} from 'lucide-react';
import { AttendanceForm } from '../Contractor/AttendanceForm';
import { SelfServiceAttendance } from '../Attendance/SelfServiceAttendance';

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
      // Optional: Add toast notification here
    } catch (error) {
      console.error('Error updating approval:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return colors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
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

  const statGroups = [
    {
      title: "Financial Overview",
      items: [
        {
          name: 'Total Revenue',
          value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
          icon: DollarSign,
          color: 'from-emerald-500 to-teal-500',
          lightColor: 'bg-emerald-50 text-emerald-600',
          href: '#sales'
        },
        {
          name: 'Sales Orders',
          value: stats.totalSalesOrders,
          icon: ShoppingCart,
          color: 'from-blue-500 to-indigo-500',
          lightColor: 'bg-blue-50 text-blue-600',
          href: '#sales'
        },
        {
          name: 'Customer Directory',
          value: 'View Ledger',
          icon: Users,
          color: 'from-cyan-500 to-blue-500',
          lightColor: 'bg-cyan-50 text-cyan-600',
          href: '#customers'
        }
      ]
    },
    {
      title: "Production Metrics",
      items: [
        {
          name: 'Production',
          value: stats.totalProductionRecords,
          icon: Factory,
          color: 'from-orange-500 to-amber-500',
          lightColor: 'bg-orange-50 text-orange-600',
          href: '#production'
        },
        {
          name: 'Drilling',
          value: stats.totalDrillingRecords,
          icon: Drill,
          color: 'from-violet-500 to-purple-500',
          lightColor: 'bg-violet-50 text-violet-600',
          href: '#drilling'
        },
        {
          name: 'Blasting',
          value: stats.totalBlastingRecords,
          icon: Zap,
          color: 'from-rose-500 to-red-500',
          lightColor: 'bg-rose-50 text-rose-600',
          href: '#blasting'
        }
      ]
    },
    {
      title: "Operational Costs",
      items: [
        {
          name: 'EB Cost',
          value: `₹${stats.totalEBCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: 'from-pink-500 to-rose-500',
          lightColor: 'bg-pink-50 text-pink-600',
          href: '#eb-reports'
        },
        {
          name: 'Units Consumed',
          value: stats.totalUnitsConsumed.toFixed(0),
          icon: Zap,
          color: 'from-yellow-400 to-amber-500',
          lightColor: 'bg-yellow-50 text-yellow-600',
          href: '#eb-reports'
        }
      ]
    },
    {
      title: "Workforce",
      items: [
        {
          name: 'Active Users',
          value: stats.activeUsers,
          icon: Users,
          color: 'from-cyan-500 to-sky-500',
          lightColor: 'bg-cyan-50 text-cyan-600',
          href: '#user-management'
        },
        {
          name: 'Attendance',
          value: stats.todayAttendance,
          icon: Clock,
          color: 'from-lime-500 to-green-500',
          lightColor: 'bg-lime-50 text-lime-600',
          href: '#attendance'
        }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 animate-spin"></div>
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-slate-900 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Director Overview</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Real-time operational metrics
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-medium text-slate-600 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            System Operational
          </div>
          <div className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium shadow-lg shadow-slate-900/20">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {statGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">{group.title}</h3>
            <div className="grid gap-4">
              {group.items.map((stat) => (
                <a
                  key={stat.name}
                  href={stat.href}
                  className="group relative bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 -mr-10 -mt-10 rounded-full blur-2xl group-hover:opacity-10 transition-opacity`}></div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1 tracking-tight">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.lightColor} group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selfie Attendance Terminal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8 animate-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Selfie Attendance Terminal
        </h2>
        <SelfServiceAttendance workArea="general" />
      </div>

      {/* Quick Team Attendance Section (Optional/Legacy toggle) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8 opacity-60">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          Team Attendance Logger (Manual)
        </h2>
        <AttendanceForm 
          onSuccess={() => loadDashboardData()} 
          title="Daily Attendance Logger"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Approvals Section - Takes up 2 columns */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-400" />
              Approval Requests
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all duration-200 ${filter === status
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {approvals.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No requests found</h3>
                <p className="text-slate-500">There are no approval requests matching your filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {approvals.map((approval) => (
                  <div key={approval.id} className="p-5 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center border ${getStatusColor(approval.status).replace('bg-', 'border-').replace('text-', 'text-')}`}>
                          {approval.status === 'approved' ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : approval.status === 'rejected' ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              {getRecordTypeLabel(approval.record_type)}
                            </h4>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(approval.status)}`}>
                              {approval.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            Submitted by <span className="font-medium text-slate-700">{approval.users?.full_name}</span> • {new Date(approval.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {approval.status === 'pending' && (
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleApproval(approval.id, 'approved')}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-sm font-medium"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproval(approval.id, 'rejected')}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors text-sm font-medium"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
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

        {/* Right Column - Quick Stats & Actions */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <h3 className="text-lg font-bold mb-6 relative z-10">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <a href="#approvals" className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/20 group">
                <AlertCircle className="w-6 h-6 mb-2 text-yellow-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">Approvals</span>
              </a>
              <a href="#reports" className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/20 group">
                <FileText className="w-6 h-6 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">Reports</span>
              </a>
              <a href="#sales" className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/20 group">
                <ShoppingCart className="w-6 h-6 mb-2 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">New Sale</span>
              </a>
              <a href="#production" className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/20 group">
                <Factory className="w-6 h-6 mb-2 text-orange-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">Production</span>
              </a>
              <a href="#customers" className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/20 group col-span-2">
                <Users className="w-6 h-6 mb-2 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">Customer Ledger & Directory</span>
              </a>
            </div>
          </div>

          {/* Pending Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Pending Requests</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Pending Review</span>
                </div>
                <span className="text-lg font-bold text-amber-700">{stats.pendingApprovals}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Users className="w-4 h-4 text-slate-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Active Users</span>
                </div>
                <span className="text-lg font-bold text-slate-900">{stats.activeUsers}</span>
              </div>
            </div>

            <a href="#approvals" className="flex items-center justify-center gap-2 w-full mt-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-dashed border-slate-300">
              View All Requests
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
