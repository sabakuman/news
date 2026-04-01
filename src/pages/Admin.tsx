import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const Admin: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'editor' as UserRole,
    status: 'active' as 'active' | 'inactive',
    departmentId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewUser({
          username: '',
          password: '',
          name: '',
          email: '',
          role: 'editor',
          status: 'active',
          departmentId: ''
        });
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'فشل إضافة المستخدم');
      }
    } catch (error) {
      console.error('Error adding user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === currentUser?.uid) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      const res = await fetch(`/api/users/${uid}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'فشل حذف المستخدم');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">إدارة المستخدمين</h1>
          <p className="text-on-surface-variant font-medium mt-1">إضافة وتعديل صلاحيات الموظفين في النظام.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="h-12 px-6 bg-primary text-on-primary font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center gap-2"
        >
          <span className="material-symbols-rounded">person_add</span>
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">إضافة مستخدم جديد</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">اسم المستخدم (Login)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">كلمة المرور</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">الصلاحية</label>
                  <select
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  >
                    <option value="editor">محرر / معد</option>
                    <option value="reviewer">مراجع داخلي</option>
                    <option value="sector_approver">معتمد قطاع</option>
                    <option value="final_approver">معتمد نهائي</option>
                    <option value="admin">مسؤول نظام</option>
                    <option value="viewer">مشاهد فقط</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant">القطاع</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={newUser.departmentId}
                    onChange={(e) => setNewUser({ ...newUser, departmentId: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-primary text-on-primary font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الإضافة...' : 'حفظ المستخدم'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 bg-surface-container-high text-on-surface font-bold rounded-xl hover:bg-surface-container-highest transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4" dir="rtl">
        <div className="relative">
          <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40">search</span>
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm text-on-surface transition-all text-right"
          />
        </div>
        <div className="relative">
          <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40">filter_list</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full pr-10 pl-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm text-on-surface appearance-none font-bold transition-all text-right"
          >
            <option value="all">جميع الصلاحيات</option>
            <option value="admin">مسؤول نظام</option>
            <option value="editor">محرر / معد</option>
            <option value="reviewer">مراجع داخلي</option>
            <option value="sector_approver">معتمد قطاع</option>
            <option value="final_approver">معتمد نهائي</option>
            <option value="viewer">مشاهد فقط</option>
          </select>
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4 border-b border-outline-variant">الموظف</th>
                <th className="px-6 py-4 border-b border-outline-variant">الصلاحية</th>
                <th className="px-6 py-4 border-b border-outline-variant">القطاع</th>
                <th className="px-6 py-4 border-b border-outline-variant">الحالة</th>
                <th className="px-6 py-4 border-b border-outline-variant"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{u.name}</p>
                        <p className="text-xs text-on-surface-variant">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-[18px] text-primary">shield</span>
                      <span className="text-sm text-on-surface font-medium">
                        {u.role === 'admin' ? 'مسؤول نظام' : 
                         u.role === 'editor' ? 'محرر / معد' : 
                         u.role === 'reviewer' ? 'مراجع داخلي' : 
                         u.role === 'sector_approver' ? 'معتمد قطاع' : 
                         u.role === 'final_approver' ? 'معتمد نهائي' : 'مشاهد فقط'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant font-medium">{u.departmentId || 'غير محدد'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                      u.status === 'active' 
                        ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : "bg-error-container text-on-error-container border-error/20"
                    )}>
                      {u.status === 'active' ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDeleteUser(u.uid)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-all"
                        title="حذف"
                      >
                        <span className="material-symbols-rounded text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-on-surface-variant/40">
                      <span className="material-symbols-rounded text-[64px]">person_search</span>
                      <p className="text-lg font-bold">لا يوجد مستخدمين يطابقون البحث</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;
