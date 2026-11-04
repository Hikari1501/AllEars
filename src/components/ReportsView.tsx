import React, { useState, useEffect } from 'react';
import { Lesson, LessonSubmission, UserRole, SessionReport } from '../types';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  User,
  ArrowRight,
  TrendingUp,
  Award,
  Radio,
  Calendar,
  Clock,
  Trash2,
  ChevronDown,
  BookOpen,
} from 'lucide-react';

interface ReportsViewProps {
  lesson: Lesson;
  submissions: LessonSubmission[];
  currentRole: UserRole;
  currentStudentId?: string;
  onSelectLesson: (lessonId: string) => void;
  allLessons: Lesson[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  lesson,
  submissions,
  currentRole,
  currentStudentId,
  onSelectLesson,
  allLessons,
}) => {
  const [selectedStudentSub, setSelectedStudentSub] = useState<any | null>(null);
  const [sessionReports, setSessionReports] = useState<SessionReport[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Fetch session reports from backend database
  const fetchSessionReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch(`/api/reports/sessions?role=${currentRole}&studentId=${currentStudentId || ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.reports) {
          setSessionReports(data.reports);
        }
      }
    } catch (e) {
      console.warn('Could not fetch server session reports:', e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchSessionReports();
  }, [lesson.id, currentRole, currentStudentId]);

  // Session reports that belong to this lesson
  const lessonSessionReports = sessionReports.filter((r) => r.lessonId === lesson.id);

  // Fallback submissions for this lesson from local submissions
  const lessonSubmissions = submissions.filter((s) => s.lessonId === lesson.id);

  // The active selected session report (if not 'all')
  const activeSessionReport = lessonSessionReports.find((r) => r.sessionId === selectedSessionId);

  // Compute metrics depending on whether a specific session is selected or 'all'
  const isIndividualSession = selectedSessionId !== 'all' && Boolean(activeSessionReport);

  const displayStudents = isIndividualSession
    ? activeSessionReport?.students || []
    : lessonSubmissions.map((s) => ({
        id: s.studentId,
        name: s.studentName,
        score: s.totalScore,
        maxScore: s.maxScore,
        percentage: s.percentage,
        answers: s.answers,
        completedAt: s.completedAt,
        isBot: false,
      }));

  const totalAttendees = displayStudents.length;

  const avgScore = isIndividualSession
    ? activeSessionReport?.averageScore || 0
    : totalAttendees > 0
    ? Math.round(displayStudents.reduce((acc, s) => acc + s.percentage, 0) / totalAttendees)
    : 0;

  // Calculate question accuracy for this session or aggregate
  const questionStats = lesson.questions.map((q) => {
    let attemptedCount = 0;
    let correctCount = 0;

    if (isIndividualSession && activeSessionReport?.questionStats && activeSessionReport.questionStats[q.id]) {
      const qs = activeSessionReport.questionStats[q.id];
      return {
        question: q,
        attemptedCount: qs.totalAnswered,
        correctCount: qs.correctCount,
        accuracy: qs.accuracy,
      };
    }

    displayStudents.forEach((stu: any) => {
      const ans = stu.answers ? stu.answers[q.id] : null;
      if (ans) {
        attemptedCount++;
        if (ans.isCorrect) correctCount++;
      }
    });

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    return {
      question: q,
      attemptedCount,
      correctCount,
      accuracy,
    };
  });

  // If student role, find this student's result
  const myStudentResult = isIndividualSession
    ? activeSessionReport?.students.find((s) => s.id === currentStudentId) || activeSessionReport?.students[0]
    : displayStudents.find((s: any) => s.id === currentStudentId) || displayStudents[0];

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this session report?')) return;
    try {
      await fetch(`/api/reports/sessions/${sessionId}`, { method: 'DELETE' });
      setSessionReports((prev) => prev.filter((r) => r.sessionId !== sessionId));
      setSelectedSessionId('all');
    } catch (e) {
      console.warn('Failed to delete session report:', e);
    }
  };

  const exportCsv = () => {
    const headers = ['Student Name', 'Total Score', 'Max Score', 'Percentage', 'Timestamp', 'Mode'];
    const sessionLabel = isIndividualSession
      ? activeSessionReport?.pin ? `Live PIN ${activeSessionReport.pin}` : 'Homework'
      : 'All Sessions';

    const rows = displayStudents.map((s: any) => [
      `"${s.name}"`,
      s.score,
      s.maxScore,
      `"${s.percentage}%"`,
      `"${s.completedAt || new Date().toLocaleString()}"`,
      `"${sessionLabel}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${lesson.title.replace(/\s+/g, '_')}_${isIndividualSession ? `Session_${activeSessionReport?.pin || 'report'}` : 'All_Sessions'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Lesson Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{currentRole === 'teacher' ? 'Classroom Session Performance Analytics' : 'My Personal Listening Report'}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">{lesson.title}</h2>
          <div className="text-xs text-slate-500 mt-1">
            CEFR Level {lesson.level} · {lesson.questions.length} Formative Checkpoints
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Switch lesson dropdown */}
          <select
            value={lesson.id}
            onChange={(e) => {
              onSelectLesson(e.target.value);
              setSelectedSessionId('all');
            }}
            className="p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            {allLessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>

          {currentRole === 'teacher' && totalAttendees > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Per-Session Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Select Specific Session:</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {lessonSessionReports.length} recorded classroom sessions for this lesson
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedSessionId('all');
              setSelectedStudentSub(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSessionId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📊 All Sessions Combined ({lessonSubmissions.length + lessonSessionReports.reduce((s, r) => s + r.totalStudents, 0)})
          </button>

          {lessonSessionReports.map((sess) => {
            const isSelected = selectedSessionId === sess.sessionId;
            const dateStr = new Date(sess.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return (
              <button
                key={sess.sessionId}
                type="button"
                onClick={() => {
                  setSelectedSessionId(sess.sessionId);
                  setSelectedStudentSub(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sess.mode === 'live' ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                )}
                <span>
                  {sess.mode === 'live' ? `Live PIN #${sess.pin}` : 'Homework'} · {dateStr} ({sess.totalStudents} stu · {sess.averageScore}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual Session Information Badge (if specific session selected) */}
      {isIndividualSession && activeSessionReport && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between flex-wrap gap-4 text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl">
              {activeSessionReport.mode === 'live' ? <Radio className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-amber-950 text-sm">
                Session {activeSessionReport.pin ? `#${activeSessionReport.pin}` : activeSessionReport.sessionId} ({activeSessionReport.mode === 'live' ? 'Synchronized Live Classroom' : 'Assigned Homework'})
              </div>
              <div className="text-amber-800 text-[11px] mt-0.5">
                Conducted by {activeSessionReport.teacherName} · {new Date(activeSessionReport.createdAt).toLocaleString()} · {activeSessionReport.totalStudents} student{activeSessionReport.totalStudents === 1 ? '' : 's'} participated
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDeleteSession(activeSessionReport.sessionId)}
              className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete this session report"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Session</span>
            </button>
          </div>
        </div>
      )}

      {/* TEACHER VIEW */}
      {currentRole === 'teacher' && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isIndividualSession ? 'Session Attendees' : 'Total Submissions'}
              </div>
              <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
                {totalAttendees}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {isIndividualSession ? 'Students participated in this room' : 'Students submitted across sessions'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isIndividualSession ? 'Session Average' : 'Aggregate Class Average'}
              </div>
              <div className="text-3xl font-extrabold font-mono text-amber-600 mt-1">
                {avgScore}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Across all listening questions</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Listening Proficiency
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-600 mt-1">
                {avgScore >= 75 ? 'Proficient' : avgScore >= 60 ? 'Developing' : 'Review Needed'}
              </div>
              <div className="text-xs text-slate-500 mt-1">CEFR Comprehension Benchmark</div>
            </div>
          </div>

          {/* Question-by-Question Accuracy Breakdown for this session */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                {isIndividualSession ? 'Session Question Breakdown' : 'All-Sessions Question Accuracy'}
              </h3>
              <p className="text-xs text-slate-500">
                Accuracy on each audio checkpoint for this session.
              </p>
            </div>

            <div className="space-y-3">
              {questionStats.map(({ question: q, accuracy, correctCount, attemptedCount }, idx) => (
                <div
                  key={q.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        Q{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 truncate max-w-lg">
                        {q.prompt}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700">{accuracy}% Correct</span>
                      <span className="text-slate-400">({correctCount}/{attemptedCount || totalAttendees})</span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        accuracy >= 75 ? 'bg-emerald-500' : accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      {typeof q.timestamp === 'number' && q.timestamp >= 0
                        ? `Checkpoint at ${Math.floor(q.timestamp / 60)}:${(q.timestamp % 60).toString().padStart(2, '0')}`
                        : 'General / Whole Video Comprehension'}
                    </span>
                    <span className="italic">{q.explanation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Roster Table for this session */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              {isIndividualSession ? 'Session Student Roster' : 'All Student Submissions'}
            </h3>

            {displayStudents.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No student responses recorded in this session yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3">Student Name</th>
                      <th className="pb-3">Score</th>
                      <th className="pb-3">Percentage</th>
                      <th className="pb-3">Timestamp</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayStudents.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 font-semibold text-slate-800 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sub.name}</span>
                          {sub.isBot && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 rounded">
                              Bot
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-slate-700">
                          {sub.score} / {sub.maxScore} pts
                        </td>
                        <td className="py-3">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              sub.percentage >= 80 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {sub.percentage}%
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{sub.completedAt}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => setSelectedStudentSub(selectedStudentSub?.id === sub.id ? null : sub)}
                            className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                          >
                            {selectedStudentSub?.id === sub.id ? 'Hide' : 'Inspect Answers'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inspect Selected Student Answers Drawer */}
            {selectedStudentSub && (
              <div className="mt-4 p-5 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Detailed Answers for {selectedStudentSub.name} ({selectedStudentSub.percentage}%)
                  </h4>
                  <button
                    onClick={() => setSelectedStudentSub(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  {lesson.questions.map((q, idx) => {
                    const ans = selectedStudentSub.answers ? selectedStudentSub.answers[q.id] : null;
                    return (
                      <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {idx + 1}. {q.prompt}
                          </span>
                          <span className={`flex items-center gap-1 font-semibold ${ans?.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {ans?.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{ans?.pointsEarned || (ans?.points !== undefined ? ans.points : 0)} / {q.points} pts</span>
                          </span>
                        </div>

                        <div className="text-slate-600">
                          <span className="font-medium text-slate-700">Answer: </span>
                          <span className="font-mono">{typeof ans?.answer === 'object' ? JSON.stringify(ans?.answer) : String(ans?.answer || 'No answer')}</span>
                        </div>

                        {ans?.aiFeedback && (
                          <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-100">
                            <span className="font-bold">Feedback: </span>{ans.aiFeedback}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STUDENT VIEW */}
      {currentRole === 'student' && (
        <div className="space-y-6">
          {myStudentResult ? (
            <div className="space-y-6">
              {/* Score Tile */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {isIndividualSession ? `Scorecard for Session #${activeSessionReport?.pin || 'Live'}` : 'Assignment Scorecard'}
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">
                    {myStudentResult.percentage}%
                  </div>
                  <div className="text-xs text-slate-500">
                    {myStudentResult.score} out of {myStudentResult.maxScore} total points earned
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>
                    {myStudentResult.percentage >= 80 ? 'Excellent Listening!' : 'Good Effort, Keep Practicing!'}
                  </span>
                </div>
              </div>

              {/* Review Each Question with Feedback */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Question Review & Teacher Feedback
                </h3>

                <div className="space-y-3">
                  {lesson.questions.map((q, idx) => {
                    const ans = myStudentResult.answers ? myStudentResult.answers[q.id] : null;
                    const isCorrect = ans?.isCorrect;

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border text-xs space-y-2 ${
                          isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-bold text-slate-900 text-sm">
                            {idx + 1}. {q.prompt}
                          </div>
                          <div className={`shrink-0 flex items-center gap-1 font-bold ${
                            isCorrect ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>{ans?.pointsEarned || (ans?.points !== undefined ? ans.points : 0)} / {q.points} pts</span>
                          </div>
                        </div>

                        <div className="text-slate-700">
                          <span className="font-semibold">Your Answer: </span>
                          <span className="font-mono">
                            {typeof ans?.answer === 'object' ? JSON.stringify(ans?.answer) : String(ans?.answer || 'Not answered')}
                          </span>
                        </div>

                        {q.explanation && (
                          <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">Teacher Explanation: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <h3 className="text-base font-bold text-slate-800">No session submission found for this lesson yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Start this lesson in Homework mode or join a Live Classroom session with your teacher to submit your answers!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
