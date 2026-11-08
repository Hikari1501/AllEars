import React, { useState, useEffect, useMemo } from 'react';
import {
  UserAccount,
  Lesson,
  LessonSubmission,
  CEFRLevel,
} from './types';
import { INITIAL_LESSONS, INITIAL_SUBMISSIONS } from './data/mockLessons';
import { Navbar } from './components/Navbar';
import { HomeworkPlayer } from './components/HomeworkPlayer';
import { LiveClassroomTeacher } from './components/LiveClassroomTeacher';
import { LiveClassroomStudent } from './components/LiveClassroomStudent';
import { LessonEditor } from './components/LessonEditor';
import { ReportsView } from './components/ReportsView';
import { JoinModal } from './components/JoinModal';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { TeacherManagementModal } from './components/TeacherManagementModal';
import { StudentAccountModal } from './components/StudentAccountModal';
import { StudentManagementModal } from './components/StudentManagementModal';
import { LiveClassroomProjector } from './components/LiveClassroomProjector';
import { ImportLessonModal } from './components/ImportLessonModal';
import { ExportLessonModal } from './components/ExportLessonModal';
import heroImage from './assets/images/allears_hero_listening_1793672977345.jpg';
import {
  Play,
  Radio,
  BookOpen,
  Plus,
  BarChart3,
  Search,
  Clock,
  HelpCircle,
  ShieldAlert,
  Headphones,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Lock,
  Globe,
  EyeOff,
  Trash2,
  Download,
  FileUp,
  CheckCircle2,
  Shield,
} from 'lucide-react';

const extractYouTubeId = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match && match[1] ? match[1] : null;
};

const sanitizeLessons = (list: Lesson[]): Lesson[] => {
  return list.map((l) => {
    const isObsoleteThumb = !l.thumbnailUrl || l.thumbnailUrl.startsWith('/src/assets/images/');
    if (isObsoleteThumb) {
      const ytId = extractYouTubeId(l.mediaUrl);
      if (ytId) {
        return { ...l, thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` };
      }
    }
    return l;
  });
};

export default function App() {
  // Default user is always Student per user request
  const defaultStudentUser: UserAccount = {
    id: 'student-guest',
    name: 'Guest Student',
    role: 'student',
    email: 'student@allears.edu',
  };

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('allears_user');
      return saved ? JSON.parse(saved) : defaultStudentUser;
    } catch {
      return defaultStudentUser;
    }
  });

  // Central lessons from server / PostgreSQL database
  const [serverLessons, setServerLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem('allears_lessons_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sanitizeLessons(parsed);
      }
      return sanitizeLessons(INITIAL_LESSONS);
    } catch {
      return sanitizeLessons(INITIAL_LESSONS);
    }
  });

  // Private lessons imported by a student on this device only (never uploaded or shared)
  const [studentLocalLessons, setStudentLocalLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem('allears_student_local_lessons');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? sanitizeLessons(parsed) : [];
    } catch {
      return [];
    }
  });

  // Active lessons:
  // - Teachers see ONLY central server lessons from database (teachers do not see students' private device imports)
  // - Students see central published lessons + their private self-study imports on this device
  const lessons = useMemo(() => {
    if (currentUser.role === 'teacher') {
      return serverLessons;
    }
    const localIds = new Set(studentLocalLessons.map((l) => l.id));
    const nonDuplicatedServer = serverLessons.filter((l) => !localIds.has(l.id));
    return [...studentLocalLessons, ...nonDuplicatedServer];
  }, [currentUser.role, serverLessons, studentLocalLessons]);

  const [submissions, setSubmissions] = useState<LessonSubmission[]>(() => {
    try {
      const saved = localStorage.getItem('allears_submissions_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_SUBMISSIONS;
    } catch {
      return INITIAL_SUBMISSIONS;
    }
  });

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<'lessons' | 'live' | 'create' | 'reports'>('lessons');

  // Active Modes
  const [activeHomeworkLesson, setActiveHomeworkLesson] = useState<Lesson | null>(null);
  const [activeLiveTeacher, setActiveLiveTeacher] = useState<{ lesson: Lesson; pin: string } | null>(null);
  const [activeLiveStudent, setActiveLiveStudent] = useState<{
    lesson: Lesson;
    pin: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [reportsLessonId, setReportsLessonId] = useState<string>(lessons[0]?.id || '');

  // Modals
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [isTeacherManagementOpen, setIsTeacherManagementOpen] = useState(false);
  const [isStudentManagementOpen, setIsStudentManagementOpen] = useState(false);
  const [isStudentAccountOpen, setIsStudentAccountOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportingLesson, setExportingLesson] = useState<Lesson | null>(null);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  const handlePracticeRandomLesson = () => {
    const pool = lessons.filter((l) => currentUser.role === 'teacher' || l.isPublished !== false);
    if (pool.length === 0) return;
    const randomIndex = Math.floor(Math.random() * pool.length);
    setActiveHomeworkLesson(pool[randomIndex]);
  };

  // Standalone Screen Share / Projector Tab Mode
  const projectorPin = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('projector');
    } catch {
      return null;
    }
  }, []);

  // Handle lesson dataset import
  const handleImportLesson = async (imported: Lesson, practiceImmediately: boolean) => {
    if (currentUser.role === 'teacher') {
      // Teacher import: Persist to PostgreSQL database for all students
      const teacherLesson: Lesson = {
        ...imported,
        isPublished: true,
        isLocalStudentOnly: false,
        teacherId: currentUser.id,
        teacherName: currentUser.name,
      };

      try {
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'teacher',
            'x-teacher-id': currentUser.id,
          },
          body: JSON.stringify(teacherLesson),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Server lesson save notice:', errData.error || res.statusText);
        }
      } catch (e) {
        console.warn('Failed to save imported lesson to server:', e);
      }

      setServerLessons((prev) => {
        const idx = prev.findIndex((l) => l.id === teacherLesson.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = teacherLesson;
          return copy;
        }
        return [teacherLesson, ...prev];
      });

      setImportNotification(`Successfully added "${teacherLesson.title}" to the central curriculum!`);
    } else {
      // Student import: Persist to their private student account in the database (or local storage for guest)
      const isRegistered = currentUser.role === 'student' && currentUser.id !== 'student-guest';
      const studentOnlyLesson: Lesson = {
        ...imported,
        isPublished: true,
        isLocalStudentOnly: true,
        teacherName: imported.teacherName || `${currentUser.name}'s Custom Study`,
      };

      if (isRegistered) {
        try {
          await fetch('/api/student-lessons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-student-id': currentUser.id,
            },
            body: JSON.stringify({
              studentId: currentUser.id,
              lesson: studentOnlyLesson,
            }),
          });
        } catch (e) {
          console.warn('Could not save to student account database:', e);
        }
      }

      setStudentLocalLessons((prev) => {
        const filtered = prev.filter((l) => l.id !== studentOnlyLesson.id);
        const updated = [studentOnlyLesson, ...filtered];
        localStorage.setItem('allears_student_local_lessons', JSON.stringify(updated));
        return updated;
      });

      setImportNotification(
        isRegistered
          ? `Imported "${studentOnlyLesson.title}" to your private student account!`
          : `Imported "${studentOnlyLesson.title}" for self-study on this device!`
      );
    }

    setTimeout(() => setImportNotification(null), 4500);

    if (practiceImmediately) {
      setActiveHomeworkLesson(imported);
    }
  };

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Persist user
  useEffect(() => {
    localStorage.setItem('allears_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Persist server lessons locally
  useEffect(() => {
    localStorage.setItem('allears_lessons_v3', JSON.stringify(serverLessons));
  }, [serverLessons]);

  // Persist student private lessons locally
  useEffect(() => {
    localStorage.setItem('allears_student_local_lessons', JSON.stringify(studentLocalLessons));
  }, [studentLocalLessons]);

  // Sync lessons with backend server so all visitors can see published lessons
  useEffect(() => {
    let isMounted = true;
    const fetchServerLessons = async () => {
      try {
        const res = await fetch(`/api/lessons?role=${currentUser.role}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.lessons && Array.isArray(data.lessons)) {
            setServerLessons(sanitizeLessons(data.lessons));
          }
        }
      } catch (e) {
        console.warn('Could not sync with server lessons:', e);
      }
    };
    fetchServerLessons();
    const interval = setInterval(fetchServerLessons, 6000);
    window.addEventListener('focus', fetchServerLessons);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', fetchServerLessons);
    };
  }, [currentUser.role]);

  // Persist submissions
  useEffect(() => {
    localStorage.setItem('allears_submissions_v3', JSON.stringify(submissions));
  }, [submissions]);

  // Sync student private lessons from database whenever a registered student is active
  useEffect(() => {
    if (currentUser.role === 'student' && currentUser.id !== 'student-guest') {
      const fetchStudentLessons = async () => {
        try {
          const res = await fetch(`/api/student-lessons?studentId=${currentUser.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.lessons && Array.isArray(data.lessons)) {
              setStudentLocalLessons(sanitizeLessons(data.lessons));
            }
          }
        } catch (e) {
          console.warn('Could not sync student private lessons:', e);
        }
      };
      fetchStudentLessons();
    }
  }, [currentUser.id, currentUser.role]);

  // Handle successful teacher login
  const handleTeacherLoginSuccess = (teacherUser: UserAccount) => {
    setCurrentUser(teacherUser);
  };

  // Handle successful student login / registration
  const handleStudentLoginSuccess = async (studentUser: UserAccount) => {
    setCurrentUser(studentUser);
    try {
      const res = await fetch(`/api/student-lessons?studentId=${studentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lessons && Array.isArray(data.lessons)) {
          setStudentLocalLessons(sanitizeLessons(data.lessons));
        }
      }
    } catch (e) {
      console.warn('Could not sync student private lessons on login:', e);
    }
  };

  // Sign out back to Student Guest
  const handleSignOut = () => {
    setCurrentUser(defaultStudentUser);
    if (currentTab === 'create') {
      setCurrentTab('lessons');
    }
    setActiveLiveTeacher(null);
  };

  // Launch live session as teacher
  const handleStartLiveAsTeacher = async (lesson: Lesson) => {
    if (currentUser.role !== 'teacher') {
      setIsTeacherLoginOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          teacherId: currentUser.id,
          teacherName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setActiveLiveTeacher({ lesson, pin: data.session.pin });
      }
    } catch (e) {
      console.error(e);
      alert('Failed to launch live classroom. Please try again.');
    }
  };

  // Student joins live classroom
  const handleJoinLiveAsStudent = async (pin: string, studentName: string) => {
    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          studentId: currentUser.id,
          studentName: studentName || currentUser.name,
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        const foundLesson =
          lessons.find((l) => l.id === data.session.lessonId) || lessons[0];
        setActiveLiveStudent({
          lesson: foundLesson,
          pin,
          studentId: data.studentId,
          studentName: studentName || currentUser.name,
        });
        setIsJoinModalOpen(false);
      } else {
        alert('Could not join room. Please check the PIN.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error connecting to live session.');
    }
  };

  // Student finishes homework
  const handleFinishHomework = async (submission: LessonSubmission) => {
    setSubmissions((prev) => [submission, ...prev]);
    try {
      await fetch('/api/reports/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission }),
      });
    } catch (e) {
      console.warn('Could not post homework report to server:', e);
    }
    setActiveHomeworkLesson(null);
    setReportsLessonId(submission.lessonId);
    setCurrentTab('reports');
  };

  // Save lesson from editor:
  // - Teachers save to central library / PostgreSQL database for all students
  // - Students save privately to their student account in the database (or device storage for guest)
  const handleSaveLesson = async (savedLesson: Lesson) => {
    if (currentUser.role === 'teacher') {
      try {
        const res = await fetch('/api/lessons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'teacher',
            'x-teacher-id': currentUser.id,
          },
          body: JSON.stringify(savedLesson),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Save notice:', errData.error || res.statusText);
        } else {
          setImportNotification(`Successfully published "${savedLesson.title}" to the curriculum!`);
          setTimeout(() => setImportNotification(null), 3500);
        }
      } catch (e) {
        console.warn('Failed to save lesson to server:', e);
      }

      setServerLessons((prev) => {
        const idx = prev.findIndex((l) => l.id === savedLesson.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = savedLesson;
          return copy;
        }
        return [savedLesson, ...prev];
      });
    } else {
      // Student creating or editing their private lesson
      const isRegistered = currentUser.role === 'student' && currentUser.id !== 'student-guest';
      const studentLesson: Lesson = {
        ...savedLesson,
        isLocalStudentOnly: true,
        teacherId: currentUser.id,
        teacherName: currentUser.name,
      };

      if (isRegistered) {
        try {
          await fetch('/api/student-lessons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-student-id': currentUser.id,
            },
            body: JSON.stringify({
              studentId: currentUser.id,
              lesson: studentLesson,
            }),
          });
        } catch (e) {
          console.warn('Failed to save student lesson to server database:', e);
        }
      }

      setStudentLocalLessons((prev) => {
        const idx = prev.findIndex((l) => l.id === studentLesson.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = studentLesson;
          return copy;
        }
        return [studentLesson, ...prev];
      });

      setImportNotification(
        isRegistered
          ? `Saved "${studentLesson.title}" to your private student account!`
          : `Saved "${studentLesson.title}" for self-study on this device!`
      );
      setTimeout(() => setImportNotification(null), 4000);
    }

    setEditingLesson(null);
    setCurrentTab('lessons');
  };

  // Delete a lesson (Teachers delete central lessons; Students remove their account/device lessons)
  const handleDeleteLesson = async (lessonId: string) => {
    // If student removing their personal lesson
    if (currentUser.role === 'student') {
      const isRegistered = currentUser.id !== 'student-guest';
      if (isRegistered) {
        try {
          await fetch(`/api/student-lessons/${lessonId}?studentId=${currentUser.id}`, {
            method: 'DELETE',
            headers: {
              'x-student-id': currentUser.id,
            },
          });
        } catch (e) {
          console.warn('Failed to delete student lesson from database:', e);
        }
      }

      setStudentLocalLessons((prev) => {
        const updated = prev.filter((l) => l.id !== lessonId);
        localStorage.setItem('allears_student_local_lessons', JSON.stringify(updated));
        return updated;
      });
      setImportNotification('Removed self-study lesson.');
      setTimeout(() => setImportNotification(null), 3000);
      return;
    }

    // Teacher deleting central lesson from database
    try {
      await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': 'teacher',
          'x-teacher-id': currentUser.id,
        },
      });
    } catch (e) {
      console.warn(e);
    }
    setServerLessons((prev) => prev.filter((l) => l.id !== lessonId));
    setEditingLesson(null);
    setCurrentTab('lessons');
  };

  // Toggle publish / unpublish status (Teachers Only)
  const handleTogglePublish = async (lessonId: string, currentStatus: boolean) => {
    if (currentUser.role !== 'teacher') return;
    const nextStatus = !currentStatus;
    try {
      await fetch(`/api/lessons/${lessonId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'teacher',
          'x-teacher-id': currentUser.id,
        },
        body: JSON.stringify({ isPublished: nextStatus }),
      });
    } catch (e) {
      console.warn(e);
    }

    setServerLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, isPublished: nextStatus } : l))
    );
  };

  const isTeacher = currentUser.role === 'teacher';
  const isRegisteredStudent = currentUser.role === 'student' && currentUser.id !== 'student-guest';

  // Standalone Screen Share / Projector View for Google Meet or Zoom
  if (projectorPin) {
    const projectorLesson =
      lessons.find((l) => l.id) || INITIAL_LESSONS[0];
    return (
      <LiveClassroomProjector
        lesson={projectorLesson}
        allLessons={lessons}
        pin={projectorPin}
        onExit={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  // Filter lessons (Students see published lessons + their own account/device lessons; teachers see all)
  const filteredLessons = lessons.filter((l) => {
    if (!isTeacher && !l.isLocalStudentOnly && l.isPublished === false) return false;
    const matchesLevel = levelFilter === 'all' || l.level === levelFilter;
    const matchesSearch =
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const currentReportLesson =
    lessons.find((l) => l.id === reportsLessonId) || lessons[0] || INITIAL_LESSONS[0];

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#0F172A] flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setActiveHomeworkLesson(null);
          setActiveLiveTeacher(null);
          setActiveLiveStudent(null);
          setEditingLesson(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onOpenTeacherLogin={() => setIsTeacherLoginOpen(true)}
        onOpenTeacherManagement={() => setIsTeacherManagementOpen(true)}
        onOpenStudentManagement={() => setIsStudentManagementOpen(true)}
        onOpenStudentAuth={() => setIsStudentAccountOpen(true)}
        onSignOut={handleSignOut}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* 1. Live Classroom (Teacher Mode) */}
        {activeLiveTeacher && (
          <LiveClassroomTeacher
            lesson={activeLiveTeacher.lesson}
            pin={activeLiveTeacher.pin}
            onExit={() => {
              setReportsLessonId(activeLiveTeacher.lesson.id);
              setActiveLiveTeacher(null);
              setCurrentTab('reports');
            }}
          />
        )}

        {/* 2. Live Classroom (Student Mode) */}
        {activeLiveStudent && (
          <LiveClassroomStudent
            lesson={activeLiveStudent.lesson}
            pin={activeLiveStudent.pin}
            studentId={activeLiveStudent.studentId}
            studentName={activeLiveStudent.studentName}
            onExit={() => {
              setReportsLessonId(activeLiveStudent.lesson.id);
              setActiveLiveStudent(null);
              setCurrentTab('reports');
            }}
          />
        )}

        {/* 3. Self-Paced Homework Player */}
        {activeHomeworkLesson && (
          <HomeworkPlayer
            lesson={activeHomeworkLesson}
            studentId={currentUser.id}
            studentName={currentUser.name}
            onFinish={handleFinishHomework}
            onBack={() => setActiveHomeworkLesson(null)}
          />
        )}

        {/* 4. Lesson Editor (Teachers & Registered Students) */}
        {(currentTab === 'create' || editingLesson) && !activeLiveTeacher && !activeLiveStudent && !activeHomeworkLesson && (
          (isTeacher || isRegisteredStudent) ? (
            <LessonEditor
              initialLesson={editingLesson}
              onSave={handleSaveLesson}
              onCancel={() => {
                setEditingLesson(null);
                setCurrentTab('lessons');
              }}
              onDelete={handleDeleteLesson}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Sign In to Build Lessons</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Create custom listening comprehension lessons and save them privately to your personal student account or teacher curriculum.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setIsStudentAccountOpen(true)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-xs"
                >
                  Student Sign In / Create Account
                </button>
                <button
                  onClick={() => setIsTeacherLoginOpen(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Teacher Portal Sign In
                </button>
              </div>
            </div>
          )
        )}

        {/* 5. Reports & Analytics View */}
        {currentTab === 'reports' && !activeLiveTeacher && !activeLiveStudent && !activeHomeworkLesson && !editingLesson && (
          <ReportsView
            lesson={currentReportLesson}
            submissions={submissions}
            currentRole={currentUser.role}
            currentStudentId={currentUser.id}
            onSelectLesson={(id) => setReportsLessonId(id)}
            allLessons={lessons}
          />
        )}

        {/* 6. Live Classroom Hub View */}
        {currentTab === 'live' && !activeLiveTeacher && !activeLiveStudent && !activeHomeworkLesson && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Live Synchronized Classroom
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                Control video and audio simultaneously across all student devices. Automatic question pauses, live response distribution, and instant feedback.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Student Join Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Radio className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Student: Join Live Class</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Have a 6-digit room PIN from your teacher? Join now to follow playback and answer listening questions in real time.
                  </p>
                </div>
                <button
                  onClick={() => setIsJoinModalOpen(true)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs tracking-wide transition-colors cursor-pointer shadow-xs"
                >
                  Enter Room PIN
                </button>
              </div>

              {/* Teacher Host Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Teacher: Host a Live Lesson</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {isTeacher
                      ? 'Select any lesson from your curriculum to launch an interactive live session with synchronized playback and simulated student testing.'
                      : 'Teacher sign in required to host live broadcast sessions.'}
                  </p>
                </div>
                {isTeacher ? (
                  <button
                    onClick={() => handleStartLiveAsTeacher(lessons[0])}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs tracking-wide transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                  >
                    <span>Launch Live Lesson with "{lessons[0]?.title}"</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsTeacherLoginOpen(true)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Teacher Sign In to Host</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. Lessons Catalog View (Default Homepage) */}
        {currentTab === 'lessons' && !activeHomeworkLesson && !activeLiveTeacher && !activeLiveStudent && !editingLesson && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
            {/* Import Notification Banner */}
            {importNotification && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{importNotification}</span>
                </div>
                <button
                  onClick={() => setImportNotification(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Hero Banner Section */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wide uppercase">
                    <Headphones className="w-4 h-4" />
                    <span>English Listening & Formative Assessment</span>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                    Active listening, authentic speech, and instant comprehension checks.
                  </h1>

                  <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                    All Ears bridges YouTube ESL videos, podcast audio, and custom recordings with auto-pausing formative assessments, synchronized live classroom broadcasts, and clickable Cambridge-linked CEFR vocabulary glossaries.
                  </p>

                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                      onClick={handlePracticeRandomLesson}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs tracking-wide transition-all shadow-md cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Practice Random Lesson</span>
                    </button>

                    {isTeacher ? (
                      <button
                        onClick={() => setCurrentTab('create')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs tracking-wide transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create New Lesson</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsTeacherLoginOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs tracking-wide transition-colors cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Teacher Portal Sign In</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full">
                  <img
                    src={heroImage}
                    alt="Student with headphones listening to English lesson"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80';
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent" />
                </div>
              </div>
            </div>

            {/* Controls Bar: Search, Level Filter Tabs & Import Button */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
                {['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      levelFilter === lvl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'all' ? 'All Levels' : lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Import a lesson dataset package for self-study"
                >
                  <FileUp className="w-3.5 h-3.5 text-amber-600" />
                  <span>Import Lesson</span>
                </button>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search listening lessons..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Lesson Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLessons.map((lesson) => {
                const isLessonPublished = lesson.isPublished !== false;

                return (
                  <div
                    key={lesson.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Media Thumbnail */}
                      <div className="relative aspect-video bg-slate-900 overflow-hidden">
                        {lesson.thumbnailUrl || extractYouTubeId(lesson.mediaUrl) ? (
                          <img
                            src={
                              lesson.thumbnailUrl && !lesson.thumbnailUrl.startsWith('/src/assets/images/')
                                ? lesson.thumbnailUrl
                                : (extractYouTubeId(lesson.mediaUrl)
                                  ? `https://img.youtube.com/vi/${extractYouTubeId(lesson.mediaUrl)}/hqdefault.jpg`
                                  : '')
                            }
                            alt={lesson.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const ytId = extractYouTubeId(lesson.mediaUrl);
                              if (ytId) {
                                const fallback = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                  return;
                                }
                              }
                            }}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Headphones className="w-10 h-10" />
                          </div>
                        )}

                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-xs text-[11px] font-mono font-bold text-amber-400 border border-slate-800">
                          {lesson.level}
                        </div>

                        {/* Published / Draft indicator for teachers */}
                        {isTeacher && (
                          <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLessonPublished ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-slate-950'
                          }`}>
                            {isLessonPublished ? 'Published' : 'Draft'}
                          </div>
                        )}

                        {/* Private Device Only indicator for student personal imports */}
                        {!isTeacher && lesson.isLocalStudentOnly && (
                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/95 text-slate-950 flex items-center gap-1 shadow-xs">
                            <Shield className="w-3 h-3" />
                            <span>My Device Only</span>
                          </div>
                        )}

                        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 text-[11px] font-mono text-white">
                          {Math.floor((lesson.trimEnd || lesson.duration) / 60)}:{((lesson.trimEnd || lesson.duration) % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{lesson.mediaType === 'youtube' ? 'YouTube' : lesson.mediaType}</span>
                          <span aria-hidden="true">·</span>
                          <span>{lesson.questions.length} Checkpoints</span>
                          <span aria-hidden="true">·</span>
                          <span>{lesson.difficultWords.length} Vocab Words</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {lesson.title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {lesson.description}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-5 pt-0 border-t border-slate-100 space-y-2 mt-2">
                      {isTeacher ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 w-full">
                            <button
                              onClick={() => handleStartLiveAsTeacher(lesson)}
                              className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Radio className="w-3.5 h-3.5" />
                              <span>Live Class</span>
                            </button>

                            <button
                              onClick={() => setActiveHomeworkLesson(lesson)}
                              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                              title="Preview as Student"
                            >
                              Preview
                            </button>

                            <button
                              onClick={() => {
                                setEditingLesson(lesson);
                                setCurrentTab('create');
                              }}
                              className="py-2 px-2.5 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                              title="Edit Lesson"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => setExportingLesson(lesson)}
                              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Export dataset to send to students"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                              <span>Export</span>
                            </button>
                          </div>

                          {/* Teacher controls: Publish / Unpublish and Delete */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleTogglePublish(lesson.id, isLessonPublished)}
                              className={`flex items-center gap-1 text-[11px] font-semibold ${
                                isLessonPublished ? 'text-amber-700 hover:text-amber-800' : 'text-emerald-700 hover:text-emerald-800'
                              }`}
                            >
                              {isLessonPublished ? <EyeOff className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                              <span>{isLessonPublished ? 'Unpublish to Draft' : 'Publish to Students'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete "${lesson.title}"?`)) {
                                  handleDeleteLesson(lesson.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 text-[11px]"
                              title="Delete lesson"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 w-full flex-wrap">
                            <button
                              onClick={() => setActiveHomeworkLesson(lesson)}
                              className="flex-1 min-w-[130px] py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Practice Homework</span>
                            </button>

                            <button
                              onClick={() => {
                                setReportsLessonId(lesson.id);
                                setCurrentTab('reports');
                              }}
                              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                              title="View My Report"
                            >
                              Report
                            </button>

                            {lesson.isLocalStudentOnly && (
                              <button
                                onClick={() => {
                                  setEditingLesson(lesson);
                                  setCurrentTab('create');
                                }}
                                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                                title="Edit My Custom Lesson"
                              >
                                Edit
                              </button>
                            )}

                            <button
                              onClick={() => setExportingLesson(lesson)}
                              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                              title="Export this lesson dataset"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Export</span>
                            </button>

                            {lesson.isLocalStudentOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove personal lesson "${lesson.title}"?`)) {
                                    handleDeleteLesson(lesson.id);
                                  }
                                }}
                                className="py-2.5 px-2.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                title="Remove personal self-study lesson"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {lesson.isLocalStudentOnly && (
                            <p className="text-[10px] text-amber-700/90 font-medium text-center">
                              {isRegisteredStudent ? 'Private to your student account (not shared with others)' : 'Private to this device (not shared with others)'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Join Live Room Modal */}
      {isJoinModalOpen && (
        <JoinModal
          onClose={() => setIsJoinModalOpen(false)}
          onJoin={handleJoinLiveAsStudent}
          defaultStudentName={currentUser.name}
        />
      )}

      {/* Student Account Modal (Register & Login) */}
      <StudentAccountModal
        isOpen={isStudentAccountOpen}
        onClose={() => setIsStudentAccountOpen(false)}
        onSuccess={handleStudentLoginSuccess}
      />

      {/* Teacher Login Modal */}
      {isTeacherLoginOpen && (
        <TeacherLoginModal
          onClose={() => setIsTeacherLoginOpen(false)}
          onSuccess={handleTeacherLoginSuccess}
        />
      )}

      {/* Teacher Permission Management Modal */}
      {isTeacherManagementOpen && (
        <TeacherManagementModal
          onClose={() => setIsTeacherManagementOpen(false)}
        />
      )}

      {/* Student Account Management Modal for Teachers */}
      {isStudentManagementOpen && (
        <StudentManagementModal
          onClose={() => setIsStudentManagementOpen(false)}
        />
      )}

      {/* Import Lesson Modal */}
      <ImportLessonModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportLesson}
        existingLessonIds={lessons.map((l) => l.id)}
        isTeacher={isTeacher}
      />

      {/* Export Lesson Modal */}
      {exportingLesson && (
        <ExportLessonModal
          lesson={exportingLesson}
          onClose={() => setExportingLesson(null)}
        />
      )}
    </div>
  );
}
