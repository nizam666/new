import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Shield,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface SafetyIncident {
  id: string;
  date: string;
  time: string;
  location: string;
  incident_type: string;
  severity: string;
  description: string;
  people_involved: string;
  witnesses: string;
  immediate_action: string;
  corrective_action: string;
  status: string;
  investigation_notes: string;
  resolved_date: string;
  created_at: string;
}

interface SafetyStats {
  totalIncidents: number;
  criticalIncidents: number;
  resolvedIncidents: number;
  thisMonth: number;
}

export function SafetyDetails() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [stats, setStats] = useState<SafetyStats>({
    totalIncidents: 0,
    criticalIncidents: 0,
    resolvedIncidents: 0,
    thisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadIncidents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('*')
        .eq('reported_by', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setIncidents(data || []);

      const criticalIncidents = data?.filter(i => i.severity === 'Critical').length || 0;
      const resolvedIncidents = data?.filter(i => i.status === 'resolved' || i.status === 'closed').length || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const thisMonth = data?.filter(i => {
        const incidentDate = new Date(i.date);
        return incidentDate.getMonth() === currentMonth && incidentDate.getFullYear() === currentYear;
      }).length || 0;

      setStats({
        totalIncidents: data?.length || 0,
        criticalIncidents,
        resolvedIncidents,
        thisMonth
      });
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const filteredIncidents = incidents.filter(incident => {
    if (filter === 'all') return true;
    if (filter === 'critical') return incident.severity === 'Critical';
    if (filter === 'open') return incident.status === 'reported' || incident.status === 'investigating';
    return incident.status === filter || incident.severity === filter;
  });

  const getSeverityBadge = (severity: string) => {
    const colors: { [key: string]: string } = {
      Critical: 'bg-red-100 text-red-700',
      High: 'bg-orange-100 text-orange-700',
      Medium: 'bg-amber-100 text-amber-700',
      Low: 'bg-green-100 text-green-700'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${colors[severity]}`}>
        <AlertTriangle className="w-3 h-3" />
        {severity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      reported: 'bg-blue-100 text-blue-700',
      investigating: 'bg-amber-100 text-amber-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-700'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${colors[status] || colors.reported}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading safety incidents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalIncidents}</p>
          <p className="text-sm text-slate-600">Total Incidents</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.criticalIncidents}</p>
          <p className="text-sm text-slate-600">Critical Incidents</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.resolvedIncidents}</p>
          <p className="text-sm text-slate-600">Resolved</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.thisMonth}</p>
          <p className="text-sm text-slate-600">This Month</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Safety Incidents</h3>
              <p className="text-sm text-slate-600">Click on an incident to view details</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'critical'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                Critical
              </button>
              <button
                onClick={() => setFilter('open')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'open'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                Open
              </button>
            </div>
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No safety incidents found. This is great news!
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                onClick={() => setSelectedIncident(selectedIncident?.id === incident.id ? null : incident)}
                className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{incident.incident_type}</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-0.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(incident.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                        <Clock className="w-4 h-4 ml-2" />
                        {incident.time}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getSeverityBadge(incident.severity)}
                    {getStatusBadge(incident.status)}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Location</span>
                  </div>
                  <p className="text-sm text-slate-900">{incident.location}</p>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2">{incident.description}</p>

                {selectedIncident?.id === incident.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-900 mb-2">Full Description</h5>
                      <p className="text-sm text-slate-600">{incident.description}</p>
                    </div>

                    {incident.people_involved && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">People Involved</span>
                        </div>
                        <p className="text-sm text-slate-600">{incident.people_involved}</p>
                      </div>
                    )}

                    {incident.witnesses && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">Witnesses</span>
                        </div>
                        <p className="text-sm text-slate-600">{incident.witnesses}</p>
                      </div>
                    )}

                    {incident.immediate_action && (
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 mb-1">Immediate Action</h5>
                        <p className="text-sm text-slate-600">{incident.immediate_action}</p>
                      </div>
                    )}

                    {incident.corrective_action && (
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 mb-1">Corrective Action</h5>
                        <p className="text-sm text-slate-600">{incident.corrective_action}</p>
                      </div>
                    )}

                    {incident.investigation_notes && (
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 mb-1">Investigation Notes</h5>
                        <p className="text-sm text-slate-600">{incident.investigation_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
