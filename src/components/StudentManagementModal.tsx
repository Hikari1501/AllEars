import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Trash2,
  Check,
  AlertCircle,
  Shield,
  KeyRound,
  Mail,
  User,
  Pencil,
  School,
  Lock,
} from 'lucide-react';
import { UserAccount } from '../types';

interface StudentManagementModalProps {
  currentUser: UserAccount;
  onClose: () => void;
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
  password?: string;
  teacherId?: string;
  teacherName?: string;
  className?: string;
  createdAt?: string;
}

interface TeacherOption {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

export const StudentManagementModal: React.FC<StudentManagementModalProps> = ({
  currentUser,
  onClose,
}) => {
  const isAdmin = Boolean(
    currentUser.isAdmin || currentUser.email.toLowerCase() === 'chuckacr1501@gmail.com'
  );

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  // Create form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('student123');
  const [assignedTeacherId, setAssignedTeacherId] = useState<string>(currentUser.id);

  // Edit modal state
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-user-role': currentUser.role,
    'x-user-id': currentUser.id,
    'x-user-email': currentUser.email,
    'x-user-name': currentUser.name,
    'x-is-admin': String(isAdmin),
  };

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/auth/teachers', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.teachers && Array.isArray(data.teachers)) {
          setTeachers(data.teachers);
        }
      }
    } catch (e) {
      console.warn('Could not fetch teachers list:', e);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teacher/students', {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.students && Array.isArray(data.students)) {
          setStudents(data.students);
        }
      }
    } catch (e) {
      console.error('Failed to load students:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    if (isAdmin) {
      fetchTeachers();
    }
  }, [currentUser.id]);

  const canManageStudent = (stu: StudentItem): boolean => {
    if (isAdmin) return true;
    return Boolean(
      (stu.teacherId && stu.teacherId === currentUser.id) ||
      (stu.teacherId && stu.teacherId === currentUser.email)
    );
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please fill in student name, email/username, and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Determine target teacher
    const targetTeacher = teachers.find((t) => t.id === assignedTeacherId) || {
      id: currentUser.id,
      name: currentUser.name,
    };

    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          teacherId: isAdmin && assignedTeacherId ? targetTeacher.id : currentUser.id,
          teacherName: isAdmin && assignedTeacherId ? targetTeacher.name : currentUser.name,
          className: `${isAdmin && assignedTeacherId ? targetTeacher.name : currentUser.name}'s Class`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to create student account.');
        setIsSubmitting(false);
        return;
      }

      setStatusMessage(
        `Student "${name}" assigned to ${data.student.className || `${currentUser.name}'s Class`}! Password: ${password}`
      );
      setName('');
      setEmail('');
      setPassword('student123');
      fetchStudents();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error creating student account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (student: StudentItem) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEmail(student.email);
    setEditPassword(student.password || '');
    setEditTeacherId(student.teacherId || currentUser.id);
    setErrorMessage(null);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editName.trim() || !editEmail.trim() || !editPassword.trim()) {
      setErrorMessage('Name, username/email, and password are required.');
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    const targetTeacher = teachers.find((t) => t.id === editTeacherId);

    try {
      const res = await fetch(`/api/teacher/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          password: editPassword.trim(),
          ...(isAdmin && editTeacherId
            ? {
                teacherId: editTeacherId,
                teacherName: targetTeacher?.name || editingStudent.teacherName,
                className: targetTeacher ? `${targetTeacher.name}'s Class` : editingStudent.className,
              }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to update student account.');
        setIsUpdating(false);
        return;
      }

      setStatusMessage(`Student account "${editName}" updated successfully.`);
      setEditingStudent(null);
      fetchStudents();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error updating student account.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStudent = async (student: StudentItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete student account "${student.name}" (${student.email}) from ${student.className || "the class"}?`
      )
    ) {
      return;
    }

    setDeletingId(student.id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/teacher/students/${student.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        setStatusMessage(`Student account "${student.name}" deleted.`);
        setStudents((prev) => prev.filter((s) => s.id !== student.id));
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Failed to delete student.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error deleting student account.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter students if an admin chooses a specific class filter
  const displayedStudents = students.filter((stu) => {
    if (!isAdmin || selectedClassFilter === 'all') return true;
    return stu.teacherId === selectedClassFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isAdmin
                    ? 'Student Account Manager (Admin View)'
                    : `${currentUser.name}'s Class — Students`}
                </h3>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                    Class Teacher
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Manage and edit all student accounts, credentials, and class assignments across the school.'
                  : `Students created here belong to your class. Only you can edit their credentials or delete their accounts.`}
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

          {/* Create Student Form */}
          <form onSubmit={handleCreateStudent} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>Create Student Account</span>
              </h4>
              <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
                Assigned to: {isAdmin && assignedTeacherId !== currentUser.id
                  ? (teachers.find((t) => t.id === assignedTeacherId)?.name || 'Selected') + "'s Class"
                  : `${currentUser.name}'s Class`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Student Full Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya Chen"
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Email / Username</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maya.chen@school.edu"
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Assigned Password</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Assign to Teacher's Class</label>
                  <div className="relative">
                    <School className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={assignedTeacherId}
                      onChange={(e) => setAssignedTeacherId(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value={currentUser.id}>{currentUser.name} (Your Class)</option>
                      {teachers
                        .filter((t) => t.id !== currentUser.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}'s Class ({t.email})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Student Account...' : '+ Create Student Account for Class'}
            </button>
          </form>

          {/* Existing Students Roster */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span>
                  {isAdmin
                    ? `All Student Accounts (${displayedStudents.length})`
                    : `My Class Students (${displayedStudents.length})`}
                </span>
                {isLoading && <span className="text-[11px] text-slate-400 font-normal lowercase">refreshing...</span>}
              </div>

              {isAdmin && teachers.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs normal-case font-normal">
                  <span className="text-slate-400 text-[11px]">Filter class:</span>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="p-1 text-xs bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="all">All Classes</option>
                    <option value={currentUser.id}>{currentUser.name}'s Class (Mine)</option>
                    {teachers
                      .filter((t) => t.id !== currentUser.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}'s Class
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {displayedStudents.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
                <Users className="w-6 h-6 mx-auto text-slate-400" />
                <p>No student accounts in this class yet.</p>
                <p className="text-amber-700 font-semibold">
                  Use the form above to create student logins.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {displayedStudents.map((stu) => {
                  const hasPermission = canManageStudent(stu);

                  return (
                    <div
                      key={stu.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs shrink-0">
                          {stu.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                            <span className="truncate">{stu.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {stu.className || `${stu.teacherName || 'Chuck'}'s Class`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate flex items-center gap-2 mt-0.5">
                            <span>User: {stu.email}</span>
                            {stu.password && hasPermission && (
                              <span className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded border border-slate-150">
                                Pass: {stu.password}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasPermission ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(stu)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title={`Edit credentials for ${stu.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === stu.id}
                              onClick={() => handleDeleteStudent(stu)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={`Delete account for ${stu.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span
                            className="p-1 text-slate-300"
                            title="Only the teacher of this class or an administrator can edit/delete this student"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Self-registration is locked; only authorized class teachers and admins can create logins.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Edit Student Information</h4>
                  <p className="text-[11px] text-slate-500">Modify username, display name, and password</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Student Display Name</label>
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
                <label className="text-slate-700 block mb-1 font-semibold">Username / Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
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

              {isAdmin && teachers.length > 0 && (
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Assigned Class / Teacher</label>
                  <select
                    value={editTeacherId}
                    onChange={(e) => setEditTeacherId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value={currentUser.id}>{currentUser.name} (Your Class)</option>
                    {teachers
                      .filter((t) => t.id !== currentUser.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}'s Class ({t.email})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
