import React from 'react';
import { UserAccount } from '../types';
import { Headphones, Radio, Shield, LogIn, LogOut, User } from 'lucide-react';

interface NavbarProps {
  currentTab: 'lessons' | 'live' | 'create' | 'reports';
  onSelectTab: (tab: 'lessons' | 'live' | 'create' | 'reports') => void;
  currentUser: UserAccount;
  onOpenTeacherLogin: () => void;
  onOpenTeacherManagement: () => void;
  onSignOut: () => void;
  onOpenJoinModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenTeacherLogin,
  onOpenTeacherManagement,
  onSignOut,
  onOpenJoinModal,
}) => {
  const isTeacher = currentUser.role === 'teacher';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Brand Wordmark (Single element) */}
        <button
          onClick={() => onSelectTab('lessons')}
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
            <Headphones className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight text-slate-900">
            All Ears
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={() => onSelectTab('lessons')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentTab === 'lessons'
                ? 'text-amber-700 font-bold border-b-2 border-amber-600 pb-0.5'
                : 'hover:text-slate-900'
            }`}
          >
            Lessons
          </button>

          <button
            onClick={() => onSelectTab('live')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentTab === 'live'
                ? 'text-amber-700 font-bold border-b-2 border-amber-600 pb-0.5'
                : 'hover:text-slate-900'
            }`}
          >
            Live Classroom
          </button>

          {isTeacher && (
            <button
              onClick={() => onSelectTab('create')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                currentTab === 'create'
                  ? 'text-amber-700 font-bold border-b-2 border-amber-600 pb-0.5'
                  : 'hover:text-slate-900'
              }`}
            >
              Create Lesson
            </button>
          )}

          <button
            onClick={() => onSelectTab('reports')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentTab === 'reports'
                ? 'text-amber-700 font-bold border-b-2 border-amber-600 pb-0.5'
                : 'hover:text-slate-900'
            }`}
          >
            {isTeacher ? 'Analytics' : 'My Reports'}
          </button>
        </nav>

        {/* Zone 3: Primary Action & Authentication / Role Control */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenJoinModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Join with PIN</span>
          </button>

          {/* Teacher account pill vs Sign In button */}
          {isTeacher ? (
            <div className="flex items-center gap-2">
              {currentUser.isAdmin && (
                <button
                  onClick={onOpenTeacherManagement}
                  className="p-1.5 text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Manage Authorized Teachers"
                >
                  <Shield className="w-4 h-4 text-amber-600" />
                </button>
              )}

              <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-slate-800 truncate max-w-[100px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-amber-800 font-semibold uppercase">
                  Teacher
                </span>
              </div>

              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                title="Sign out of Teacher account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTeacherLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span>Teacher Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
