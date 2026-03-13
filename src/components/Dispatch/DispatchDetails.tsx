import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Package, Calendar, MapPin, User, Phone, AlertCircle } from 'lucide-react';

interface Dispatch {
  id: string;
  dispatch_number: string;
  material_type: string;
  quantity_dispatched: number;
  quantity_received: number;
  balance_quantity: number;
  unit: string;
  transportation_mode: string;
  vehicle_number: string;
  driver_name: string;
  driver_contact: string;
  destination: string;
  customer_name: string;
  dispatch_date: string;
  expected_delivery_date: string;
  delivery_status: string;
  notes: string;
  created_at: string;
}

export function DispatchDetails() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDispatches();
  }, []);

  const fetchDispatches = async () => {
    try {
      const { data, error } = await supabase
        .from('dispatch_list')
        .select('*')
        .order('dispatch_date', { ascending: false });

      if (error) throw error;
      setDispatches(data || []);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'dispatched':
        return 'bg-amber-100 text-amber-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const formatMaterialType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTransportMode = (mode: string) => {
    return mode.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredDispatches = dispatches
    .filter(dispatch => {
      if (filter === 'all') return true;
      return dispatch.delivery_status === filter;
    })
    .filter(dispatch => {
      if (!searchTerm) return true;
      return (
        dispatch.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.dispatch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.material_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.destination.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const calculateTotals = () => {
    const totalDispatched = filteredDispatches.reduce((sum, d) => sum + d.quantity_dispatched, 0);
    const totalReceived = filteredDispatches.reduce((sum, d) => sum + d.quantity_received, 0);
    const totalBalance = filteredDispatches.reduce((sum, d) => sum + d.balance_quantity, 0);
    return { totalDispatched, totalReceived, totalBalance };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading dispatch records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-600 font-medium">Total Dispatched</p>
              <p className="text-xl font-bold text-orange-900">{totals.totalDispatched.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Total Received</p>
              <p className="text-xl font-bold text-green-900">{totals.totalReceived.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Balance Material</p>
              <p className="text-xl font-bold text-blue-900">{totals.totalBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by customer, dispatch #, material, or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredDispatches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <Truck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No dispatch records found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDispatches.map((dispatch) => (
            <div
              key={dispatch.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{dispatch.dispatch_number}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dispatch.delivery_status)}`}>
                        {dispatch.delivery_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{formatMaterialType(dispatch.material_type)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Quantity Dispatched</p>
                  <p className="text-base font-semibold text-orange-900">
                    {dispatch.quantity_dispatched.toFixed(2)} {dispatch.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Quantity Received</p>
                  <p className="text-base font-semibold text-green-900">
                    {dispatch.quantity_received.toFixed(2)} {dispatch.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Balance Material</p>
                  <p className={`text-base font-semibold ${dispatch.balance_quantity > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {dispatch.balance_quantity.toFixed(2)} {dispatch.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Transportation</p>
                  <p className="text-base font-semibold text-slate-900">
                    {formatTransportMode(dispatch.transportation_mode)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-2">Customer</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">{dispatch.customer_name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">Destination</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">{dispatch.destination}</p>
                  </div>
                </div>
                {dispatch.vehicle_number && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Vehicle Number</p>
                    <p className="text-sm font-medium text-slate-900">{dispatch.vehicle_number}</p>
                  </div>
                )}
                {dispatch.driver_name && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Driver</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900">{dispatch.driver_name}</p>
                      {dispatch.driver_contact && (
                        <>
                          <Phone className="w-4 h-4 text-slate-400 ml-2" />
                          <p className="text-sm text-slate-600">{dispatch.driver_contact}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Dispatch Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(dispatch.dispatch_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {dispatch.expected_delivery_date && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Expected Delivery</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(dispatch.expected_delivery_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {dispatch.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{dispatch.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
