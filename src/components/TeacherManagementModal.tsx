import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Shield,
  Check,
  AlertCircle,
  Pencil,
  Trash2,
  Lock,
  Mail,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { UserAccount } from '../types';

interface TeacherManagementModalProps {
  currentUser: UserAccount;
  onClose: () => void;
  onUserUpdated?: (updated: UserAccount) => void;
}

interface TeacherItem {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  password?: string;
}

export const TeacherManagementModal: React.FC<TeacherManagementModalProps> = ({
  currentUser,
  onClose,
  onUserUpdated,
}) => {
  const isAdmin = Boolean(
    currentUser.isAdmin || currentUser.email.toLowerCase() === 'chuckacr1501@gmail.com'
  );

  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('welcome123');
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  // Edit modal state
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-user-role': currentUser.role,
    'x-user-id': currentUser.id,
    'x-user-email': currentUser.email,
    'x-user-name': currentUser.name,
    'x-is-admin': String(isAdmin),
  };

  const fetchTeachers = async () => {
    let list: TeacherItem[] = [
      {
        id: 'teacher-chuck',
        name: 'Chuck',
        email: 'ChuckACR1501@gmail.com',
        isAdmin: true,
      },
    ];

    try {
      const stored = localStorage.getItem('allears_authorized_teachers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          list = [...list, ...parsed];
        }
      }
    } catch {}

    try {
      const res = await fetch('/api/auth/teachers', { headers: authHeaders });
      const data = await res.json();
      if (data.teachers && Array.isArray(data.teachers)) {
        list = data.teachers;
      }
    } catch {
      // In static deployment, use list
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = list.filter((t) => {
      const key = t.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setTeachers(unique);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only administrators can create teacher accounts.');
      return;
    }
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const isChuck = newEmail.trim().toLowerCase() === 'chuckacr1501@gmail.com';
    const newRecord: TeacherItem = {
      id: `teacher-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword.trim(),
      isAdmin: isChuck ? true : newIsAdmin,
    };

    // Store in localStorage for static deployment
    try {
      const stored = localStorage.getItem('allears_authorized_teachers');
      const parsed = stored ? JSON.parse(stored) : [];
      const updated = Array.isArray(parsed) ? [...parsed, newRecord] : [newRecord];
      localStorage.setItem('allears_authorized_teachers', JSON.stringify(updated));
    } catch {}

    try {
      const res = await fetch('/api/auth/add-teacher', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword.trim(),
          isAdmin: isChuck ? true : newIsAdmin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to authorize teacher.');
        setIsSubmitting(false);
        return;
      }

      setStatusMessage(`Teacher "${newName}" authorized successfully!`);
      setNewName('');
      setNewEmail('');
      setNewPassword('welcome123');
      setNewIsAdmin(false);
      fetchTeachers();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('Backend offline, teacher saved to local storage:', err);
      setStatusMessage(`Teacher "${newName}" authorized in local storage.`);
      setNewName('');
      setNewEmail('');
      setNewPassword('welcome123');
      fetchTeachers();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (t: TeacherItem) => {
    setEditingTeacher(t);
    setEditName(t.name);
    setEditEmail(t.email);
    setEditPassword(t.password || '');
    setEditIsAdmin(Boolean(t.isAdmin || t.email.toLowerCase() === 'chuckacr1501@gmail.com'));
    setErrorMessage(null);
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMessage('Teachers cannot edit information of admins and other teachers.');
      return;
    }
    if (!editingTeacher) return;
    if (!editName.trim() || !editEmail.trim()) {
      setErrorMessage('Teacher display name and email/username are required.');
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    const isChuck = (editEmail || editingTeacher.email).toLowerCase() === 'chuckacr1501@gmail.com';
    const finalIsAdmin = isChuck ? true : editIsAdmin;

    // Update in localStorage
    try {
      const stored = localStorage.getItem('allears_authorized_teachers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((item: any) =>
            item.id === editingTeacher.id || item.email.toLowerCase() === editingTeacher.email.toLowerCase()
              ? {
                  ...item,
                  name: editName.trim(),
                  email: editEmail.trim(),
                  password: editPassword.trim() || item.password,
                  isAdmin: finalIsAdmin,
                }
              : item
          );
          localStorage.setItem('allears_authorized_teachers', JSON.stringify(updated));
        }
      }
    } catch {}

    try {
      const res = await fetch(`/api/auth/teachers/${editingTeacher.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          password: editPassword.trim() || undefined,
          isAdmin: finalIsAdmin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update teacher.');
        setIsUpdating(false);
        return;
      }

      setStatusMessage(`Teacher profile "${editName}" updated successfully.`);

      // If admin edited themselves, update the app session too
      if (
        currentUser.id === editingTeacher.id ||
        currentUser.email.toLowerCase() === editingTeacher.email.toLowerCase()
      ) {
        const updatedAccount: UserAccount = {
          ...currentUser,
          name: editName.trim(),
          email: editEmail.trim(),
          isAdmin: finalIsAdmin,
        };
        localStorage.setItem('allears_user', JSON.stringify(updatedAccount));
        if (onUserUpdated) onUserUpdated(updatedAccount);
      }

      setEditingTeacher(null);
      fetchTeachers();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('Backend update error, updating local state:', err);
      setStatusMessage(`Teacher profile "${editName}" updated locally.`);
      setEditingTeacher(null);
      fetchTeachers();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTeacher = async (teacher: TeacherItem) => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only administrators can delete teacher accounts.');
      return;
    }

    if (teacher.email.toLowerCase() === 'chuckacr1501@gmail.com') {
      alert('The primary administrator account (Chuck / chuckacr1501@gmail.com) cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke teacher authorization for "${teacher.name}" (${teacher.email})?`)) {
      return;
    }

    setDeletingId(teacher.id);
    setErrorMessage(null);

    // Update in localStorage
    try {
      const stored = localStorage.getItem('allears_authorized_teachers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (t: any) => t.id !== teacher.id && t.email.toLowerCase() !== teacher.email.toLowerCase()
          );
          localStorage.setItem('allears_authorized_teachers', JSON.stringify(filtered));
        }
      }
    } catch {}

    try {
      const res = await fetch(`/api/auth/teachers/${teacher.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Failed to delete teacher account.');
        setDeletingId(null);
        return;
      }

      setStatusMessage(`Teacher account "${teacher.name}" deleted.`);
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('Backend offline, deleting locally:', err);
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
      setStatusMessage(`Teacher account "${teacher.name}" removed from local storage.`);
    } finally {
      setDeletingId(null);
    }
  };

  // If non-admin teacher opens this dialog
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Admin Privileges Required</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed space-y-2">
            <p>
              Teachers cannot edit or manage the accounts of administrators or other teachers.
            </p>
            <p className="font-semibold text-slate-800">
              Only Head Administrator (such as <span className="font-mono text-amber-800">chuckacr1501@gmail.com</span>) can authorize, edit credentials, or delete teacher accounts.
            </p>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Shield className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Teacher & Admin Management</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  Administrator Deck
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Create, delete, and edit teacher accounts and credentials (Admin permission)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Authorize New Teacher Form */}
          <form onSubmit={handleAddTeacher} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>Authorize New Teacher</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Teacher Full Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Prof. Emily Watson"
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Email / Account ID</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="emily.watson@school.edu"
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Assigned Initial Password</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-semibold text-xs">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Grant Administrator Privileges</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Authorizing Teacher...' : 'Grant Teacher Authorization'}
            </button>
          </form>

          {/* Existing Teachers List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
              <span>Authorized Faculty ({teachers.length})</span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {teachers.map((t) => {
                const isCurrentSelf =
                  currentUser.id === t.id ||
                  currentUser.email.toLowerCase() === t.email.toLowerCase();
                const isPrimaryChuck = t.email.toLowerCase() === 'chuckacr1501@gmail.com';

                return (
                  <div
                    key={t.email}
                    className="p-3 flex items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs shrink-0">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                          <span className="truncate">{t.name}</span>
                          {isCurrentSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              You
                            </span>
                          )}
                          {t.isAdmin || isPrimaryChuck ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Admin
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              Teacher
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate flex items-center gap-2 mt-0.5">
                          <span>{t.email}</span>
                          {t.password && (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded border border-slate-150">
                              Pass: {t.password}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit Button: Admin can edit anyone including themselves */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(t)}
                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title={`Edit credentials for ${t.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button: Allowed unless primary Chuck */}
                      {!isPrimaryChuck ? (
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => handleDeleteTeacher(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={`Revoke authorization for ${t.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span
                          className="p-1.5 text-slate-300"
                          title="Primary administrator account cannot be deleted"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Admins can create, delete, and edit teacher and student information.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Edit Teacher Account ({editingTeacher.name})
                  </h4>
                  <p className="text-[11px] text-slate-500">Update username, display name, and password</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Teacher Display Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Email / Account ID</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Password</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-semibold">
                  <input
                    type="checkbox"
                    checked={editIsAdmin || editEmail.toLowerCase() === 'chuckacr1501@gmail.com'}
                    disabled={editEmail.toLowerCase() === 'chuckacr1501@gmail.com'}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Administrator Privileges</span>
                </label>
                {editEmail.toLowerCase() === 'chuckacr1501@gmail.com' && (
                  <p className="text-[10px] text-amber-800 mt-0.5">
                    chuckacr1501@gmail.com always retains administrator privileges.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Teacher Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
