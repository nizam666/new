import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Search, Edit, Trash2, User, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CustomerVehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  owner_name: string;
  owner_contact: string;
}

interface CustomerVehicleDetailsProps {
  onAddNew: () => void;
  onEdit: (vehicle: CustomerVehicle) => void;
}

export function CustomerVehicleDetails({ onAddNew, onEdit }: CustomerVehicleDetailsProps) {
  useAuth();
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this vehicle?')) return;

    try {
      const { error } = await supabase
        .from('customer_vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh list
      fetchVehicles();
    } catch (error: any) {
      alert('Error deleting vehicle: ' + error.message);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.owner_name && v.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    v.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by license plate, owner, or vehicle type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-slate-50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
          />
        </div>
        <button
          onClick={onAddNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          title="Register New Vehicle"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-bold flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mb-4"></div>
          Loading fleet data...
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
          <Truck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-bold mb-6">No vehicles registered yet</p>
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            Register First Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredVehicles.map(vehicle => (
            <div 
              key={vehicle.id} 
              onClick={() => onEdit(vehicle)}
              className="group bg-white rounded-2xl border-2 border-slate-50 p-5 hover:border-indigo-500/20 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden"
            >
              {/* Colored top accent based on vehicle type */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 transition-colors">
                  <Truck className="w-6 h-6" />
                </div>
                
                {/* Actions that appear on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(vehicle);
                    }}
                    className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(vehicle.id, e)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Number Plate Display */}
              <div className="mb-4">
                <h3 className="text-xl font-black text-slate-900 tracking-wider">
                  {vehicle.vehicle_number}
                </h3>
                <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                  {vehicle.vehicle_type}
                </span>
              </div>

              <div className="mt-auto space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-start gap-2.5 text-sm">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-700 truncate">
                      {vehicle.owner_name}
                    </span>
                    {vehicle.owner_contact && (
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 truncate">
                        {vehicle.owner_contact}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
