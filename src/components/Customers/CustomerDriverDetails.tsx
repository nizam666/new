import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCircle, Search, Edit, Trash2, Calendar, Phone, Activity, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

interface Driver {
  id: string;
  license_no: string;
  driver_name: string;
  license_expiry: string;
  mobile_number: string;
  status: string;
}

interface CustomerDriverDetailsProps {
  onAddNew: () => void;
  onEdit: (driver: Driver) => void;
}

export function CustomerDriverDetails({ onAddNew, onEdit }: CustomerDriverDetailsProps) {
  useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this driver record?')) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh list
      fetchDrivers();
    } catch (error: any) {
      alert('Error deleting driver: ' + error.message);
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.license_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.mobile_number.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by driver name, license number, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-slate-50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <button
          onClick={onAddNew}
          className="px-4 py-2 bg-[#4B6B9E] text-white rounded-lg hover:bg-[#3d5782] transition-colors shadow shadow-[#4B6B9E]/20"
          title="Add Driver"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-bold flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#4B6B9E] border-t-transparent mb-4"></div>
          Loading driver database...
        </div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
          <UserCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-bold mb-6">No drivers registered yet</p>
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4B6B9E] text-white font-bold rounded-lg hover:bg-[#3d5782] transition-colors shadow"
          >
            <Plus className="w-5 h-5" />
            Add First Driver
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredDrivers.map(driver => {
            const isInactive = driver.status.toLowerCase() === 'inactive';
            const isExpiringSoon = new Date(driver.license_expiry).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
            
            return (
              <div 
                key={driver.id} 
                onClick={() => onEdit(driver)}
                className={`group rounded-2xl border-2 p-5 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden ${
                  isInactive 
                    ? 'bg-slate-50 border-slate-200 opacity-75 grayscale-[0.5]' 
                    : 'bg-white border-slate-50 hover:border-blue-500/20 hover:shadow-xl hover:shadow-slate-200/50'
                }`}
              >
                {/* Colored top accent based on status */}
                <div className={`absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  isInactive ? 'bg-slate-400' : 'bg-gradient-to-r from-blue-400 to-[#4B6B9E]'
                }`}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    isInactive ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-[#4B6B9E]'
                  }`}>
                    <UserCircle className="w-6 h-6" />
                  </div>
                  
                  {/* Actions that appear on hover */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(driver);
                      }}
                      className="p-1.5 text-blue-400 hover:text-[#4B6B9E] hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(driver.id, e)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Driver Identity Display */}
                <div className="mb-4">
                  <h3 className={`text-xl font-black tracking-wider capitalize ${isInactive ? 'text-slate-600' : 'text-slate-900'}`}>
                    {driver.driver_name}
                  </h3>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    isInactive 
                      ? 'bg-slate-100 text-slate-500 border-slate-200' 
                      : 'bg-green-50 text-green-600 border-green-200'
                  }`}>
                    <Activity className="w-3 h-3" />
                    {driver.status}
                  </span>
                </div>

                <div className="mt-auto space-y-3 pt-4 border-t border-slate-100/80">
                  <div className="flex items-start gap-2.5 text-sm">
                    <Calendar className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isExpiringSoon && !isInactive ? 'text-red-400' : 'text-slate-400'}`} />
                    <div className="flex flex-col min-w-0">
                      <span className={`font-bold truncate ${isExpiringSoon && !isInactive ? 'text-red-600' : 'text-slate-700'}`}>
                        {driver.license_no}
                      </span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider truncate ${isExpiringSoon && !isInactive ? 'text-red-500' : 'text-slate-400'}`}>
                        Exp: {driver.license_expiry ? format(new Date(driver.license_expiry), 'dd-MMM-yyyy') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 text-sm text-slate-500">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-600">
                      {driver.mobile_number || 'No contact'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
