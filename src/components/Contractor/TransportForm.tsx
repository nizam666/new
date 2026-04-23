import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchQuarryBalances } from '../../utils/quarryStock';
import { Truck, Save, Calendar, ChevronDown, Clock, FileUp, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const vehicleTypes = [
  'Truck',
  'Tractor'
];

const materialTypes = [
  'Good Boulders',
  'Weather Rocks',
  'Soil',
  "Aggregate's Rehandling"
];

const fromLocationTypes = [
  'Quarry',
  'Stockyard',
  'Crusher'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEAR_OPTIONS = [
  new Date().getFullYear() - 1,
  new Date().getFullYear(),
  new Date().getFullYear() + 1
];

const getToLocationOptions = (fromLocation: string) => {
  if (!fromLocation) return ['Stockyard', 'Crusher', 'Soil dumping yard'];

  switch (fromLocation) {
    case 'Quarry':
      return ['Stockyard', 'Crusher'];
    case 'Stockyard':
      return ['Crusher'];
    case 'Crusher':
      return [];
    default:
      return [];
  }
};

export function TransportForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicle_type: '',
    vehicle_number: '',
    from_location: '',
    to_location: '',
    fuel_consumed: '',
    material_transported: '',
    quantity: '',
    number_of_trips: '1',
    notes: '',
    trip_ref: '',
    empty_vehicle_weight: '',
    gross_weight: '',
    avg_weight: '',
    use_avg_weight: true,
    party_name: 'KVSS Q TO C'
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Summary State
  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth());
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<any[]>([]); // Detailed
  const [dailySummaryRows, setDailySummaryRows] = useState<any[]>([]); // Aggregated
  const [summaryTotals, setSummaryTotals] = useState({ fuel: 0, quantity: 0, trips: 0, gross: 0, empty: 0, qc: 0, qs: 0, sc: 0, soil: 0, wr: 0, ar: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [recentVehicles, setRecentVehicles] = useState<{number: string, type: string}[]>([]);
  const [dieselStock, setDieselStock] = useState<number | null>(null);
  const [dieselForm, setDieselForm] = useState({ date: new Date().toISOString().split('T')[0], vehicle_number: '', diesel: '' });
  const [dieselLoading, setDieselLoading] = useState(false);
  const [recentDieselRecords, setRecentDieselRecords] = useState<any[]>([]);
  const [showDieselSuggestions, setShowDieselSuggestions] = useState(false);
  
  useEffect(() => {
    if (user) {
      fetchNextTripRef();
      fetchRecentVehicles();
      fetchStock();
      fetchRecentDiesel();
    }
  }, [user]);

  const fetchStock = async () => {
    const balances = await fetchQuarryBalances();
    if (balances['diesel']) {
      setDieselStock(balances['diesel'].remaining);
    }
  };

  const fetchRecentDiesel = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('transport_diesel_records')
        .select('*')
        .eq('contractor_id', user.id)
        .order('date', { ascending: false })
        .limit(10);
      setRecentDieselRecords(data || []);
    } catch (err) {
      console.error('Error fetching diesel records:', err);
    }
  };

  const handleSaveDiesel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!dieselForm.vehicle_number.trim() || !dieselForm.diesel.trim()) {
      alert('Please fill Vehicle No and Diesel amount.');
      return;
    }
    if (dieselForm.date > new Date().toISOString().split('T')[0]) {
      alert('Date cannot be in the future.');
      return;
    }
    setDieselLoading(true);
    try {
      // 🚨 Strict Stock Validation 🚨
      const balances = await fetchQuarryBalances();
      const available = balances['diesel']?.remaining || 0;
      const requested = parseFloat(dieselForm.diesel) || 0;

      if (requested > available) {
        setDieselLoading(false);
        alert(`Insufficient Diesel stock. Available: ${available.toFixed(1)} L, Requested: ${requested} L`);
        return;
      }

      const { error } = await supabase
        .from('transport_diesel_records')
        .insert([{
          contractor_id: user.id,
          date: dieselForm.date,
          vehicle_number: dieselForm.vehicle_number.toUpperCase().replace(/\s/g, ''),
          diesel_liters: requested,
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;
      alert('Diesel record saved!');
      setDieselForm({ date: new Date().toISOString().split('T')[0], vehicle_number: '', diesel: '' });
      fetchRecentDiesel();
    } catch (err: any) {
      alert('Error saving diesel record: ' + (err.message || 'unknown error'));
    } finally {
      setDieselLoading(false);
      fetchStock(); // Refresh stock after saving usage
    }
  };

  useEffect(() => {
    if (formData.material_transported === 'Good Boulders') {
      const trips = parseInt(formData.number_of_trips) || 1;
      const isStockToCrush = formData.from_location === 'Stockyard' && formData.to_location === 'Crusher';
      
      if (isStockToCrush && (formData as any).use_avg_weight) {
        const avg = parseFloat(formData.avg_weight) || 0;
        const net = avg * trips;
        setFormData((prev: typeof formData) => ({ ...prev, quantity: net.toFixed(2) }));
      } else {
        const gross = parseFloat(formData.gross_weight) || 0;
        const empty = parseFloat(formData.empty_vehicle_weight) || 0;
        const net = Math.max(0, (gross - empty) * trips);
        setFormData((prev: typeof formData) => ({ ...prev, quantity: net.toFixed(2) }));
      }
    }
  }, [formData.gross_weight, formData.empty_vehicle_weight, formData.avg_weight, (formData as any).use_avg_weight, formData.number_of_trips, formData.material_transported, formData.from_location, formData.to_location]);

  const fetchNextTripRef = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('transport_records')
        .select('trip_ref');

      if (user.role !== 'director' && user.role !== 'manager') {
        query = query.eq('contractor_id', user.id);
      }

      const { data, error } = await query
        .order('trip_ref', { ascending: false })
        .limit(50); // Get a batch to find the highest numeric part

      if (error) throw error;

      let nextNum = 1;
      if (data && data.length > 0) {
        // Find the maximum number among TRP-XXX formats
        const numbers = data
          .map(r => {
            if (r.trip_ref && r.trip_ref.startsWith('TRP-')) {
              const num = parseInt(r.trip_ref.replace('TRP-', ''), 10);
              return isNaN(num) ? 0 : num;
            }
            return 0;
          })
          .filter(n => n > 0);
        
        if (numbers.length > 0) {
          nextNum = Math.max(...numbers) + 1;
        }
      }

      const formattedRef = `TRP-${nextNum.toString().padStart(3, '0')}`;
      setFormData((prev: typeof formData) => ({ ...prev, trip_ref: formattedRef }));
    } catch (err) {
      console.error('Error fetching next trip ref:', err);
      // Fallback
      setFormData((prev: typeof formData) => ({ ...prev, trip_ref: 'TRP-001' }));
    }
  };

  const fetchRecentVehicles = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('transport_records')
        .select('vehicle_number, vehicle_type');

      if (user.role !== 'director' && user.role !== 'manager') {
        query = query.eq('contractor_id', user.id);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data) {
        const unique: Record<string, string> = {};
        data.forEach(item => {
          if (item.vehicle_number && !unique[item.vehicle_number]) {
            unique[item.vehicle_number] = item.vehicle_type;
          }
        });
        const top20 = Object.entries(unique)
          .slice(0, 20)
          .map(([number, type]) => ({ number, type }));
        setRecentVehicles(top20);
      }
    } catch (err) {
      console.error('Error fetching recent vehicles:', err);
    }
  };

  const fetchSummary = async () => {
    if (!user) return;
    setSummaryLoading(true);
    try {
      const fromStr = `${summaryYear}-${(summaryMonth + 1).toString().padStart(2, '0')}-01`;
      const lastDayDate = new Date(summaryYear, summaryMonth + 1, 0).getDate();
      const toStr = `${summaryYear}-${(summaryMonth + 1).toString().padStart(2, '0')}-${lastDayDate.toString().padStart(2, '0')}`;
      
      let query = supabase
        .from('transport_records')
        .select('*');

      // Directors and Managers should see all records; others only see their own
      if (user.role !== 'director' && user.role !== 'manager') {
        query = query.eq('contractor_id', user.id);
      }

      const { data, error } = await query
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        let totalFuel = 0, totalQty = 0, totalTrips = 0;
        let totalGross = 0, totalEmpty = 0;
        let totalQC = 0, totalQS = 0, totalSC = 0;
        let totalSoil = 0, totalWR = 0, totalAR = 0;

        const grouped: Record<string, any> = {};
 
        const processed = data.map(row => {
          const f = parseFloat(row.fuel_consumed) || 0;
          const q = parseFloat(row.quantity) || 0;
          const g = parseFloat(row.gross_weight) || 0;
          const e = parseFloat(row.empty_vehicle_weight) || 0;
          const t = parseInt(row.number_of_trips) || 1;
 
          totalFuel += f;
          totalQty += q;
          totalTrips += t;
          totalGross += g;
          totalEmpty += e;

          // Aggregation logic
          if (!grouped[row.date]) {
            grouped[row.date] = { 
              date: row.date, fuel: 0, qty: 0, trips: 0,
              qc: 0, qs: 0, sc: 0, soil: 0, wr: 0, ar: 0
            };
          }
          grouped[row.date].fuel += f;
          grouped[row.date].qty += q;
          grouped[row.date].trips += t;

          if (row.from_location === 'Quarry' && row.to_location === 'Crusher') {
            grouped[row.date].qc += t;
            totalQC += t;
          } else if (row.from_location === 'Quarry' && row.to_location === 'Stockyard') {
            grouped[row.date].qs += t;
            totalQS += t;
          } else if (row.from_location === 'Stockyard' && row.to_location === 'Crusher') {
            grouped[row.date].sc += t;
            totalSC += t;
          }

          if (row.material_transported === 'Soil') {
            grouped[row.date].soil += t;
            totalSoil += t;
          } else if (row.material_transported === 'Weather Rocks') {
            grouped[row.date].wr += t;
            totalWR += t;
          } else if (row.material_transported === "Aggregate's Rehandling") {
            grouped[row.date].ar += t;
            totalAR += t;
          }

          // Extract Excel S.No from notes if present
          let excelSno = '-';
          if (row.notes && row.notes.includes('Excel S.No:')) {
            const parts = row.notes.split('|');
            const snoPart = parts.find((p: string) => p.includes('Excel S.No:'));
            if (snoPart) {
              const val = snoPart.replace('Excel S.No:', '').trim();
              excelSno = (val === 'N/A' || !val) ? '-' : val;
            }
          }
 
          return { ...row, excelSno, fuel: f, qty: q, gross: g, empty: e };
        });
 
        setSummaryRows(processed);
        setDailySummaryRows(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));
        setSummaryTotals({ 
          fuel: totalFuel, quantity: totalQty, trips: totalTrips,
          gross: totalGross, empty: totalEmpty,
          qc: totalQC, qs: totalQS, sc: totalSC,
          soil: totalSoil, wr: totalWR, ar: totalAR
        });
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };


  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user, summaryMonth, summaryYear, refreshKey]);

  const handleMaterialChange = (material: string) => {
    if (material === "Aggregate's Rehandling") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        material_transported: material,
        from_location: 'Crusher',
        to_location: 'Crusher'
      }));
    } else if (material === "Soil") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        material_transported: material,
        from_location: 'Quarry',
        to_location: 'Soil dumping yard'
      }));
    } else if (material === "Weather Rocks") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        material_transported: material,
        from_location: 'Quarry',
        to_location: 'Soil dumping yard'
      }));
    } else {
      setFormData((prev: typeof formData) => ({
        ...prev,
        material_transported: material,
        from_location: prev.from_location === 'Crusher' ? '' : prev.from_location,
        to_location: prev.to_location === 'Crusher' || prev.to_location === 'Soil dumping yard' ? '' : prev.to_location
      }));
    }
  };

  const handleBulkExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (!data || data.length === 0) {
            throw new Error('Excel file is empty.');
          }

          // 1. Fetch current max trip ref to start sequence
          const { data: latestRecords } = await supabase
            .from('transport_records')
            .select('trip_ref')
            .eq('contractor_id', user.id)
            .order('trip_ref', { ascending: false })
            .limit(100);

          let nextId = 1;
          if (latestRecords && latestRecords.length > 0) {
            const numbers = latestRecords
              .map(r => parseInt(r.trip_ref?.replace('TRP-', '') || '0', 10))
              .filter(n => !isNaN(n));
            if (numbers.length > 0) nextId = Math.max(...numbers) + 1;
          }

          const recordsToInsert: any[] = [];

          data.forEach((row: any) => {
            const getVal = (keys: string[]) => {
              const foundKey = Object.keys(row).find(k => 
                keys.some(tk => k.toLowerCase().trim() === tk.toLowerCase())
              );
              return foundKey ? row[foundKey] : null;
            };

            const partyName = (getVal(['Party Name']) || '').toString().trim();
            
            // STRICT FILTER: Accept KVSS Q TO C and KVSS Q TO S
            if (partyName !== 'KVSS Q TO C' && partyName !== 'KVSS Q TO S') {
              return; // Skip other parties
            }

            // ── Robust Date Parsing ──────────────────────────────────────────
            let date = new Date().toISOString().split('T')[0];
            const rawDateVal = getVal(['Gross Date', 'Gross Date Time', 'Date', 'Trip Date', 'Entry Date']);
            
            if (rawDateVal) {
              if (rawDateVal instanceof Date) {
                // Native JS Date
                date = rawDateVal.toISOString().split('T')[0];
              } else if (typeof rawDateVal === 'number') {
                // Excel Serial Date (e.g., 45402)
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const convertedDate = new Date(excelEpoch.getTime() + rawDateVal * 86400000);
                date = convertedDate.toISOString().split('T')[0];
              } else {
                // String format
                const part = rawDateVal.toString().trim().split(' ')[0];
                if (part.includes('/')) {
                  const [d, m, y] = part.split('/');
                  if (d && m && y) {
                    const year = y.length === 2 ? `20${y}` : y;
                    date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                  }
                } else if (part.includes('-')) {
                  date = part;
                }
              }
            }
            // ─────────────────────────────────────────────────────────────────

            // Sequential ID
            const currentTripRef = `TRP-${(nextId++).toString().padStart(3, '0')}`;
            const excelSNo = getVal(['S.No', 's.no', 'SNo', 'Sr.no', 'Sr No', 'Serial', 'SrNo', 'Sl.No', 'Sl No', 'S.No.', 'Sr.No.']);

            // Map fields and scale weights (KG to Tons)
            recordsToInsert.push({
              contractor_id: user.id,
              date: date,
              vehicle_number: (getVal(['Vehicle No', 'Vehicle Number']) || '').toString().toUpperCase().replace(/\s/g, ''),
              vehicle_type: 'Truck',
              from_location: 'Quarry',
              to_location: partyName === 'KVSS Q TO C' ? 'Crusher' : 'Stockyard',
              material_transported: 'Good Boulders',
              gross_weight: (parseFloat(getVal(['Load Weight', 'Gross Weight']) || '0')) / 1000,
              empty_vehicle_weight: (parseFloat(getVal(['Empty Weight']) || '0')) / 1000,
              quantity: (parseFloat(getVal(['Net Weight', 'Quantity']) || '0')) / 1000,
              party_name: partyName,
              trip_ref: currentTripRef,
              status: 'pending',
              number_of_trips: 1,
              notes: `Excel S.No: ${excelSNo || 'N/A'} | System Ref: ${currentTripRef}`
            });
          });

          if (recordsToInsert.length === 0) {
            alert('No valid records found for "KVSS Q TO C" or "KVSS Q TO S" in this file.');
            setLoading(false);
            return;
          }

          const { error: insertError } = await supabase
            .from('transport_records')
            .insert(recordsToInsert);

          if (insertError) throw insertError;

          alert(`Successfully uploaded ${recordsToInsert.length} records!`);
          setRefreshKey(prev => prev + 1); // Trigger summary refresh
          fetchNextTripRef();
        } catch (err: any) {
          console.error('Bulk upload processing error:', err);
          alert('Error processing Excel data: ' + err.message);
        } finally {
          setLoading(false);
          // Clear input
          e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      alert('File reading error: ' + err.message);
      setLoading(false);
    }
  };

  const handleLocationChange = (fromLocation: string) => {
    // Don't allow changing locations when 'Aggregate's Rehandling', 'Soil' or 'Weather Rocks' is selected
    if (formData.material_transported === "Aggregate's Rehandling" || 
        formData.material_transported === "Soil" ||
        formData.material_transported === "Weather Rocks") {
      return;
    }

    setFormData({
      ...formData,
      from_location: fromLocation,
      to_location: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // 🚨 Stock Validation 🚨
      const balances = await fetchQuarryBalances();
      const available = balances['diesel']?.remaining || 0;
      const requested = parseFloat(formData.fuel_consumed) || 0;

      if (requested > available) {
        setLoading(false);
        alert(`Insufficient Diesel stock in Quarry Store. Available: ${available.toFixed(1)} L, Requested: ${requested} L`);
        return;
      }

      const { error } = await supabase
        .from('transport_records')
        .insert([
          {
            contractor_id: user.id,
            date: formData.date,
            vehicle_type: formData.vehicle_type,
            vehicle_number: formData.vehicle_number,
            from_location: formData.from_location,
            to_location: formData.to_location,
            fuel_consumed: parseFloat(formData.fuel_consumed) || 0,
            material_transported: formData.material_transported,
            quantity: parseFloat(formData.quantity) || 0,
            number_of_trips: parseInt(formData.number_of_trips) || 1,
            notes: formData.notes,
            trip_ref: formData.trip_ref,
            empty_vehicle_weight: parseFloat(formData.empty_vehicle_weight) || 0,
            gross_weight: parseFloat(formData.gross_weight) || 0,
            avg_weight: parseFloat(formData.avg_weight) || 0,
            party_name: formData.party_name,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        vehicle_type: '',
        vehicle_number: '',
        from_location: '',
        to_location: '',
        fuel_consumed: '',
        material_transported: '',
        quantity: '',
        number_of_trips: '1',
        notes: '',
        trip_ref: '',
        empty_vehicle_weight: '',
        gross_weight: '',
        avg_weight: '',
        use_avg_weight: true,
        party_name: 'KVSS Q TO C'
      });

      alert('Transport record submitted successfully!');
      setRefreshKey(prev => prev + 1);
      fetchNextTripRef(); // Generate the next sequential ID
      fetchRecentVehicles(); // Refresh the suggestions
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error submitting transport record:', error);
      alert('Error submitting transport record: ' + (error.message || error.details || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* ── Bulk Upload Section ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm border border-indigo-100 p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <FileUp className="w-32 h-32 text-indigo-900" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
                <FileUp className="w-5 h-5 text-white" />
              </div>
              Bulk Excel Entry
            </h3>
            <p className="text-indigo-600/70 font-bold uppercase tracking-widest text-[10px]">
              Sri Baba Blue Metals Format • KVSS Q TO C Only
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-indigo-200 active:scale-95 group">
              <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              <span>Select Excel File</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleBulkExcelUpload}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-indigo-900">Automatic Processing Insight:</p>
              <ul className="text-[11px] text-indigo-600/80 font-medium space-y-1">
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Auto-converts Kilograms to Tons (e.g., 35310 → 35.31)</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Enforces "KVSS Q TO C" Party Name strict filter</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Sequences sequential Trip IDs from latest record</li>
                <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-indigo-400 rounded-full" /> Preserves Excel S.No and System sequence in records</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">New Transport Record</h3>
          <p className="text-sm text-slate-600">Track vehicle and material transport</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Trip Reference Number
              </label>
              <div className="text-xl font-mono font-bold text-purple-700">
                {formData.trip_ref}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-medium">
              Automatically Generated
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {vehicleTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, vehicle_type: type })}
                className={`px-4 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 ${
                  formData.vehicle_type === type
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vehicle Number *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.vehicle_number}
              onChange={(e) => {
                setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase().replace(/\s/g, '') });
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
              placeholder="Search or enter number"
            />
            {showSuggestions && formData.vehicle_number && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {recentVehicles
                  .filter((v: {number: string, type: string}) => v.number.includes(formData.vehicle_number))
                  .map((v: {number: string, type: string}) => (
                    <button
                      key={v.number}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                      onClick={() => {
                        setFormData({ ...formData, vehicle_number: v.number, vehicle_type: v.type });
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="font-bold text-slate-900">{v.number}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-bold uppercase">{v.type}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          
          {recentVehicles.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Recent Vehicles
              </p>
              <div className="flex flex-wrap gap-2">
                {recentVehicles.slice(0, 5).map((v: {number: string, type: string}) => (
                  <button
                    key={v.number}
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_number: v.number, vehicle_type: v.type })}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Truck className="w-3 h-3 opacity-60" />
                    {v.number}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
            <span>Diesel (L)</span>
            {dieselStock !== null && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${dieselStock <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                Available: {dieselStock.toFixed(1)} L
              </span>
            )}
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.fuel_consumed}
            onChange={(e) => setFormData({ ...formData, fuel_consumed: e.target.value })}
            min="0"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                dieselStock !== null && parseFloat(formData.fuel_consumed) > dieselStock ? 'border-red-500 bg-red-50 text-red-900 font-bold' : 'border-slate-300'
            }`}
            placeholder="0.0"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Material Transported *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {materialTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleMaterialChange(type)}
                className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                  formData.material_transported === type
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            From Location *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {fromLocationTypes.map((location) => (
              <button
                key={`from-${location}`}
                type="button"
                onClick={() => handleLocationChange(location)}
                disabled={formData.material_transported === "Aggregate's Rehandling" || formData.material_transported === "Soil" || formData.material_transported === "Weather Rocks"}
                className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                  formData.from_location === location
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : formData.material_transported === "Aggregate's Rehandling" || formData.material_transported === "Soil" || formData.material_transported === "Weather Rocks"
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                {location}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            To Location *
          </label>
          {formData.material_transported === "Aggregate's Rehandling" ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-100 text-gray-600 border-gray-200 text-sm">
              Crusher to Crusher (auto-set)
            </div>
          ) : formData.material_transported === "Soil" || formData.material_transported === "Weather Rocks" ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-100 text-gray-600 border-gray-200 text-sm">
              Soil dumping yard (auto-set)
            </div>
          ) : !formData.from_location ? (
            <div className="px-3 py-3 rounded-lg border-2 bg-gray-50 text-gray-400 border-gray-200 text-sm">
              Select source location first
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {getToLocationOptions(formData.from_location).map((location) => (
                <button
                  key={`to-${location}`}
                  type="button"
                  onClick={() => setFormData({ ...formData, to_location: location })}
                  className={`px-3 py-3 rounded-lg border-2 transition-all transform hover:scale-[1.02] active:scale-95 text-sm ${
                    formData.to_location === location
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          )}
        </div>



        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Number of Trips
          </label>
          <input
            type="number"
            step="1"
            value={formData.number_of_trips}
            onChange={(e) => setFormData({ ...formData, number_of_trips: e.target.value })}
            min="1"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="1"
          />
        </div>

        {formData.material_transported === 'Good Boulders' && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {!(formData.from_location === 'Stockyard' && formData.to_location === 'Crusher') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Empty Vehicle (tons)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.empty_vehicle_weight}
                    onChange={(e) => setFormData({ ...formData, empty_vehicle_weight: e.target.value })}
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gross Weight (tons)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.gross_weight}
                    onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })}
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            {formData.from_location === 'Stockyard' && formData.to_location === 'Crusher' && (
              <div className="md:col-span-2 bg-purple-50 p-4 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-purple-900">Calculation Mode</label>
                  <div className="flex bg-white p-1 rounded-lg border border-purple-200">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, use_avg_weight: true })}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                        (formData as any).use_avg_weight 
                          ? 'bg-purple-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Average Weight
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, use_avg_weight: false })}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                        !(formData as any).use_avg_weight 
                          ? 'bg-purple-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Weight Bridge
                    </button>
                  </div>
                </div>

                {(formData as any).use_avg_weight ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-bold text-purple-900 mb-2">
                      Avg Weight (tons)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.avg_weight}
                      onChange={(e) => setFormData({ ...formData, avg_weight: e.target.value })}
                      min="0"
                      required={(formData as any).use_avg_weight}
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white font-bold"
                      placeholder="0.00"
                    />
                    <p className="text-[10px] text-purple-600 font-medium mt-1 uppercase tracking-wider">
                      * Quantity will be automatically calculated: Avg WT × Trips
                    </p>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                    <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest border-b border-purple-100 pb-2">
                      Weight Bridge Mode (Enter individual trip weights)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Load WT</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.gross_weight}
                          onChange={(e) => setFormData({ ...formData, gross_weight: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Empty WT</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.empty_vehicle_weight}
                          onChange={(e) => setFormData({ ...formData, empty_vehicle_weight: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      * Quantity: (Load - Empty) × Trips
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!['Weather Rocks', 'Soil', "Aggregate's Rehandling"].includes(formData.material_transported) && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantity (tons) {formData.material_transported === 'Good Boulders' && '(Computed)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              min="0"
              disabled={formData.material_transported === 'Good Boulders'}
              className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                formData.material_transported === 'Good Boulders' ? 'bg-slate-50 text-slate-500 font-bold' : ''
              }`}
              placeholder="0.00"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Trip details, route conditions, etc..."
          />
        </div>
      </div>

        <button
          type="submit"
          disabled={loading || (dieselStock !== null && parseFloat(formData.fuel_consumed) > dieselStock)}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </form>

      {/* ── Diesel Record Section ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 22h18M4 9h1m5 0h1m5 0h1M4 5h16a1 1 0 0 1 1 1v3H3V6a1 1 0 0 1 1-1ZM9 22V9m6 13V9"/><path d="m14 6-2-3-2 3"/></svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Diesel Record</h3>
            <p className="text-xs text-slate-500">Log diesel filled per vehicle trip</p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSaveDiesel} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
              <input
                type="date"
                value={dieselForm.date}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setDieselForm({ ...dieselForm, date: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-medium"
              />
            </div>

            {/* Vehicle No */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vehicle No</label>
              <div className="relative">
                <input
                  type="text"
                  value={dieselForm.vehicle_number}
                  onChange={e => setDieselForm({ ...dieselForm, vehicle_number: e.target.value.toUpperCase().replace(/\s/g, '') })}
                  onFocus={() => setShowDieselSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDieselSuggestions(false), 200)}
                  required
                  placeholder="TN00AB0000"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-bold uppercase"
                />
                {showDieselSuggestions && recentVehicles.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {recentVehicles
                      .filter(v => v.number.toLowerCase().includes(dieselForm.vehicle_number.toLowerCase()))
                      .map(v => (
                        <button
                          key={v.number}
                          type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-red-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setDieselForm({ ...dieselForm, vehicle_number: v.number });
                            setShowDieselSuggestions(false);
                          }}
                        >
                          <span className="font-bold text-slate-900">{v.number}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-bold uppercase">{v.type}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              
              {recentVehicles.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {recentVehicles.slice(0, 3).map((v: {number: string, type: string}) => (
                      <button
                        key={v.number}
                        type="button"
                        onClick={() => setDieselForm({ ...dieselForm, vehicle_number: v.number })}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all flex items-center gap-1 active:scale-95"
                      >
                        <Truck className="w-2.5 h-2.5 opacity-60" />
                        {v.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Diesel */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Diesel (L)</span>
                {dieselStock !== null && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${dieselStock <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    Avail: {dieselStock.toFixed(1)} L
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={dieselForm.diesel}
                  onChange={e => setDieselForm({ ...dieselForm, diesel: e.target.value })}
                  required
                  placeholder="0.0"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-bold pr-8 ${
                    dieselStock !== null && parseFloat(dieselForm.diesel) > dieselStock ? 'border-red-500 bg-red-50' : 'border-slate-300'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">L</span>
              </div>
            </div>

            {/* Save Button */}
            <div>
              <button
                type="submit"
                disabled={dieselLoading || (dieselStock !== null && parseFloat(dieselForm.diesel) > dieselStock)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-bold text-sm shadow-sm shadow-red-200"
              >
                <Save className="w-4 h-4" />
                {dieselLoading ? 'Saving...' : 'Save Diesel'}
              </button>
            </div>
          </form>

          {/* Recent Diesel Logs & Stock Status */}
          <div className="mt-8 space-y-6">
            {recentDieselRecords.length > 0 && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Last 10 Usage Logs
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 capitalize">Quarry Store Balance:</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded ${dieselStock !== null && dieselStock < 100 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {dieselStock !== null ? dieselStock.toFixed(1) : '---'} L
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 bg-slate-50/80 px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <span>Date</span>
                  <span>Vehicle No</span>
                  <span className="text-right">Quantity</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {recentDieselRecords.map((rec, i) => (
                    <div key={rec.id || i} className="grid grid-cols-3 px-4 py-3 text-xs items-center hover:bg-white transition-colors group">
                      <span className="font-bold text-slate-500">
                        {new Date(rec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-black text-slate-900 font-mono group-hover:text-red-600 transition-colors uppercase tracking-tight">
                        {rec.vehicle_number}
                      </span>
                      <span className="text-right font-black text-red-600 text-sm">
                        {parseFloat(rec.diesel_liters).toFixed(1)} <span className="text-[10px] opacity-60">L</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {recentDieselRecords.length === 0 && (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No diesel logs found for your account</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Monthly Transport Summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Monthly Transport Report</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={summaryMonth}
                onChange={e => setSummaryMonth(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={summaryYear}
                onChange={e => setSummaryYear(Number(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {summaryLoading ? (
          <div className="py-12 text-center text-slate-500">
            <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p>Loading summary…</p>
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No records found for this month</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* 1. Daily Trip Summary (Restored Aggregated View) */}
            <div className="overflow-x-auto">
              <div className="px-3 py-2 bg-slate-50 border-y border-slate-200">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">1. Daily Trip Summary (Aggregated)</h4>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-purple-600 uppercase tracking-wider border-l border-slate-200">Q➔C</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-purple-600 uppercase tracking-wider">Q➔S</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-purple-600 uppercase tracking-wider">S➔C</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-blue-600 uppercase tracking-wider border-l border-slate-200">Soil</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-blue-600 uppercase tracking-wider">W.Rock</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-blue-600 uppercase tracking-wider">Agg.Reh</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Qty (T)</th>
                    <th className="px-3 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Diesel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailySummaryRows.map((row: any, idx: number) => (
                    <tr key={row.date} className={`hover:bg-slate-50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-3 py-3 text-xs font-medium text-slate-900 whitespace-nowrap">
                        {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-2 py-3 text-xs text-center text-slate-600 border-l border-slate-100">{row.qc || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-slate-600">{row.qs || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-slate-600">{row.sc || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-blue-600 font-medium border-l border-slate-100">{row.soil || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-blue-600 font-medium">{row.wr || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-blue-600 font-medium">{row.ar || '-'}</td>
                      <td className="px-2 py-3 text-xs text-right text-slate-600 border-l border-slate-100 font-bold">{row.qty.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs text-right text-slate-600 border-l border-slate-100">{row.fuel.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-50 border-t-2 border-purple-200">
                    <td className="px-3 py-3 text-[10px] font-black text-purple-900 uppercase">TOTALS</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-purple-900 border-l border-purple-100">{summaryTotals.qc}</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-purple-900">{summaryTotals.qs}</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-purple-900">{summaryTotals.sc}</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-blue-800 border-l border-purple-100">{summaryTotals.soil}</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-blue-800">{summaryTotals.wr}</td>
                    <td className="px-2 py-3 text-center text-xs font-bold text-blue-800">{summaryTotals.ar}</td>
                    <td className="px-2 py-3 text-right text-xs font-black text-slate-900 border-l border-purple-100">{summaryTotals.quantity.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-700 border-l border-purple-100">{summaryTotals.fuel.toFixed(1)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 2. Detailed Transport Ledger (Granular Weights) */}
            <div className="overflow-x-auto">
              <div className="px-3 py-2 bg-slate-50 border-y border-slate-200">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">2. Detailed Transport Ledger (Record Level)</h4>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Date</th>
                    <th className="px-2 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Ref No.</th>
                    <th className="px-2 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Excel S.No</th>
                    <th className="px-2 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Vehicle No</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Load WT</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-200">Empty WT</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold text-amber-600 uppercase tracking-wider border-l border-slate-200">Avg WT</th>
                    <th className="px-2 py-3 text-right text-[10px] font-bold text-purple-600 uppercase tracking-wider border-l border-slate-200">Net WT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryRows.map((row: any, idx: number) => (
                    <tr key={row.id || idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-600 border-l border-slate-100 font-mono">{row.trip_ref || '-'}</td>
                      <td className="px-2 py-3 text-xs text-slate-600 font-medium">{row.excelSno || '-'}</td>
                      <td className="px-2 py-3 text-xs text-center text-slate-900 font-bold border-l border-slate-100">{row.vehicle_number}</td>
                      <td className="px-2 py-3 text-xs text-right text-slate-600 border-l border-slate-100">{row.gross?.toFixed(2)}</td>
                      <td className="px-2 py-3 text-xs text-right text-slate-600 border-l border-slate-100">{row.empty?.toFixed(2)}</td>
                      <td className="px-2 py-3 text-xs text-right text-amber-700 border-l border-slate-100 font-bold">{row.avg_weight?.toFixed(2) || '-'}</td>
                      <td className="px-2 py-3 text-xs text-right text-purple-700 border-l border-slate-100 font-black">{row.qty?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-50 border-t-2 border-purple-200">
                    <td colSpan={3} className="px-3 py-4 text-xs font-black text-purple-900 uppercase">
                      Monthly Weight Totals
                    </td>
                    <td className="border-l border-purple-100"></td>
                    <td className="px-2 py-4 text-right text-xs font-bold text-slate-700 border-l border-purple-100">{summaryTotals.gross.toFixed(2)}</td>
                    <td className="px-2 py-4 text-right text-xs font-bold text-slate-700 border-l border-purple-100">{summaryTotals.empty.toFixed(2)}</td>
                    <td className="border-l border-purple-100"></td>
                    <td className="px-2 py-4 text-right text-xs font-black text-purple-900 border-l border-purple-100 bg-purple-100/50">{summaryTotals.quantity.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      }
      </div>
    </div>
  );
}
