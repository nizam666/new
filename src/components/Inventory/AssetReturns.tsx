import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  RotateCcw, Search, Calendar, User, Package,
  Filter, AlertTriangle, X, Loader2,
  ArrowRight, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-toastify';

interface DispatchRecord {
  id: string;
  dispatch_ref: string;
  item_id: string;
  item_name: string;
  quantity_dispatched: number;
  unit: string;
  dispatched_to: string;
  department: string;
  dispatch_date: string;
  expected_return_date: string;
  returnable: boolean;
  returned: boolean;
  quantity_returned: number;
  notes: string;
}

const RETURN_CONDITIONS = [
  { value: 'good', label: 'Good', color: 'bg-emerald-500', desc: 'Working perfectly' },
  { value: 'ok', label: 'OK', color: 'bg-amber-400', desc: 'Minor wear' },
  { value: 'bad', label: 'Bad', color: 'bg-orange-500', desc: 'Needs repair' },
  { value: 'damaged', label: 'Damaged', color: 'bg-rose-500', desc: 'Broken / Unusable' },
];

const PG_BOX_SIZE = 200;
const isPGItem = (name: string) => name?.toUpperCase() === 'PG';

export function AssetReturns() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DispatchRecord | null>(null);
  const [processing, setProcessing] = useState(false);

  const [returnForm, setReturnForm] = useState({
    return_date: new Date().toISOString().split('T')[0],
    return_condition: 'good',
    return_qty: 0,
    notes: ''
  });

  useEffect(() => {
    if (selectedRecord) {
      const isPG = isPGItem(selectedRecord.item_name);
      const remaining = selectedRecord.quantity_dispatched - (selectedRecord.quantity_returned || 0);
      setReturnForm(prev => ({
        ...prev,
        return_qty: isPG ? remaining / PG_BOX_SIZE : remaining
      }));
    }
  }, [selectedRecord]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_dispatch')
        .select('*')
        .eq('returnable', true)
        .eq('returned', false)
        .order('dispatch_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      toast.error('Failed to load returnable assets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setProcessing(true);
    try {
      const isPG = isPGItem(selectedRecord.item_name);
      const returningNowRaw = Number(returnForm.return_qty);
      const returningNow = isPG ? returningNowRaw * PG_BOX_SIZE : returningNowRaw;

      // 1. Update dispatch record with robust numeric comparison
      const currentReturned = Number(selectedRecord.quantity_returned || 0);
      const totalDispatched = Number(selectedRecord.quantity_dispatched);
      
      const newReturnedQty = currentReturned + returningNow;
      const isConfiguredFullyReturned = newReturnedQty >= totalDispatched - 0.01; // Tiny tolerance

      const { error: dError } = await supabase
        .from('inventory_dispatch')
        .update({
          returned: isConfiguredFullyReturned,
          quantity_returned: newReturnedQty,
          return_date: returnForm.return_date,
          return_condition: returnForm.return_condition,
          notes: returnForm.notes || selectedRecord.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRecord.id);
      if (dError) throw dError;

      // 2. Replenish inventory stock into RETURNED pool (per user request: store separately)
      const { data: itemData, error: fError } = await supabase
        .from('inventory_items')
        .select('returned_qty')
        .eq('id', selectedRecord.item_id)
        .single();
      if (fError) throw fError;

      const currentReturnedQty = itemData?.returned_qty || 0;
      const { error: iError } = await supabase
        .from('inventory_items')
        .update({ 
          returned_qty: currentReturnedQty + returningNow, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', selectedRecord.item_id);
      if (iError) throw iError;

      // 3. Log transaction
      await supabase.from('inventory_transactions').insert([{
        item_id: selectedRecord.item_id,
        user_id: user?.id,
        transaction_type: 'in',
        quantity: returningNow,
        date: returnForm.return_date,
        purpose: isConfiguredFullyReturned ? `Full Return from ${selectedRecord.dispatched_to}` : `Partial Return from ${selectedRecord.dispatched_to}`,
        notes: `Ref: ${selectedRecord.dispatch_ref} | Condition: ${returnForm.return_condition} | Remaining: ${Math.max(0, totalDispatched - newReturnedQty)}${isPG ? ' | Returned (Boxes): ' + returningNowRaw : ''}`
      }]);

      toast.success(isConfiguredFullyReturned ? 'Asset returned fully!' : `Partial return of ${returnForm.return_qty} recorded!`);
      setSelectedRecord(null);
      fetchRecords();
    } catch (err: any) {
      toast.error(`Return Failed: ${err.message || 'Check database permissions'}`);
      console.error('Process Return Error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.dispatched_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.dispatch_ref.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: records.length,
    overdue: records.filter(r => r.expected_return_date && new Date(r.expected_return_date) < new Date()).length
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-[20px] bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xl">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Returnable Assets</h2>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Track and manage outstanding company property</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-6 py-4 bg-white border border-slate-100 rounded-[28px] shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outstanding</p>
              <p className="text-xl font-black text-slate-900 leading-none">{stats.total}</p>
            </div>
          </div>
          <div className="px-6 py-4 bg-white border border-slate-100 rounded-[28px] shadow-sm flex items-center gap-4 text-orange-600">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Overdue</p>
              <p className="text-xl font-black leading-none">{stats.overdue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-6 items-center justify-between bg-slate-50/30">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by equipment, person, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-3xl shadow-sm font-bold text-slate-600 focus:ring-4 focus:ring-slate-500/5 placeholder-slate-300"
            />
          </div>
          <div className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Filter className="w-4 h-4" /> Filter Assets
          </div>
        </div>

        {/* Table/List View */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Equipment Details</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Issued To</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Issued Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Expected Return</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing active assets...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShieldCheck className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-slate-900 font-black text-lg">All Assets Secure</p>
                    <p className="text-slate-400 font-bold text-sm">No returnable items are currently outstanding.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isOverdue = record.expected_return_date && new Date(record.expected_return_date) < new Date();
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{record.item_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Total: {isPGItem(record.item_name) ? (record.quantity_dispatched / PG_BOX_SIZE).toFixed(2) : record.quantity_dispatched} {isPGItem(record.item_name) ? 'Box' : record.unit}
                              </p>
                              {record.quantity_returned > 0 && (
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                  Ret: {isPGItem(record.item_name) ? (record.quantity_returned / PG_BOX_SIZE).toFixed(2) : record.quantity_returned}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{record.dispatched_to}</p>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{record.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          {new Date(record.dispatch_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`text-sm font-black flex items-center gap-2 ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                          <Calendar className={`w-4 h-4 ${isOverdue ? 'text-rose-400' : 'text-slate-300'}`} />
                          {record.expected_return_date ? new Date(record.expected_return_date).toLocaleDateString() : 'No Limit'}
                          {isOverdue && <span className="text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase ml-1">Overdue</span>}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="px-5 py-2.5 bg-slate-900 text-emerald-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95"
                        >
                          Process Return
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" />
          <div className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Record Asset Return</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-2">Ref: {selectedRecord.dispatch_ref}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRecord(null)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Being Returned</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.item_name}</p>
                  <p className="text-xs font-bold text-slate-500">Coming from {selectedRecord.dispatched_to}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</p>
                   <p className="text-2xl font-black text-slate-900">
                     {isPGItem(selectedRecord.item_name) ? (selectedRecord.quantity_dispatched / PG_BOX_SIZE).toFixed(2) : selectedRecord.quantity_dispatched} 
                     <span className="text-xs text-slate-400">{isPGItem(selectedRecord.item_name) ? 'Box' : selectedRecord.unit}</span>
                   </p>
                </div>
              </div>

              <form onSubmit={handleReturn} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><Calendar className="w-3 h-3" /> Return Date</label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={returnForm.return_date}
                      onChange={(e) => setReturnForm({ ...returnForm, return_date: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><Package className="w-3 h-3" /> Qty to Return</label>
                    <input
                      type="number"
                      required
                      min={0.01}
                      step="0.01"
                      max={isPGItem(selectedRecord.item_name) ? (selectedRecord.quantity_dispatched - (selectedRecord.quantity_returned || 0)) / PG_BOX_SIZE : selectedRecord.quantity_dispatched - (selectedRecord.quantity_returned || 0)}
                      value={returnForm.return_qty}
                      onChange={(e) => setReturnForm({ ...returnForm, return_qty: Number(e.target.value) })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-emerald-500/10"
                    />
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                      Max: {isPGItem(selectedRecord.item_name) ? ((selectedRecord.quantity_dispatched - (selectedRecord.quantity_returned || 0)) / PG_BOX_SIZE).toFixed(2) : selectedRecord.quantity_dispatched - (selectedRecord.quantity_returned || 0)} 
                      {isPGItem(selectedRecord.item_name) ? ' Box' : ` ${selectedRecord.unit}`}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3"><ShieldCheck className="w-3 h-3" /> Condition on Return</label>
                  <div className="grid grid-cols-2 gap-3">
                    {RETURN_CONDITIONS.map(cond => {
                      const selected = returnForm.return_condition === cond.value;
                      return (
                        <button
                          key={cond.value}
                          type="button"
                          onClick={() => setReturnForm({ ...returnForm, return_condition: cond.value })}
                          className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                            selected
                              ? `border-transparent ${cond.color} text-white shadow-lg scale-[1.02]`
                              : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          <p className={`font-black text-sm ${selected ? 'text-white' : 'text-slate-900'}`}>{cond.label}</p>
                          <p className={`text-[9px] font-medium mt-0.5 ${selected ? 'text-white/80' : 'text-slate-400'}`}>{cond.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Additional Notes / Observations</label>
                  <textarea
                    rows={3}
                    placeholder="Enter details about any damage or general condition..."
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-4 focus:ring-emerald-500/10 resize-none shadow-inner"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                   <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-[2] py-4 bg-slate-900 text-emerald-400 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95 disabled:bg-slate-300 disabled:text-white flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ArrowRight className="w-4 h-4" />}
                    {processing ? 'Processing Return...' : 'Commit to Repository'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
