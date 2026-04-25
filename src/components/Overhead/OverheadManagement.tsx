import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, DollarSign, Edit, Trash2, UserPlus, Search, X } from 'lucide-react';

interface User {
  id: string;
  employee_id?: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
}

interface OverheadSalary {
  userId: string;
  amount: number;
  department: string;
  updatedAt: string;
}

const DEPARTMENTS = ['Quarry', 'Crusher', 'JCB', 'Sales', 'Weighbridge', 'Other'];

export function OverheadManagement() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [overheadUserIds, setOverheadUserIds] = useState<string[]>([]);
  const [salaries, setSalaries] = useState<Record<string, OverheadSalary>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [initialSalary, setInitialSalary] = useState('');
  const [selectedDept, setSelectedDept] = useState('Quarry');

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [salaryAmount, setSalaryAmount] = useState<string>('');
  const [editDept, setEditDept] = useState('Quarry');

  const loadData = useCallback(async () => {
    try {
      // Fetch users from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('id, employee_id, email, full_name, role, phone, is_active')
        .order('full_name', { ascending: true });
      if (error) throw error;
      setAllUsers(data || []);

      // Load overhead user IDs from localStorage
      const storedIds = localStorage.getItem('sribaba_overhead_user_ids');
      setOverheadUserIds(storedIds ? JSON.parse(storedIds) : []);

      // Load salaries from localStorage
      const storedSalaries = localStorage.getItem('sribaba_overhead_salaries');
      setSalaries(storedSalaries ? JSON.parse(storedSalaries) : {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    const amount = parseFloat(initialSalary) || 0;
    
    const updatedIds = [...overheadUserIds, selectedUserId];
    const updatedSalaries = {
      ...salaries,
      [selectedUserId]: {
        userId: selectedUserId,
        amount,
        department: selectedDept,
        updatedAt: new Date().toISOString(),
      },
    };

    localStorage.setItem('sribaba_overhead_user_ids', JSON.stringify(updatedIds));
    localStorage.setItem('sribaba_overhead_salaries', JSON.stringify(updatedSalaries));
    
    setOverheadUserIds(updatedIds);
    setSalaries(updatedSalaries);
    setShowAddModal(false);
    setSelectedUserId('');
    setInitialSalary('');
    setSelectedDept('Quarry');
    alert('Employee added to overhead successfully!');
  };

  const handleSaveSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const amount = parseFloat(salaryAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid salary amount');
      return;
    }

    const updatedSalaries: Record<string, OverheadSalary> = {
      ...salaries,
      [editingUser.id]: {
        userId: editingUser.id,
        amount,
        department: editDept,
        updatedAt: new Date().toISOString(),
      },
    };

    localStorage.setItem('sribaba_overhead_salaries', JSON.stringify(updatedSalaries));
    setSalaries(updatedSalaries);
    setEditingUser(null);
    setSalaryAmount('');
    alert('Salary updated successfully!');
  };

  const handleRemoveEmployee = (userId: string, name: string) => {
    if (!confirm(`Remove "${name}" from the overhead list?`)) return;
    
    const updatedIds = overheadUserIds.filter(id => id !== userId);
    const updatedSalaries = { ...salaries };
    delete updatedSalaries[userId];

    localStorage.setItem('sribaba_overhead_user_ids', JSON.stringify(updatedIds));
    localStorage.setItem('sribaba_overhead_salaries', JSON.stringify(updatedSalaries));
    
    setOverheadUserIds(updatedIds);
    setSalaries(updatedSalaries);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setSalaryAmount(salaries[user.id]?.amount?.toString() || '');
  };

  // Get users currently in overhead
  const overheadUsers = allUsers.filter(u => overheadUserIds.includes(u.id));

  // Get users NOT in overhead for the add dropdown
  const availableUsers = allUsers.filter(u => !overheadUserIds.includes(u.id));

  const filteredUsers = overheadUsers.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.employee_id && u.employee_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalMonthlyOverhead = Object.values(salaries)
    .filter(s => overheadUserIds.includes(s.userId))
    .reduce((sum, s) => sum + s.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Overhead Management</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Determine salaries for selected employees</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-6 py-3 flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-indigo-600" />
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Monthly Overhead</p>
              <p className="text-xl font-black text-slate-900">₹{totalMonthlyOverhead.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95 flex-shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search overhead employees..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none bg-white"
        />
      </div>

      {/* Overhead List */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-base">No employees added to overhead yet.</p>
            <p className="text-slate-400 text-xs mt-1">Click "Add Employee" to begin mapping salaries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Employee</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Department</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Salary Amount</th>
                  <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const salary = salaries[user.id];
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-black">
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{user.full_name}</p>
                            <p className="text-xs font-mono text-slate-400">{user.employee_id || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                          {salary?.department || 'Quarry'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-600 capitalize">
                          {user.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 font-black text-slate-900 text-sm">
                        ₹{salary?.amount ? salary.amount.toLocaleString('en-IN') : '0'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            title="Edit Salary"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveEmployee(user.id, user.full_name)}
                            className="p-2 rounded-xl border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                            title="Remove from Overhead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Add Employee</h3>
                  <p className="text-slate-400 text-xs font-medium">Select a user from management records</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Select Employee *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none bg-white"
                >
                  <option value="">-- Choose User --</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.employee_id || 'No ID'}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Department *
                </label>
                <select
                  required
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none bg-white"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Initial Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={initialSalary}
                  onChange={e => setInitialSalary(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none"
                  placeholder="e.g. 25000"
                  min="0"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserId}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all font-bold text-xs shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Add to List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Salary Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Set Salary</h3>
                  <p className="text-slate-400 text-xs font-medium">{editingUser.full_name}</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Department *
                </label>
                <select
                  required
                  value={editDept}
                  onChange={e => setEditDept(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none bg-white mb-4"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Monthly Salary Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all outline-none"
                  placeholder="e.g. 25000"
                  min="0"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all font-bold text-xs shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Save Salary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
