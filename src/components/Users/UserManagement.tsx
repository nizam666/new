import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Trash2, Edit2, CheckCircle, XCircle, Search } from 'lucide-react';

interface User {
  id: string;
  employee_id?: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    employee_id: '',
    password: '',
    full_name: '',
    role: 'contractor',
    email: '',
    phone: '',
  });

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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: formData.employee_id,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          email: formData.email,
          phone: formData.phone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      alert('User created successfully!');
      setShowAddForm(false);
      setFormData({
        employee_id: '',
        password: '',
        full_name: '',
        role: 'contractor',
        email: '',
        phone: '',
      });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error instanceof Error ? error.message : (error as any).message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          email: formData.email,
          phone: formData.phone,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      alert('User updated successfully!');
      setEditingUser(null);
      setFormData({
        employee_id: '',
        password: '',
        full_name: '',
        role: 'contractor',
        email: '',
        phone: '',
      });
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error instanceof Error ? error.message : (error as any).message || 'Failed to update user');
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string, userIdentifier: string) => {
    if (!confirm(`Are you sure you want to delete user ${userIdentifier}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      alert('User deleted successfully!');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      employee_id: user.employee_id || user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      email: user.email || '',
      phone: user.phone?.startsWith('+91') ? user.phone : (user.phone ? `+91 ${user.phone}` : ''),
    });
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingUser(null);
    setFormData({
      employee_id: '',
      password: '',
      full_name: '',
      role: 'contractor',
      email: '',
      phone: '',
    });
  };

  const cleanupOrphanedUsers = async () => {
    if (!confirm('This will remove any auth users that don\'t have corresponding user records. Continue?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-orphaned-users`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cleanup users');
      }

      alert(`Cleanup complete! Removed ${result.orphaned_count} orphaned auth user(s).`);
      loadUsers();
    } catch (error) {
      console.error('Error cleaning up users:', error);
      alert(error instanceof Error ? error.message : 'Failed to cleanup users');
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.employee_id && user.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Add, edit, and manage system users</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={cleanupOrphanedUsers}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Cleanup Orphaned Users
          </button>
          <button
            onClick={() => {
              if (!showAddForm) {
                // Find all existing EMP numbers to find the first available gap
                const empNumbers = users
                  .map(u => {
                    if (u.employee_id && u.employee_id.startsWith('EMP')) {
                      const num = parseInt(u.employee_id.replace('EMP', ''), 10);
                      return isNaN(num) ? null : num;
                    }
                    return null;
                  })
                  .filter((n): n is number => n !== null)
                  .sort((a, b) => a - b);

                let nextId = 1;
                for (const num of empNumbers) {
                  if (num === nextId) {
                    nextId++;
                  } else if (num > nextId) {
                    break; // Found a gap!
                  }
                }
                
                const formattedId = `EMP${nextId.toString().padStart(3, '0')}`;
                setFormData(prev => ({ ...prev, employee_id: formattedId }));
              }
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add New User
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h3>
          <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employee ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                  disabled={!!editingUser}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent ${
                    !!editingUser ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="contractor">Contractor</option>
                  <option value="crusher_manager">Crusher Manager</option>
                  <option value="manager">Manager</option>
                  <option value="chairmen">Chairmen</option>
                  <option value="sales">Sales</option>
                  <option value="quarry_worker">Quarry Worker</option>
                  <option value="crusher_worker">Crusher Worker</option>
                  <option value="worker">General Worker (Legacy)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                  title="Please enter a valid email address (e.g. name@example.com)"
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={formData.phone.replace(/^\+91\s*/, '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, phone: val ? `+91 ${val}` : '' });
                    }}
                    className="flex-1 w-full px-3 py-2 border border-slate-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="10-digit number"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )
      }

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name, employee ID, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{user.full_name}</div>
                      <div className="text-sm text-slate-500">{user.employee_id || user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">
                      {user.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="flex items-center gap-1"
                    >
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.employee_id || user.email)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No users found</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <p className="text-sm text-slate-600">
          <strong>Total Users:</strong> {users.length} |
          <strong className="ml-3">Active:</strong> {users.filter(u => u.is_active).length} |
          <strong className="ml-3">Inactive:</strong> {users.filter(u => !u.is_active).length}
        </p>
      </div>
    </div >
  );
}
