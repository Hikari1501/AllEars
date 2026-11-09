import React, { useState } from 'react';
import { X, Lock, Key, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { UserAccount } from '../types';

interface TeacherLoginModalProps {
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const normUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check credentials locally (essential for static deployments like GitHub Pages or offline)
    const checkClientAuth = (): UserAccount | null => {
      // 1. Primary Teacher / Admin Account
      if (
        (normUser === 'chuck' || normUser === 'chuckacr1501@gmail.com') &&
        cleanPass === 'password123'
      ) {
        return {
          id: 'teacher-chuck',
          name: 'Chuck',
          email: 'ChuckACR1501@gmail.com',
          role: 'teacher',
          isAdmin: true,
        };
      }

      // 2. Any additional authorized teachers saved in localStorage
      try {
        const stored = localStorage.getItem('allears_authorized_teachers');
        if (stored) {
          const teachers = JSON.parse(stored);
          if (Array.isArray(teachers)) {
            const found = teachers.find(
              (t: any) =>
                (t.email?.toLowerCase() === normUser || t.name?.toLowerCase() === normUser) &&
                t.password === cleanPass
            );
            if (found) {
              return {
                id: found.id || `teacher-${Date.now()}`,
                name: found.name,
                email: found.email,
                role: 'teacher',
                isAdmin: found.email?.toLowerCase() === 'chuckacr1501@gmail.com' ? true : !!found.isAdmin,
              };
            }
          }
        }
      } catch {}

      return null;
    };

    try {
      const res = await fetch('/api/auth/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normUser, password: cleanPass }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.user) {
          onSuccess(data.user);
          onClose();
          return;
        } else if (res.status === 401 || res.status === 400) {
          // Explicit credential rejection from backend
          setError(data.error || 'Invalid teacher account name or password.');
          return;
        }
      }

      // If backend returned non-JSON (e.g. 404 HTML on static GitHub Pages)
      const localUser = checkClientAuth();
      if (localUser) {
        onSuccess(localUser);
        onClose();
      } else {
        setError('Invalid teacher account name or password.');
      }
    } catch {
      // Network failure or static environment without /api backend
      const localUser = checkClientAuth();
      if (localUser) {
        onSuccess(localUser);
        onClose();
      } else {
        setError('Invalid teacher account name or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Lock className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Teacher Sign In</h3>
              <p className="text-[11px] text-slate-500">Authorized instructor portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Account Name or Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or Email"
              required
              className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden font-mono"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs tracking-wide transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Sign In as Teacher'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500 leading-relaxed">
          Authorized instructor portal. Students do not need an account.
        </p>
      </div>
    </div>
  );
};
