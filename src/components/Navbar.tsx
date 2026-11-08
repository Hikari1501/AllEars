import React from 'react';
import { UserAccount } from '../types';
import { Headphones, Radio, Shield, LogIn, LogOut, User, FileUp, Users } from 'lucide-react';

interface NavbarProps {
  currentTab: 'lessons' | 'live' | 'create' | 'reports';
  onSelectTab: (tab: 'lessons' | 'live' | 'create' | 'reports') => void;
  currentUser: UserAccount;
  onOpenTeacherLogin: () => void;
  onOpenTeacherManagement: () => void;
  onOpenStudentManagement?: () => void;
  onOpenStudentAuth: () => void;
  onSignOut: () => void;
  onOpenJoinModal: () => void;
  onOpenImportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenTeacherLogin,
  onOpenTeacherManagement,
  onOpenStudentManagement,
  onOpenStudentAuth,
  onSignOut,
  onOpenJoinModal,
  onOpenImportModal,
}) => {
  const isTeacher = currentUser.role === 'teacher';
  const isRegisteredStudent = currentUser.role === 'student' && currentUser.id !== 'student-guest';

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

          <button
            onClick={() => {
              if (!isTeacher && !isRegisteredStudent) {
                onOpenStudentAuth();
              } else {
                onSelectTab('create');
              }
            }}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentTab === 'create'
                ? 'text-amber-700 font-bold border-b-2 border-amber-600 pb-0.5'
                : 'hover:text-slate-900'
            }`}
          >
            {isTeacher ? 'Create Lesson' : 'Build Custom Lesson'}
          </button>

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
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Import a lesson dataset for self-study"
          >
            <FileUp className="w-3.5 h-3.5 text-amber-700" />
            <span>Import Lesson</span>
          </button>

          <button
            onClick={onOpenJoinModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Join with PIN</span>
          </button>

          {/* Teacher account pill */}
          {isTeacher && (
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

              {onOpenStudentManagement && (
                <button
                  onClick={onOpenStudentManagement}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Manage Student Accounts"
                >
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  <span>Students</span>
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
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Sign out of Teacher account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Registered Student account pill */}
          {isRegisteredStudent && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl text-xs">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-slate-800 truncate max-w-[110px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                  Student
                </span>
              </div>

              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Sign out of Student account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Guest visitors: Student Sign In & Teacher Sign In options */}
          {!isTeacher && !isRegisteredStudent && (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenStudentAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200"
                title="Sign in or register personal student account"
              >
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Student Sign In</span>
              </button>

              <button
                onClick={onOpenTeacherLogin}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                title="Sign in with Teacher credentials"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Teacher</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
