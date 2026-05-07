import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  UserPlus, Trash2, Edit2, CheckCircle, XCircle, Search, X,
  Home, Factory, Drill, ClipboardCheck, Truck, Users, Clock,
  Camera, Package, Shield, Zap, ShoppingCart, FileText, Wallet,
  BarChart3, Wrench, Receipt, Calculator, Database, RotateCcw,
  Key, User, Phone, Mail, Lock, ChevronDown, ChevronRight
} from 'lucide-react';

interface User {
  id: string;
  employee_id?: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  permissions?: string[];
}

// All available access modules in the system
const ACCESS_MODULES = [
  {
    group: 'Core',
    icon: Home,
    color: 'slate',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: Home },
      { key: 'selfie_attendance', label: 'Selfie Attendance', icon: Camera },
      { key: 'safety', label: 'Safety', icon: Shield },
      { key: 'permits', label: 'Permits', icon: FileText },
    ]
  },
  {
    group: 'Quarry Work',
    icon: Factory,
    color: 'orange',
    items: [
      { key: 'drilling', label: 'Drilling', icon: Drill },
      { key: 'blasting', label: 'Blasting', icon: Factory },
      { key: 'loading', label: 'Breaking / Loading', icon: ClipboardCheck },
      { key: 'transport', label: 'Transport', icon: Truck },
      { key: 'quarry_attendance', label: 'Attendance', icon: Clock },
      { key: 'quarry_jcb', label: 'JCB Operations (Quarry)', icon: Truck },
      { key: 'quarry_storage', label: 'Storage Management', icon: Database },
      { key: 'boulders_report', label: 'Boulders Sale Report', icon: BarChart3 },
      { key: 'contractor_billing', label: 'Contractor Calculator', icon: Calculator },
      { key: 'quarry_production', label: 'Quarry Production Report', icon: FileText },
      { key: 'contractor_deductions', label: 'Quarry Deduction Report', icon: FileText },
    ]
  },
  {
    group: 'Crusher Work',
    icon: Factory,
    color: 'blue',
    items: [
      { key: 'crusher_attendance', label: 'Crusher Attendance', icon: Clock },
      { key: 'photos_videos', label: 'Photos / Videos', icon: Camera },
      { key: 'crusher_production', label: 'Crusher Production', icon: Factory },
      { key: 'crusher_efficiency', label: 'Production Cost (Avg)', icon: Calculator },
      { key: 'eb_reports', label: 'EB Reports', icon: Zap },
      { key: 'eb_records', label: 'EB Records', icon: Receipt },
      { key: 'eb_calculator', label: 'EB Calculator', icon: Calculator },
      { key: 'crusher_maintenance', label: 'Maintenance', icon: Wrench },
      { key: 'crusher_jcb', label: 'JCB Operations (Crusher)', icon: Truck },
    ]
  },
  {
    group: 'Inventory',
    icon: Package,
    color: 'emerald',
    items: [
      { key: 'vendor_management', label: 'Vendor Management', icon: Users },
      { key: 'vendor_bill_entry', label: 'New Bill Entry', icon: Receipt },
      { key: 'inventory', label: 'Inventory Hub', icon: Package },
      { key: 'item_management', label: 'Item Management', icon: Database },
      { key: 'stock_issue', label: 'Issue Items', icon: ClipboardCheck },
      { key: 'returnable_assets', label: 'Returnable Assets', icon: RotateCcw },
      { key: 'storage', label: 'Storage Management', icon: Database },
      { key: 'dispatch', label: 'Inventory Dispatch', icon: Truck },
    ]
  },
  {
    group: 'Sales & Customers',
    icon: ShoppingCart,
    color: 'purple',
    items: [
      { key: 'sales', label: 'Sales', icon: ShoppingCart },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'material_investors', label: 'Material Investors', icon: BarChart3 },
    ]
  },
  {
    group: 'Financials',
    icon: Wallet,
    color: 'indigo',
    items: [
      { key: 'accounts', label: 'Accounts (Fund)', icon: Wallet },
      { key: 'overhead_management', label: 'Overhead Management', icon: Shield },
    ]
  },
  {
    group: 'Reports & Admin',
    icon: BarChart3,
    color: 'indigo',
    items: [
      { key: 'material_balance', label: 'Material Balance', icon: Factory },
      { key: 'quarry_cost', label: 'Production Cost (Q)', icon: Calculator },
      { key: 'sales_report', label: 'Sales Analytics', icon: ShoppingCart },
      { key: 'accounting_report', label: 'Financial Report', icon: Wallet },
      { key: 'operations_history', label: 'Operations History', icon: Database },
      { key: 'attendance_report', label: 'Attendance Report', icon: Clock },
      { key: 'permit_reports', label: 'Permit Reports', icon: FileText },
      { key: 'user_management', label: 'User Management', icon: Users },
      { key: 'contractor_management', label: 'Contractor Management', icon: Users },
      { key: 'approvals', label: 'Approvals', icon: ClipboardCheck },
    ]
  },
];

const COLOR_MAP: Record<string, { bg: string; activeBg: string; border: string; activeBorder: string; text: string; activeText: string; groupBg: string; groupText: string; dot: string }> = {
  slate:   { bg: 'bg-slate-50',   activeBg: 'bg-slate-900',   border: 'border-slate-200',   activeBorder: 'border-slate-900',   text: 'text-slate-600',   activeText: 'text-white',   groupBg: 'bg-slate-900',   groupText: 'text-white',    dot: 'bg-slate-200'   },
  orange:  { bg: 'bg-orange-50',  activeBg: 'bg-orange-600',  border: 'border-orange-200',  activeBorder: 'border-orange-600',  text: 'text-orange-700',  activeText: 'text-white',   groupBg: 'bg-orange-600',  groupText: 'text-white',    dot: 'bg-orange-100'  },
  blue:    { bg: 'bg-blue-50',    activeBg: 'bg-blue-600',    border: 'border-blue-200',    activeBorder: 'border-blue-600',    text: 'text-blue-700',    activeText: 'text-white',   groupBg: 'bg-blue-600',    groupText: 'text-white',    dot: 'bg-blue-100'    },
  emerald: { bg: 'bg-emerald-50', activeBg: 'bg-emerald-600', border: 'border-emerald-200', activeBorder: 'border-emerald-600', text: 'text-emerald-700', activeText: 'text-white',   groupBg: 'bg-emerald-600', groupText: 'text-white',    dot: 'bg-emerald-100' },
  purple:  { bg: 'bg-purple-50',  activeBg: 'bg-purple-600',  border: 'border-purple-200',  activeBorder: 'border-purple-600',  text: 'text-purple-700',  activeText: 'text-white',   groupBg: 'bg-purple-600',  groupText: 'text-white',    dot: 'bg-purple-100'  },
  indigo:  { bg: 'bg-indigo-50',  activeBg: 'bg-indigo-600',  border: 'border-indigo-200',  activeBorder: 'border-indigo-600',  text: 'text-indigo-700',  activeText: 'text-white',   groupBg: 'bg-indigo-600',  groupText: 'text-white',    dot: 'bg-indigo-100'  },
};

// Derive a "role" string from permissions for DB storage
function deriveRole(permissions: string[]): string {
  const p = new Set(permissions);
  if (p.has('user_management') && p.has('accounts') && p.has('approvals') && p.has('accounting_report')) return 'director';
  if (p.has('accounts') && p.has('accounting_report') && !p.has('drilling')) return 'chairmen';
  if (p.has('sales') && !p.has('drilling') && !p.has('crusher_production')) return 'sales';
  if (p.has('crusher_production') && !p.has('drilling')) return 'crusher_manager';
  if (p.has('drilling') || p.has('blasting') || p.has('loading') || p.has('transport')) return 'contractor';
  if (p.has('approvals') || p.has('accounting_report') || p.has('inventory')) return 'manager';
  return 'worker';
}

// Preset access bundles
const PRESETS: { label: string; color: string; permissions: string[] }[] = [
  { label: 'Director (Full)', color: 'slate', permissions: ACCESS_MODULES.flatMap(g => g.items.map(i => i.key)) },
  { label: 'Chairmen', color: 'indigo', permissions: ['dashboard', 'selfie_attendance', 'accounts', 'accounting_report', 'sales_report', 'attendance_report'] },
  { label: 'Manager', color: 'blue', permissions: ['dashboard', 'selfie_attendance', 'drilling', 'blasting', 'loading', 'transport', 'quarry_attendance', 'crusher_attendance', 'photos_videos', 'inventory', 'returnable_assets', 'safety', 'crusher_production', 'eb_reports', 'eb_records', 'eb_calculator', 'crusher_maintenance', 'sales', 'customers', 'approvals', 'quarry_production', 'sales_report', 'accounting_report', 'attendance_report'] },
  { label: 'Contractor', color: 'orange', permissions: ['dashboard', 'selfie_attendance', 'drilling', 'blasting', 'loading', 'transport', 'quarry_attendance', 'photos_videos', 'inventory', 'safety', 'contractor_billing', 'contractor_deductions', 'quarry_production'] },
  { label: 'Crusher Manager', color: 'purple', permissions: ['dashboard', 'selfie_attendance', 'crusher_attendance', 'photos_videos', 'crusher_production', 'eb_reports', 'eb_records', 'eb_calculator', 'crusher_maintenance', 'inventory', 'returnable_assets'] },
  { label: 'Sales', color: 'emerald', permissions: ['dashboard', 'selfie_attendance', 'sales', 'customers', 'accounts', 'sales_report'] },
  { label: 'Quarry Worker', color: 'orange', permissions: ['dashboard', 'selfie_attendance', 'quarry_attendance'] },
];

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, employee_id, email, full_name, role, phone, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const togglePermission = (key: string) => {
    setSelectedPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const toggleGroup = (groupItems: { key: string }[]) => {
    const keys = groupItems.map(i => i.key);
    const allSelected = keys.every(k => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !keys.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...keys])]);
    }
  };

  const applyPreset = (permissions: string[]) => {
    setSelectedPermissions([...permissions]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = deriveRole(selectedPermissions);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update({ full_name: formData.full_name, role, email: formData.email, phone: formData.phone })
          .eq('id', editingUser.id);
        if (error) throw error;
        alert('User updated successfully!');
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, role }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create user');
        alert('User created successfully!');
      }
      cancelForm();
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert(error instanceof Error ? error.message : 'Failed to save user');
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      alert('User deleted.');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      employee_id: user.employee_id || '',
      password: '',
      full_name: user.full_name,
      email: user.email || '',
      phone: user.phone?.replace(/^\+91\s*/, '') || '',
    });
    // Restore permissions from role (best-effort mapping)
    const rolePreset = PRESETS.find(p => deriveRole(p.permissions) === user.role);
    setSelectedPermissions(rolePreset ? [...rolePreset.permissions] : []);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setSelectedPermissions([]);
    setFormData({ employee_id: '', password: '', full_name: '', email: '', phone: '' });
  };

  const openAddForm = () => {
    // Auto-generate employee ID
    const empNumbers = users
      .map(u => u.employee_id?.startsWith('EMP') ? parseInt(u.employee_id.replace('EMP', ''), 10) : null)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    let nextId = 1;
    for (const num of empNumbers) {
      if (num === nextId) nextId++;
      else if (num > nextId) break;
    }
    setFormData(prev => ({ ...prev, employee_id: `EMP${nextId.toString().padStart(3, '0')}` }));
    setShowForm(true);
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.employee_id && u.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPermCount = ACCESS_MODULES.flatMap(g => g.items).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">User Management</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Manage employees and their module access</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 transition-all font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add New Employee
        </button>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  {editingUser ? <Edit2 className="w-6 h-6 text-white" /> : <UserPlus className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{editingUser ? 'Edit Employee' : 'Add New Employee'}</h3>
                  <p className="text-slate-400 text-sm font-medium mt-0.5">Fill details and assign module access</p>
                </div>
              </div>
              <button onClick={cancelForm} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-8 space-y-8">
                {/* ── Basic Info ── */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Employee Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Key className="w-3 h-3" /> Employee ID
                      </label>
                      <input
                        type="text" required value={formData.employee_id}
                        onChange={e => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                        disabled={!!editingUser}
                        className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none ${editingUser ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                        placeholder="EMP001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Full Name *
                      </label>
                      <input
                        type="text" required value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none"
                        placeholder="Full Name"
                      />
                    </div>
                    {!editingUser && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Lock className="w-3 h-3" /> Password *
                        </label>
                        <input
                          type="password" required value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none"
                          placeholder="Set password"
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
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none"
                        placeholder="name@example.com"
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
                          className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-r-xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none"
                          placeholder="10-digit number"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Presets ── */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quick Presets</h4>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-widest">
                      {selectedPermissions.length} / {totalPermCount} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map(preset => {
                      const c = COLOR_MAP[preset.color];
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset.permissions)}
                          className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${c.bg} ${c.border} ${c.text} hover:${c.activeBg} hover:${c.activeText}`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions([])}
                      className="px-3 py-1.5 rounded-xl border-2 border-red-200 bg-red-50 text-xs font-black uppercase tracking-wider text-red-600 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* ── Module Access Bullets ── */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Module Access</h4>
                  <div className="space-y-5">
                    {ACCESS_MODULES.map(group => {
                      const c = COLOR_MAP[group.color];
                      const groupKeys = group.items.map(i => i.key);
                      const allGroupSelected = groupKeys.every(k => selectedPermissions.includes(k));
                      const someGroupSelected = groupKeys.some(k => selectedPermissions.includes(k));
                      const GroupIcon = group.icon;

                      return (
                        <div key={group.group} className={`rounded-2xl border-2 overflow-hidden ${someGroupSelected ? c.activeBorder : 'border-slate-100'}`}>
                          {/* Group Header */}
                          <div
                            className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${someGroupSelected ? c.groupBg : 'bg-slate-50'}`}
                            onClick={() => toggleGroup(group.items)}
                          >
                            <div className="flex items-center gap-3">
                              <GroupIcon className={`w-4 h-4 ${someGroupSelected ? 'text-white' : 'text-slate-500'}`} />
                              <span className={`text-xs font-black uppercase tracking-widest ${someGroupSelected ? 'text-white' : 'text-slate-600'}`}>
                                {group.group}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${someGroupSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {groupKeys.filter(k => selectedPermissions.includes(k)).length}/{groupKeys.length}
                              </span>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${allGroupSelected ? 'bg-white border-white' : someGroupSelected ? 'bg-white/30 border-white/50' : 'bg-transparent border-slate-300'}`}>
                                {allGroupSelected && <CheckCircle className={`w-4 h-4 ${someGroupSelected ? c.text : 'text-slate-900'}`} />}
                              </div>
                            </div>
                          </div>

                          {/* Items */}
                          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 p-4 ${c.dot}`}>
                            {group.items.map(item => {
                              const isSelected = selectedPermissions.includes(item.key);
                              const ItemIcon = item.icon;
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => togglePermission(item.key)}
                                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-95 text-left ${
                                    isSelected
                                      ? `${c.activeBg} ${c.activeBorder} shadow-md`
                                      : `bg-white ${c.border} hover:${c.bg}`
                                  }`}
                                >
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white/20' : c.bg}`}>
                                    <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : c.text}`} />
                                  </div>
                                  <span className={`text-[11px] font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Derived Role Preview */}
                {selectedPermissions.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl px-5 py-4 border-2 border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Derived System Role</p>
                      <p className="text-base font-black text-slate-900 capitalize">{deriveRole(selectedPermissions).replace(/_/g, ' ')}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Modules</p>
                      <p className="text-base font-black text-slate-900">{selectedPermissions.length}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                <button type="button" onClick={cancelForm} className="px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-white transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedPermissions.length === 0}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingUser ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Search + Stats Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee ID, or role..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all outline-none bg-white"
          />
        </div>
        <div className="flex items-center gap-3 sm:flex-shrink-0">
          <div className="px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-center min-w-[80px]">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-xl font-black text-slate-900">{users.length}</p>
          </div>
          <div className="px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-center min-w-[80px]">
            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Active</p>
            <p className="text-xl font-black text-emerald-700">{users.filter(u => u.is_active).length}</p>
          </div>
          <div className="px-4 py-3 bg-red-50 border-2 border-red-200 rounded-2xl text-center min-w-[80px]">
            <p className="text-xs font-black text-red-500 uppercase tracking-widest">Inactive</p>
            <p className="text-xl font-black text-red-700">{users.filter(u => !u.is_active).length}</p>
          </div>
        </div>
      </div>

      {/* ── User Cards Grid ── */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-slate-100 p-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-black text-slate-900 text-xl">No employees found</p>
          <p className="text-slate-400 font-medium mt-1 text-sm">Try a different search term, or add a new employee.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map(user => {
            const isExpanded = expandedUser === user.id;
            // Map role to color
            const roleColorMap: Record<string, string> = { director: 'slate', chairmen: 'indigo', manager: 'blue', contractor: 'orange', crusher_manager: 'purple', sales: 'emerald', quarry_worker: 'orange', crusher_worker: 'blue', worker: 'slate' };
            const colorKey = roleColorMap[user.role] || 'slate';
            const c = COLOR_MAP[colorKey];

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Card Top */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${c.activeBg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <span className="text-white font-black text-lg">{user.full_name.charAt(0)}</span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-base leading-tight">{user.full_name}</h4>
                        <p className="text-xs font-bold text-slate-400 mt-0.5 font-mono">{user.employee_id || '—'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                        user.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {user.is_active ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                    </button>
                  </div>

                  {/* Role Badge + Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {user.phone && (
                      <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {user.phone}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3" /> {user.email}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Added {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Access Preview - show module bullet indicators */}
                  <button
                    type="button"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 transition-colors"
                  >
                    <span>View Access Modules</span>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      {ACCESS_MODULES.map(group => {
                        // Derive what this role would have access to from PRESETS
                        const rolePreset = PRESETS.find(p => deriveRole(p.permissions) === user.role);
                        const grantedKeys = new Set(rolePreset?.permissions || []);
                        const hasAny = group.items.some(i => grantedKeys.has(i.key));
                        if (!hasAny) return null;
                        return (
                          <div key={group.group}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{group.group}</p>
                            <div className="flex flex-wrap gap-1">
                              {group.items.filter(i => grantedKeys.has(i.key)).map(item => (
                                <span key={item.key} className={`px-2 py-0.5 rounded text-[9px] font-black ${c.bg} ${c.text} border ${c.border}`}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => startEdit(user)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-white hover:border-slate-300 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.full_name)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
