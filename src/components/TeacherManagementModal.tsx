import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Check, Users, AlertCircle } from 'lucide-react';

interface TeacherManagementModalProps {
  onClose: () => void;
}

export const TeacherManagementModal: React.FC<TeacherManagementModalProps> = ({
  onClose,
}) => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('welcome123');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/auth/teachers');
      const data = await res.json();
      if (data.teachers) {
        setTeachers(data.teachers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/add-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(`Teacher "${newName}" authorized successfully!`);
        setNewName('');
        setNewEmail('');
        setNewPassword('welcome123');
        fetchTeachers();
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Teacher Permission Manager</h3>
              <p className="text-[11px] text-slate-500">Managed by Chuck (Head Administrator)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Add New Teacher Form */}
        <form onSubmit={handleAddTeacher} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-amber-600" />
            <span>Authorize New Teacher</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-600 block mb-1">Teacher Full Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Prof. Emily Watson"
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Email / Account ID</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="emily.watson@school.edu"
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-slate-600 block mb-1">Assigned Password</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Authorizing...' : 'Grant Teacher Permission'}
          </button>
        </form>

        {/* Existing Teachers List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Authorized Teachers ({teachers.length})</span>
          </div>

          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {teachers.map((t) => (
              <div key={t.email} className="p-2.5 flex items-center justify-between text-xs bg-white">
                <div>
                  <div className="font-bold text-slate-800">{t.name}</div>
                  <div className="text-[11px] text-slate-500">{t.email}</div>
                </div>
                {t.isAdmin ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Administrator
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    Teacher
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
