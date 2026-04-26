import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  UserPlus, Trash2, Edit2, CheckCircle, XCircle, Search, X,
  User, Phone, Mail, Lock, Key, Clock
} from 'lucide-react';

interface Contractor {
  id: string;
  employee_id?: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export function ContractorManagement() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeHistoryContractor, setActiveHistoryContractor] = useState<Contractor | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const [formData, setFormData] = useState({
    employee_id: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    function: 'Quarry',
  });
  const [contractorExpenses, setContractorExpenses] = useState<Record<string, number>>({});

  const loadAllExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('customer_name, amount, amount_given, transaction_type, reason, notes');
        
      if (error) throw error;
      
      const expenseMap: Record<string, number> = {};
      const stored = localStorage.getItem('sribaba_contractors');
      const contractorList: any[] = stored ? JSON.parse(stored) : [];
      
      if (data) {
        contractorList.forEach(c => {
          const total = data.filter(rec => {
            const matchesName = rec.customer_name?.toLowerCase().includes(c.full_name.toLowerCase());
            const matchesRef = c.employee_id && (
                               rec.reason?.toLowerCase().includes(c.employee_id.toLowerCase()) || 
                               rec.notes?.toLowerCase().includes(c.employee_id.toLowerCase()) || 
                               rec.customer_name?.toLowerCase().includes(c.employee_id.toLowerCase()));
            return matchesName || matchesRef;
          }).reduce((sum, rec) => sum + (rec.amount_given || rec.amount || 0), 0);
          
          expenseMap[c.id] = total;
        });
      }
      setContractorExpenses(expenseMap);
    } catch (err) {
      console.error('Error loading expenses:', err);
    }
  };

  const loadContractors = useCallback(() => {
    try {
      const stored = localStorage.getItem('sribaba_contractors');
      setContractors(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Error loading contractors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadContractors(); 
  }, [loadContractors]);

  useEffect(() => { 
    loadAllExpenses();
  }, [contractors]);

  const fetchHistory = async (contractor: Contractor) => {
    setActiveHistoryContractor(contractor);
    setLoadingHistory(true);
    setSelectedMonth('all');
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('customer_name', contractor.full_name)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching contractor history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const stored = localStorage.getItem('sribaba_contractors');
      const currentList: Contractor[] = stored ? JSON.parse(stored) : [];
      
      if (editingContractor) {
        const updated = currentList.map(c => 
          c.id === editingContractor.id 
            ? { ...c, full_name: formData.full_name, email: formData.email, phone: formData.phone }
            : c
        );
        localStorage.setItem('sribaba_contractors', JSON.stringify(updated));
        alert('Contractor updated successfully!');
      } else {
        const newContractor: Contractor = {
          id: crypto.randomUUID(),
          employee_id: formData.employee_id,
          email: formData.email,
          full_name: formData.full_name,
          role: 'contractor',
          phone: formData.phone,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('sribaba_contractors', JSON.stringify([newContractor, ...currentList]));
        alert('Contractor created successfully!');
      }
      cancelForm();
      loadContractors();
    } catch (error) {
      console.error('Error saving contractor:', error);
      alert('Failed to save contractor');
    }
  };

  const handleToggleActive = (contractorId: string, currentStatus: boolean) => {
    try {
      const stored = localStorage.getItem('sribaba_contractors');
      const currentList: Contractor[] = stored ? JSON.parse(stored) : [];
      const updated = currentList.map(c => 
        c.id === contractorId ? { ...c, is_active: !currentStatus } : c
      );
      localStorage.setItem('sribaba_contractors', JSON.stringify(updated));
      loadContractors();
    } catch (error) {
      console.error('Error toggling contractor status:', error);
    }
  };

  const handleDeleteContractor = (contractorId: string, name: string) => {
    if (!confirm(`Delete contractor "${name}"? This cannot be undone.`)) return;
    try {
      const stored = localStorage.getItem('sribaba_contractors');
      const currentList: Contractor[] = stored ? JSON.parse(stored) : [];
      const updated = currentList.filter(c => c.id !== contractorId);
      localStorage.setItem('sribaba_contractors', JSON.stringify(updated));
      alert('Contractor deleted.');
      loadContractors();
    } catch (error) {
      console.error('Error deleting contractor:', error);
    }
  };

  const getFunctionFromRef = (ref?: string) => {
    if (!ref) return 'Quarry';
    if (ref.startsWith('CON-QRY-')) return 'Quarry';
    if (ref.startsWith('CON-CRU-')) return 'Crusher';
    if (ref.startsWith('CON-ELE-')) return 'Electrical';
    if (ref.startsWith('CON-MAN-')) return 'Manpower';
    return 'Quarry';
  };

  const startEdit = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setFormData({
      employee_id: contractor.employee_id || '',
      password: '',
      full_name: contractor.full_name,
      email: contractor.email || '',
      phone: contractor.phone?.replace(/^\+91\s*/, '') || '',
      function: getFunctionFromRef(contractor.employee_id),
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingContractor(null);
    setFormData({ employee_id: '', password: '', full_name: '', email: '', phone: '', function: 'Quarry' });
  };

  const generateRefNumber = (func: string) => {
    const prefixMap: Record<string, string> = {
      'Quarry': 'CON-QRY-',
      'Crusher': 'CON-CRU-',
      'Electrical': 'CON-ELE-',
      'Manpower': 'CON-MAN-',
    };
    const prefix = prefixMap[func] || 'CON-GEN-';
    
    try {
      const stored = localStorage.getItem('sribaba_contractors');
      const currentList: Contractor[] = stored ? JSON.parse(stored) : [];
      
      const numbers = currentList
        .map(u => {
          if (u.employee_id && u.employee_id.startsWith(prefix)) {
            const parts = u.employee_id.split('-');
            if (parts && parts.length === 3) {
              return parseInt(parts[2], 10);
            }
          }
          return null;
        })
        .filter((n): n is number => n !== null && !isNaN(n))
        .sort((a, b) => a - b);
        
      let nextId = 1;
      for (const num of numbers) {
        if (num === nextId) nextId++;
        else if (num > nextId) break;
      }
      
      return `${prefix}${nextId.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating ref number:', error);
      return `${prefix}001`;
    }
  };

  const handleFunctionChange = (func: string) => {
    setFormData(prev => ({ ...prev, function: func }));
    if (!editingContractor) {
      const ref = generateRefNumber(func);
      setFormData(prev => ({ ...prev, employee_id: ref }));
    }
  };

  const openAddForm = () => {
    const ref = generateRefNumber(formData.function);
    setFormData(prev => ({ ...prev, employee_id: ref }));
    setShowForm(true);
  };

  const filteredContractors = contractors.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.employee_id && c.employee_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  const availableMonths = Array.from(new Set(
    transactions
      .filter(t => t.transaction_type === 'expense')
      .map(t => new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }))
  ));

  const selectedMonthTotals = (() => {
    let advance = 0;
    let payment = 0;
    
    transactions.forEach(t => {
      if (t.transaction_type !== 'expense') return;
      
      const m = new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      if (selectedMonth !== 'all' && m !== selectedMonth) return;
      
      const isAdvance = (() => {
        if (t.notes) {
          const parts = t.notes.split(' | ');
          const itemPart = parts.find((p: string) => p.startsWith('Item: '));
          if (itemPart) {
            const itemValue = itemPart.replace('Item: ', '').toLowerCase();
            if (itemValue.includes('payment')) return false;
            if (itemValue.includes('advance')) return true;
          }
        }
        return t.reason?.toLowerCase().includes('advance') || 
               t.notes?.toLowerCase().includes('advance');
      })();
      
      const amount = t.amount_given || t.amount || 0;
      if (isAdvance) {
        advance += amount;
      } else {
        payment += amount;
      }
    });
    
    return { advance, payment };
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Contractor Management</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Manage quarry contractors and their details</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-2xl hover:bg-orange-500 transition-all font-bold text-sm shadow-lg shadow-orange-600/20 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add New Contractor
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search contractors by name or ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none bg-white"
        />
      </div>

      {/* Contractor Cards Grid */}
      {filteredContractors.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-slate-100 p-20 text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-orange-400" />
          </div>
          <p className="font-black text-slate-900 text-xl">No contractors found</p>
          <p className="text-slate-400 font-medium mt-1 text-sm">Try a different search term or add a new contractor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContractors.map(contractor => (
            <div
              key={contractor.id}
              className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="p-5 cursor-pointer hover:bg-slate-50/40 transition-colors" onClick={() => fetchHistory(contractor)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-600/20">
                      <span className="text-white font-black text-lg">{contractor.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-base leading-tight">{contractor.full_name}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-0.5 font-mono flex items-center gap-2">
                        {contractor.employee_id || '—'}
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-black uppercase text-slate-600 font-sans tracking-wider">
                          {contractor.employee_id?.startsWith('CON-QRY-') ? 'Quarry' :
                           contractor.employee_id?.startsWith('CON-CRU-') ? 'Crusher' :
                           contractor.employee_id?.startsWith('CON-ELE-') ? 'Electrical' :
                           contractor.employee_id?.startsWith('CON-MAN-') ? 'Manpower' : 'General'}
                        </span>
                      </p>
                      <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-slate-100/80">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</span>
                        <span className="text-sm font-black text-red-600">₹{(contractorExpenses[contractor.id] || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(contractor.id, contractor.is_active)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                      contractor.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {contractor.is_active ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  {contractor.phone && (
                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-300" /> {contractor.phone}
                    </p>
                  )}
                  {contractor.email && (
                    <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-slate-300" /> {contractor.email}
                    </p>
                  )}
                  <p className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-200" /> Added {new Date(contractor.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => startEdit(contractor)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-white hover:border-slate-300 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDeleteContractor(contractor.id, contractor.full_name)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  {editingContractor ? <Edit2 className="w-6 h-6 text-white" /> : <UserPlus className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{editingContractor ? 'Edit Contractor' : 'Add New Contractor'}</h3>
                  <p className="text-slate-400 text-sm font-medium mt-0.5">Enter contractor personal and login details</p>
                </div>
              </div>
              <button onClick={cancelForm} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Work Function *
                  </label>
                  <select
                    value={formData.function}
                    onChange={e => handleFunctionChange(e.target.value)}
                    disabled={!!editingContractor}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none bg-white"
                  >
                    <option value="Quarry">Quarry</option>
                    <option value="Crusher">Crusher</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Manpower">Manpower</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Key className="w-3 h-3" /> Contractor Ref Number
                  </label>
                  <input
                    type="text" required value={formData.employee_id}
                    onChange={e => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                    disabled={!!editingContractor}
                    className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none font-mono ${editingContractor ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                    placeholder="CON-DRL-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Full Name *
                  </label>
                  <input
                    type="text" required value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none"
                    placeholder="Full Name"
                  />
                </div>

                {!editingContractor && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Password *
                    </label>
                    <input
                      type="password" required value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none"
                      placeholder="Set login password"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input
                    type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <div className="flex">
                    <span className="flex items-center px-3 bg-slate-100 border-2 border-r-0 border-slate-200 rounded-l-xl text-sm font-bold text-slate-500">+91</span>
                    <input
                      type="tel" value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-r-xl text-sm font-bold focus:ring-4 focus:ring-orange-600/10 focus:border-orange-600 transition-all outline-none"
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <button type="button" onClick={cancelForm} className="px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-white transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-orange-600 text-white rounded-xl font-black text-sm hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                >
                  {editingContractor ? 'Update Contractor' : 'Create Contractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {activeHistoryContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 text-white font-black text-lg">
                  {activeHistoryContractor.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{activeHistoryContractor.full_name}</h3>
                  <p className="text-slate-400 text-xs font-mono font-bold mt-0.5">{activeHistoryContractor.employee_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {transactions.length > 0 && (
                  <div className="flex items-center gap-3 animate-in fade-in duration-500">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-300 outline-none focus:bg-slate-700 focus:border-orange-500 transition-all cursor-pointer"
                    >
                      <option value="all">All Months</option>
                      {availableMonths.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <div className="bg-slate-800 border border-slate-700/50 px-4 py-2 rounded-2xl flex items-center gap-4 text-xs">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {selectedMonth === 'all' ? 'Overall Total' : selectedMonth}
                        </p>
                      </div>
                      <div className="border-l border-slate-700 h-6" />
                      <div className="text-right">
                        <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Adv</p>
                        <p className="font-black text-amber-200">₹{selectedMonthTotals.advance.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="border-l border-slate-700 h-6" />
                      <div className="text-right">
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-wider">Pay</p>
                        <p className="font-black text-blue-200">₹{selectedMonthTotals.payment.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setActiveHistoryContractor(null)} 
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Clock className="w-8 h-8 animate-spin text-orange-500" />
                  <p className="font-bold text-sm">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-black text-slate-900 text-lg">No transaction history found</p>
                  <p className="text-slate-400 font-medium text-sm mt-1">This contractor hasn't received payments through the accounting system yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Month Selector moved to header */}

                  <div className="overflow-x-auto rounded-2xl border-2 border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                          <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Type</th>
                          <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Purpose</th>
                          <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Amount Paid</th>
                          <th className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions
                          .filter(t => {
                            if (selectedMonth === 'all') return true;
                            const m = new Date(t.transaction_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                            return m === selectedMonth;
                          })
                          .map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm font-bold text-slate-800 font-mono">
                            {new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4">
                            {(() => {
                              const isAdvance = (() => {
                                if (t.notes) {
                                  const parts = t.notes.split(' | ');
                                  const itemPart = parts.find((p: string) => p.startsWith('Item: '));
                                  if (itemPart) {
                                    const itemValue = itemPart.replace('Item: ', '').toLowerCase();
                                    if (itemValue.includes('payment')) return false;
                                    if (itemValue.includes('advance')) return true;
                                  }
                                }
                                return t.reason?.toLowerCase().includes('advance') || 
                                       t.notes?.toLowerCase().includes('advance');
                              })();
                              return (
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isAdvance ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {isAdvance ? 'Advance' : 'Payment'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-sm font-semibold text-slate-600 max-w-xs truncate" title={t.reason}>
                            {t.reason || '—'}
                          </td>
                          <td className="p-4 text-sm font-black text-slate-900">
                            ₹{(t.amount_given || t.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-500 uppercase">
                            {t.payment_method?.replace(/_/g, ' ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
