import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Drill,
  Bomb,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';

interface Stats {
  todayRecords: number;
  weekRecords: number;
  pendingApprovals: number;
  approvedRecords: number;
}

export function ContractorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    todayRecords: 0,
    weekRecords: 0,
    pendingApprovals: 0,
    approvedRecords: 0
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const [drillingRes, blastingRes, loadingRes] = await Promise.all([
        supabase
          .from('drilling_records')
          .select('date, status', { count: 'exact' })
          .eq('contractor_id', user.id),
        supabase
          .from('blasting_records')
          .select('date, status', { count: 'exact' })
          .eq('contractor_id', user.id),
        supabase
          .from('loading_records')
          .select('date, status', { count: 'exact' })
          .eq('contractor_id', user.id)
      ]);

      const allRecords = [
        ...(drillingRes.data || []),
        ...(blastingRes.data || []),
        ...(loadingRes.data || [])
      ];

      const todayCount = allRecords.filter(r => r.date === today).length;
      const weekCount = allRecords.filter(r => r.date >= weekAgoStr).length;
      const pendingCount = allRecords.filter(r => r.status === 'pending').length;
      const approvedCount = allRecords.filter(r => r.status === 'approved').length;

      setStats({
        todayRecords: todayCount,
        weekRecords: weekCount,
        pendingApprovals: pendingCount,
        approvedRecords: approvedCount
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    {
      title: "Today's Records",
      value: stats.todayRecords,
      icon: Calendar,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'This Week',
      value: stats.weekRecords,
      icon: TrendingUp,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Pending Approval',
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'bg-amber-500',
      textColor: 'text-amber-600'
    },
    {
      title: 'Approved',
      value: stats.approvedRecords,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600'
    }
  ];

  const quickActions = [
    {
      title: 'Drilling',
      description: 'Record drilling operations',
      icon: Drill,
      color: 'bg-blue-600 hover:bg-blue-700',
      link: '#drilling'
    },
    {
      title: 'Blasting',
      description: 'Record blasting activities',
      icon: Bomb,
      color: 'bg-orange-600 hover:bg-orange-700',
      link: '#blasting'
    },
    {
      title: 'Breaking/Loading',
      description: 'Track breaking and loading',
      icon: Truck,
      color: 'bg-green-600 hover:bg-green-700',
      link: '#loading'
    }
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.full_name}!</h1>
        <p className="text-slate-300">Quarry Contractor Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <a
                key={index}
                href={action.link}
                className={`${action.color} rounded-xl p-6 text-white transition-all hover:scale-105 hover:shadow-lg`}
              >
                <Icon className="w-10 h-10 mb-4" />
                <h3 className="text-xl font-bold mb-2">{action.title}</h3>
                <p className="text-white/90">{action.description}</p>
              </a>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Important Reminders</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Submit daily records before end of shift</li>
              <li>• Ensure all equipment numbers are recorded accurately</li>
              <li>• Report any safety concerns immediately to your manager</li>
              <li>• Check pending approvals regularly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
