import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Calendar, User, Package,
  X, Loader2,
  Edit2, Trash2, Check, Download,
  FileText,
  Hash, Truck
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
  expected_return_date: string | null;
  returnable: boolean;
  returned: boolean;
  return_date: string | null;
  return_condition: string | null;
  notes: string | null;
  given_price: number | null;
  created_at: string;
}

const DEPARTMENTS = [
  'Quarry Operations', 'Crusher Plant', 'Maintenance', 'Safety',
  'Administration', 'Transport', 'Workshop', 'General'
];

const PG_BOX_SIZE = 200;
const isPGItem = (name: string) => name.toUpperCase() === 'PG';

export function InventoryDispatchReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecord, setEditingRecord] = useState<DispatchRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [editForm, setEditForm] = useState({
    quantity_dispatched: 0,
    dispatched_to: '',
    department: '',
    dispatch_date: '',
    given_price: 0,
    notes: ''
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_dispatch')
        .select('*')
        .order('dispatch_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      toast.error('Failed to load dispatch records');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: DispatchRecord) => {
    setEditingRecord(record);
    setEditForm({
      quantity_dispatched: isPGItem(record.item_name) ? record.quantity_dispatched / PG_BOX_SIZE : record.quantity_dispatched,
      dispatched_to: record.dispatched_to,
      department: record.department || '',
      dispatch_date: record.dispatch_date,
      given_price: record.given_price || 0,
      notes: record.notes || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setIsUpdating(true);
    try {
      const isPG = isPGItem(editingRecord.item_name);
      const newQtyDispatched = isPG ? editForm.quantity_dispatched * PG_BOX_SIZE : editForm.quantity_dispatched;
      const qtyDiff = newQtyDispatched - editingRecord.quantity_dispatched;

      // 1. Check stock if increasing quantity
      if (qtyDiff > 0) {
        const { data: item, error: itemError } = await supabase
          .from('inventory_items')
          .select('quantity')
          .eq('id', editingRecord.item_id)
          .single();

        if (itemError) throw itemError;
        if (item.quantity < qtyDiff) {
          const displayQty = isPG ? (qtyDiff / PG_BOX_SIZE).toFixed(2) : qtyDiff;
          const displayUnit = isPG ? 'Box' : editingRecord.unit;
          toast.error(`Not enough stock. Need ${displayQty} more ${displayUnit}`);
          setIsUpdating(false);
          return;
        }
      }

      // 2. Update the dispatch record
      const { error: updateError } = await supabase
        .from('inventory_dispatch')
        .update({
          quantity_dispatched: newQtyDispatched,
          dispatched_to: editForm.dispatched_to,
          department: editForm.department,
          dispatch_date: editForm.dispatch_date,
          given_price: editForm.given_price,
          notes: editForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRecord.id);

      if (updateError) throw updateError;

      // 3. Adjust inventory stock
      if (qtyDiff !== 0) {
        const { error: stockError } = await supabase.rpc('adjust_inventory_stock', {
          p_item_id: editingRecord.item_id,
          p_adjustment: -qtyDiff // Subtract diff from inventory (if +ve diff, subtract more; if -ve diff, add back)
        });

        if (stockError) {
          // Fallback if RPC doesn't exist
          const { data: item } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', editingRecord.item_id)
            .single();
          
          await supabase
            .from('inventory_items')
            .update({ quantity: (item?.quantity || 0) - qtyDiff })
            .eq('id', editingRecord.item_id);
        }

        // 4. Log transaction for the adjustment
        await supabase.from('inventory_transactions').insert([{
          item_id: editingRecord.item_id,
          user_id: user?.id,
          transaction_type: qtyDiff > 0 ? 'out' : 'in',
          quantity: Math.abs(qtyDiff),
          date: new Date().toISOString().split('T')[0],
          purpose: `Correction of Dispatch Ref: ${editingRecord.dispatch_ref}`,
          notes: `Qty adjusted from ${editingRecord.quantity_dispatched} to ${newQtyDispatched}${isPG ? ' (Boxes: ' + editForm.quantity_dispatched + ')' : ''}`
        }]);
      }
      toast.success('Record updated successfully');
      setEditingRecord(null);
      fetchRecords();
    } catch (err: any) {
      toast.error('Update failed: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (record: DispatchRecord) => {
    const isPG = isPGItem(record.item_name);
    const displayQty = isPG ? (record.quantity_dispatched / PG_BOX_SIZE).toFixed(2) : record.quantity_dispatched;
    const displayUnit = isPG ? 'Box' : record.unit;
    
    if (!window.confirm(`Are you sure you want to delete dispatch record ${record.dispatch_ref}? This will add ${displayQty} ${displayUnit} back to inventory.`)) {
      return;
    }

    try {
      setIsUpdating(true);
      
      // 1. Add quantity back to inventory
      const { data: item } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', record.item_id)
        .single();
      
      const { error: stockError } = await supabase
        .from('inventory_items')
        .update({ quantity: (item?.quantity || 0) + record.quantity_dispatched })
        .eq('id', record.item_id);

      if (stockError) throw stockError;

      // 2. Delete the dispatch record
      const { error: deleteError } = await supabase
        .from('inventory_dispatch')
        .delete()
        .eq('id', record.id);

      if (deleteError) throw deleteError;

      // 3. Log transaction
      await supabase.from('inventory_transactions').insert([{
        item_id: record.item_id,
        user_id: user?.id,
        transaction_type: 'in',
        quantity: record.quantity_dispatched,
        date: new Date().toISOString().split('T')[0],
        purpose: `Deletion of Dispatch Ref: ${record.dispatch_ref}`,
        notes: `Record deleted and stock replenished`
      }]);

      toast.success('Record deleted and stock replenished');
      fetchRecords();
    } catch (err: any) {
      toast.error('Deletion failed: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredRecords = records.filter(r =>
    r.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.dispatched_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.dispatch_ref.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-[20px] bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xl">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dispatch Records</h2>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Audit trail of all items issued from inventory</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-6 py-4 bg-white border border-slate-100 rounded-[28px] shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Dispatches</p>
              <p className="text-xl font-black text-slate-900 leading-none">{records.length}</p>
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
              placeholder="Search items, recipients, departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-3xl shadow-sm font-bold text-slate-600 focus:ring-4 focus:ring-slate-500/5 placeholder-slate-300"
            />
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={() => {
                 const csvContent = "data:text/csv;charset=utf-8," 
                   + ["Ref,Item,Qty,Unit,Issued To,Dept,Date,Price,Returnable,Returned"].join(",") + "\n"
                   + records.map(r => `${r.dispatch_ref},${r.item_name},${r.quantity_dispatched},${r.unit},${r.dispatched_to},${r.department},${r.dispatch_date},${r.given_price || 0},${r.returnable},${r.returned}`).join("\n");
                 const encodedUri = encodeURI(csvContent);
                 const link = document.createElement("a");
                 link.setAttribute("href", encodedUri);
                 link.setAttribute("download", `dispatch_report_${new Date().toISOString().split('T')[0]}.csv`);
                 document.body.appendChild(link);
                 link.click();
               }}
               className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-500 transition-colors"
             >
               <Download className="w-4 h-4" /> Export CSV
             </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Ref / Item</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Issued To</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Date / Price</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading history...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Truck className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-slate-900 font-black text-lg">No Dispatches Yet</p>
                    <p className="text-slate-400 font-bold text-sm">Any items issued from stock will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">{record.dispatch_ref}</p>
                          <p className="text-sm font-black text-slate-900">{record.item_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {isPGItem(record.item_name) 
                              ? `${(record.quantity_dispatched / PG_BOX_SIZE).toFixed(2)} Box` 
                              : `${record.quantity_dispatched} ${record.unit}`
                            }
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{record.dispatched_to}</p>
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{record.department || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          {new Date(record.dispatch_date).toLocaleDateString()}
                        </div>
                        {record.given_price && (
                          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                            ₹{record.given_price.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        {record.returnable ? (
                          <span className={`w-fit px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${record.returned ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                            {record.returned ? 'Returned' : 'Outstanding'}
                          </span>
                        ) : (
                          <span className="w-fit px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest">
                            Non-Returnable
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Record"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" />
          <div className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                    <Edit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Edit Dispatch Record</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-2">Ref: {editingRecord.dispatch_ref}</p>
                  </div>
                </div>
                <button onClick={() => setEditingRecord(null)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Issued To</label>
                    <input
                      type="text"
                      required
                      value={editForm.dispatched_to}
                      onChange={(e) => setEditForm({ ...editForm, dispatched_to: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Quantity ({isPGItem(editingRecord.item_name) ? 'Box' : editingRecord.unit})
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={editForm.quantity_dispatched}
                      onChange={(e) => setEditForm({ ...editForm, quantity_dispatched: parseFloat(e.target.value) })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-black text-xl focus:ring-4 focus:ring-slate-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Dispatch Date</label>
                    <input
                      type="date"
                      required
                      value={editForm.dispatch_date}
                      onChange={(e) => setEditForm({ ...editForm, dispatch_date: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-base focus:ring-4 focus:ring-slate-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Department</label>
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-4 focus:ring-slate-500/10"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Given Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.given_price}
                      onChange={(e) => setEditForm({ ...editForm, given_price: parseFloat(e.target.value) })}
                      className="w-full px-5 py-4 rounded-2xl bg-amber-50 border-none font-bold text-base text-amber-900 focus:ring-4 focus:ring-amber-400/20"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Notes</label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium text-sm focus:ring-4 focus:ring-slate-500/10 resize-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isUpdating ? 'Updating...' : 'Save Changes'}
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
