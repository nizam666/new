import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Camera, Clock, MapPin, CheckCircle } from 'lucide-react';

export function MobileOperations() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'attendance' | 'drilling' | 'blasting' | 'loading'>('attendance');
  const [loading, setLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { error } = await supabase
        .from('attendance')
        .insert([
          {
            user_id: user.id,
            date: today,
            check_in: now.toISOString(),
            location: 'Quarry Site'
          }
        ]);

      if (error) throw error;

      setCheckInTime(now);
      alert('Checked in successfully!');
    } catch (error) {
      alert('Error checking in: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { error } = await supabase
        .from('attendance')
        .update({ check_out: now.toISOString() })
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;

      alert('Checked out successfully!');
      setCheckInTime(null);
    } catch (error) {
      alert('Error checking out: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Mobile Operations</h2>
            <p className="text-blue-100 mt-1">Field operations management</p>
          </div>
          <Clock className="w-12 h-12 opacity-80" />
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span className="font-medium">Quarry Site</span>
            </div>
            <div className="text-sm">{new Date().toLocaleDateString()}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCheckIn}
              disabled={loading || checkInTime !== null}
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5 mx-auto mb-1" />
              Check In
            </button>
            <button
              onClick={handleCheckOut}
              disabled={loading || checkInTime === null}
              className="bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock className="w-5 h-5 mx-auto mb-1" />
              Check Out
            </button>
          </div>

          {checkInTime && (
            <div className="mt-4 text-center text-sm">
              Checked in at {checkInTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex overflow-x-auto">
            {['attendance', 'drilling', 'blasting', 'loading'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as 'attendance' | 'drilling' | 'blasting' | 'loading')}
                className={`px-6 py-3 font-medium capitalize whitespace-nowrap ${activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {tab === 'loading' ? 'breaking/loading' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Attendance History</h3>
              <p className="text-slate-600">View your attendance records and work hours</p>
              <div className="bg-slate-50 rounded-lg p-4 text-center text-slate-600">
                Attendance records will appear here
              </div>
            </div>
          )}

          {activeTab === 'drilling' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Quick Drilling Entry</h3>
              <p className="text-slate-600 text-sm">Record drilling activities on the go</p>
              <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                <Camera className="w-5 h-5 mx-auto mb-1" />
                Add Drilling Record
              </button>
            </div>
          )}

          {activeTab === 'blasting' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Quick Blasting Entry</h3>
              <p className="text-slate-600 text-sm">Record blasting operations instantly</p>
              <button className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-700 transition-colors">
                <Camera className="w-5 h-5 mx-auto mb-1" />
                Add Blasting Record
              </button>
            </div>
          )}

          {activeTab === 'loading' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Quick Breaking/Loading Entry</h3>
              <p className="text-slate-600 text-sm">Track breaking and loading operations in real-time</p>
              <button className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors">
                <Camera className="w-5 h-5 mx-auto mb-1" />
                Add Breaking/Loading Record
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
