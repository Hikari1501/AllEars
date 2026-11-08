import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Trash2, Check, AlertCircle, Shield, KeyRound, Mail, User } from 'lucide-react';

interface StudentManagementModalProps {
  onClose: () => void;
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export const StudentManagementModal: React.FC<StudentManagementModalProps> = ({ onClose }) => {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('student123');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teacher/students');
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
  }, []);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please fill in student name, email/username, and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to create student account.');
        setIsSubmitting(false);
        return;
      }

      setStatusMessage(`Student account "${name}" created successfully! Password: ${password}`);
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

  const handleDeleteStudent = async (student: StudentItem) => {
    if (!window.confirm(`Are you sure you want to delete student account "${student.name}" (${student.email})?`)) {
      return;
    }

    setDeletingId(student.id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/teacher/students/${student.id}`, {
        method: 'DELETE',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Student Account Manager</h3>
              <p className="text-[11px] text-slate-500">
                Create and manage student logins for your classroom (Self-registration is disabled)
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>Create New Student Account</span>
            </h4>

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

            <div className="text-xs">
              <label className="text-slate-700 block mb-1 font-semibold">Assigned Initial Password</label>
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Account...' : '+ Create Student Account'}
            </button>
          </form>

          {/* Existing Students Roster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
              <span>Active Student Accounts ({students.length})</span>
              {isLoading && <span className="text-[11px] text-slate-400 font-normal">Refreshing...</span>}
            </div>

            {students.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
                <Users className="w-6 h-6 mx-auto text-slate-400" />
                <p>No student accounts created yet.</p>
                <p className="text-amber-700 font-semibold">Use the form above to add students for your class.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {students.map((stu) => (
                  <div
                    key={stu.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs shrink-0">
                        {stu.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{stu.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">{stu.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {stu.createdAt ? new Date(stu.createdAt).toLocaleDateString() : ''}
                      </span>
                      <button
                        type="button"
                        disabled={deletingId === stu.id}
                        onClick={() => handleDeleteStudent(stu)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={`Delete account for ${stu.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
