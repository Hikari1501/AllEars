import React, { useState } from 'react';
import { X, Radio, ArrowRight, AlertCircle } from 'lucide-react';

interface JoinModalProps {
  onClose: () => void;
  onJoin: (pin: string, studentName: string) => void;
  initialPin?: string;
  defaultStudentName?: string;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  onClose,
  onJoin,
  initialPin = '',
  defaultStudentName = 'Guest Student',
}) => {
  const [pin, setPin] = useState(initialPin);
  const [studentName, setStudentName] = useState(defaultStudentName);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter a 6-digit room PIN.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/live/session/${pin.trim()}`);
      if (!res.ok) {
        setError('Room not found. Check the PIN with your teacher.');
        setIsLoading(false);
        return;
      }
      onJoin(pin.trim(), studentName.trim() || 'Student');
    } catch (err) {
      setError('Could not connect to live room. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Join Live Classroom</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">6-Digit Room PIN</label>
            <input
              type="text"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 849201"
              autoFocus
              className="w-full p-3 text-center text-2xl font-mono font-bold tracking-widest bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Your Name (for teacher's roster)</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden"
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
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span>{isLoading ? 'Connecting...' : 'Enter Classroom'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500">
          No student account needed. Ask your teacher for the 6-digit session PIN.
        </p>
      </div>
    </div>
  );
};
