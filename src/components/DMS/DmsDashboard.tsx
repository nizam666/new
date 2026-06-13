import './DmsDashboard.css';
import { Truck, Package, MapPin, TrendingUp, Clock } from 'lucide-react';

export function DmsDashboard() {
  const stats = [
    { label: 'Active Deliveries', value: '124', icon: Truck, trend: '+12%' },
    { label: 'Pending Orders', value: '38', icon: Package, trend: '-5%' },
    { label: 'Total Volume (Tons)', value: '4,520', icon: TrendingUp, trend: '+24%' },
  ];

  const recentDeliveries = [
    { id: 'DEL-9082', customer: 'Alpha Construction', location: 'Site B, North Wing', status: 'In Transit', time: '10 mins ago' },
    { id: 'DEL-9081', customer: 'MegaBuild Inc.', location: 'Central Hub', status: 'Delivered', time: '1 hr ago' },
    { id: 'DEL-9080', customer: 'City Roads Dept', location: 'Highway 61', status: 'Pending', time: '2 hrs ago' },
  ];

  return (
    <div className="dms-container animate-in">
      <header className="dms-header">
        <div>
          <h1 className="dms-title">Distribution Hub</h1>
          <p className="dms-subtitle">Real-time logistics and delivery management</p>
        </div>
        <div className="flex gap-2">
          {/* Quick Actions */}
          <button className="px-4 py-2 bg-white text-slate-800 rounded-lg shadow-sm font-semibold hover:bg-slate-50 transition-colors border border-slate-200">
            Export Report
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md font-semibold hover:bg-indigo-700 transition-colors">
            + New Dispatch
          </button>
        </div>
      </header>

      <div className="dms-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card">
            <div className="card-header">
              <div className="card-icon">
                <stat.icon size={24} />
              </div>
              <span className={`text-sm font-bold ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stat.trend}
              </span>
            </div>
            <h3 className="card-value">{stat.value}</h3>
            <p className="card-label">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card lg:col-span-2">
          <h2 className="dms-section-title">Delivery Map (Mock)</h2>
          <div className="w-full h-64 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden">
            {/* Mock map background */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="z-10 flex flex-col items-center text-slate-400">
              <MapPin size={48} className="mb-2 text-indigo-400 opacity-50 animate-bounce" />
              <p className="font-semibold">Interactive Map Integration Pending</p>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h2 className="dms-section-title">Live Tracking</h2>
          <ul className="dms-list">
            {recentDeliveries.map((del, idx) => (
              <li key={idx} className="dms-list-item">
                <div>
                  <p className="font-bold text-sm text-slate-800">{del.customer}</p>
                  <p className="text-xs text-slate-500 mt-1">{del.id} • {del.location}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`status-badge ${
                    del.status === 'In Transit' ? 'status-transit' : 
                    del.status === 'Delivered' ? 'status-delivered' : 'status-pending'
                  }`}>
                    {del.status}
                  </span>
                  <span className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {del.time}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
