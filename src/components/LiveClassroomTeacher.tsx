import React, { useState, useEffect, useRef } from 'react';
import {
  LiveSessionState,
  Lesson,
  Question,
  LiveStudentData,
  VocabEntry,
} from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import {
  Users,
  Copy,
  Check,
  Bot,
  Send,
  Eye,
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Radio,
  BookOpen,
  Cast,
  ExternalLink,
  Sliders,
  Tv,
  Lock,
  Unlock,
} from 'lucide-react';

interface LiveClassroomTeacherProps {
  lesson: Lesson;
  pin: string;
  onExit: () => void;
}

export const LiveClassroomTeacher: React.FC<LiveClassroomTeacherProps> = ({
  lesson,
  pin,
  onExit,
}) => {
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    lesson.questions[0]?.id || ''
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAddingBots, setIsAddingBots] = useState(false);
  const [feedbackSentId, setFeedbackSentId] = useState<string | null>(null);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [teacherViewMode, setTeacherViewMode] = useState<'console' | 'projector'>('console');

  const handleEndSession = async () => {
    try {
      await fetch('/api/live/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
    } catch (e) {
      console.warn('Could not cleanly end session on server:', e);
    }
    onExit();
  };

  // Poll session state every 1.5s for live student responses
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/live/session/${pin}`);
        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          if (data.session.currentQuestionId && !activeQuestion) {
            const found = lesson.questions.find((q) => q.id === data.session.currentQuestionId);
            if (found) {
              setActiveQuestion(found);
              setSelectedQuestionId(found.id);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching live session:', e);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1500);
    return () => clearInterval(interval);
  }, [pin, activeQuestion, lesson.questions]);

  // Sync state to server
  const updateServerState = async (updates: Partial<LiveSessionState>) => {
    try {
      await fetch('/api/live/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, ...updates }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    if (Math.abs(time - (session?.currentTime || 0)) > 2) {
      updateServerState({ currentTime: time });
    }
  };

  const handleQuestionTrigger = (question: Question) => {
    setActiveQuestion(question);
    setSelectedQuestionId(question.id);
    setPauseTrigger(Date.now());
    updateServerState({
      currentQuestionId: question.id,
      isPlaying: false,
    });
  };

  const handleSeekToQuestion = (q: Question) => {
    if (typeof q.timestamp === 'number') {
      setCurrentTime(q.timestamp);
      setSelectedQuestionId(q.id);
      updateServerState({
        currentTime: q.timestamp,
        currentQuestionId: q.id,
        isPlaying: false,
      });
      setPauseTrigger(Date.now());
    } else {
      setSelectedQuestionId(q.id);
      updateServerState({
        currentQuestionId: q.id,
        isPlaying: false,
      });
    }
  };

  // Add 4 simulated students with one click
  const handleAddBots = async () => {
    setIsAddingBots(true);
    try {
      await fetch('/api/live/add-bot-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, count: 4 }),
      });
      const res = await fetch(`/api/live/session/${pin}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingBots(false);
    }
  };

  // Teacher sends instant feedback / reveals correct answers with touch-response feedback
  const handleRevealFeedback = async (questionId: string) => {
    setFeedbackSentId(questionId);
    setTimeout(() => {
      setFeedbackSentId((prev) => (prev === questionId ? null : prev));
    }, 2200);

    try {
      await fetch('/api/live/reveal-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, questionId }),
      });
      if (session) {
        setSession({
          ...session,
          revealedFeedbackForQuestionId: questionId,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumePlayback = async () => {
    setActiveQuestion(null);
    updateServerState({ currentQuestionId: null, isPlaying: true });
  };

  // Broadcast a difficult vocabulary word to all students (pauses playback and spotlights word)
  const handleBroadcastVocab = async (vocab: VocabEntry) => {
    setPauseTrigger(Date.now());
    setSession((prev) => (prev ? { ...prev, isPlaying: false, activeVocabWord: vocab } : null));
    updateServerState({ isPlaying: false, activeVocabWord: vocab });
  };

  // Dismiss vocabulary spotlight
  const handleDismissVocabSpotlight = async () => {
    setSession((prev) => (prev ? { ...prev, activeVocabWord: null } : null));
    updateServerState({ activeVocabWord: null });
  };

  // Toggle allowing students to edit their answers after submitting
  const handleToggleAllowEditAnswer = async () => {
    const nextVal = !session?.allowEditAnswer;
    setSession((prev) => (prev ? { ...prev, allowEditAnswer: nextVal } : null));
    updateServerState({ allowEditAnswer: nextVal });
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/?join=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const studentsList: LiveStudentData[] = session ? Object.values(session.students) : [];
  const totalStudents = studentsList.length;

  const inspectingQuestion =
    lesson.questions.find((q) => q.id === selectedQuestionId) ||
    activeQuestion ||
    lesson.questions[0];

  const formatSeconds = (sec?: number | null) => {
    if (typeof sec !== 'number') return 'Whole Video';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Room Code & View Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Live Session PIN
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-extrabold font-mono tracking-widest text-slate-900">
                {pin}
              </span>
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title="Copy student invite link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden sm:block" />

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Lesson
            </div>
            <div className="text-sm font-bold text-slate-800 truncate max-w-xs">{lesson.title}</div>
            <div className="text-xs text-slate-500">Teacher Control Deck</div>
          </div>
        </div>

        {/* View Mode Switcher & Tools */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* External Tab Link for Screen Sharing */}
          <a
            href={`/?projector=${pin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            title="Opens dedicated projection screen in a new tab for sharing to Google Meet or Zoom"
          >
            <Cast className="w-4 h-4" />
            <span>Open Video Share in New Tab ↗</span>
          </a>

          {/* Internal Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTeacherViewMode('console')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                teacherViewMode === 'console'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Responses Console</span>
            </button>

            <button
              type="button"
              onClick={() => setTeacherViewMode('projector')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                teacherViewMode === 'projector'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Screen Share View</span>
            </button>
          </div>

          {/* Teacher Option: Allow or Disallow Answer Editing */}
          <button
            type="button"
            onClick={handleToggleAllowEditAnswer}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              session?.allowEditAnswer
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={
              session?.allowEditAnswer
                ? 'Students CAN change and edit their answers after submitting (Click to lock)'
                : 'Students CANNOT edit answers after submitting (Click to allow editing)'
            }
          >
            {session?.allowEditAnswer ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Edit Answers: {session?.allowEditAnswer ? 'Allowed' : 'Locked'}</span>
          </button>

          {totalStudents < 3 && (
            <button
              onClick={handleAddBots}
              disabled={isAddingBots}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isAddingBots ? 'Adding...' : '+ 4 Test Students'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
            <Users className="w-4 h-4 text-slate-500" />
            <span>{totalStudents} Connected</span>
          </div>

          <button
            onClick={handleEndSession}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="End live session and save report"
          >
            End Session
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: Projector Screen Share View (In-Tab) */}
      {teacherViewMode === 'projector' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cast className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-slate-100">
                Screen Share View (Share this tab via Google Meet or Zoom)
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Students do not see video on their devices; they follow along on this screen.
            </span>
          </div>

          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
            <UnifiedPlayer
              mediaType={lesson.mediaType}
              mediaUrl={lesson.mediaUrl}
              duration={lesson.duration}
              trimStart={lesson.trimStart}
              trimEnd={lesson.trimEnd}
              questions={lesson.questions}
              preventSkipping={false}
              isStudent={false}
              pauseTrigger={pauseTrigger}
              captions={lesson.captions}
              difficultWords={lesson.difficultWords}
              showCaptions={showCaptions}
              onToggleCaptions={() => setShowCaptions(!showCaptions)}
              onWordClick={handleBroadcastVocab}
              onTimeUpdate={handleTimeUpdate}
              onQuestionTrigger={handleQuestionTrigger}
            />
          </div>

          <div className="bg-slate-900 rounded-xl p-4">
            <InteractiveCaptions
              captions={lesson.captions}
              difficultWords={lesson.difficultWords}
              currentTime={currentTime}
              canSeek={true}
              isTeacher={true}
              onWordClick={() => {
                setPauseTrigger(Date.now());
                updateServerState({ isPlaying: false });
              }}
              onShowVocabToClass={handleBroadcastVocab}
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Teacher Control Console (Questions, Student Responses, Difficult Words) */}
      {teacherViewMode === 'console' && (
        <div className="space-y-6">
          {/* Playback Control Bar for Teacher */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const nextPlay = !session?.isPlaying;
                  updateServerState({ isPlaying: nextPlay });
                }}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold transition-colors cursor-pointer shadow-xs"
              >
                {session?.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span>Playback: {session?.isPlaying ? 'Playing' : 'Paused'}</span>
                  <span className="font-mono text-amber-700">
                    {formatSeconds(currentTime)} / {formatSeconds(lesson.duration)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Controls both student checkpoint triggers and the video projection screen
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeQuestion && (
                <button
                  type="button"
                  onClick={handleResumePlayback}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  Resume Video Playback
                </button>
              )}
            </div>
          </div>

          {/* Main 2-Column Inspector: Questions List (Left 4 cols) vs Live Student Responses (Right 8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: All Questions List (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>All Checkpoints & Questions ({lesson.questions.length})</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {lesson.questions.map((q, idx) => {
                    const isSelected = inspectingQuestion?.id === q.id;
                    const isActive = activeQuestion?.id === q.id;
                    const answeredCount = studentsList.filter((s) => s.answers[q.id]).length;

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestionId(q.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="font-mono text-amber-800">
                              {formatSeconds(q.timestamp)}
                            </span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[9px] uppercase animate-pulse">
                                Active Now
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-slate-500 font-mono">
                              {answeredCount}/{totalStudents} Answered
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed">
                          {q.prompt}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Vocabulary / Difficult Words Panel */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <span>Difficult Words ({lesson.difficultWords.length})</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {lesson.difficultWords.map((v) => {
                    const isShown =
                      session?.activeVocabWord &&
                      session.activeVocabWord.word.toLowerCase() === v.word.toLowerCase();

                    return (
                      <div
                        key={v.word}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                          isShown
                            ? 'bg-amber-100/70 border-amber-400'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="truncate">{v.word}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-200 text-amber-900">
                              {v.cefrLevel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {v.definition}
                          </div>
                        </div>

                        {/* Show to Class / Unshow Button */}
                        {isShown ? (
                          <button
                            type="button"
                            onClick={handleDismissVocabSpotlight}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
                            title="Remove vocabulary spotlight from student screens"
                          >
                            Unshow
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBroadcastVocab(v)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
                            title="Spotlight this word to the whole class"
                          >
                            Show to Class
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Detailed Student Responses Inspector (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {inspectingQuestion && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                  {/* Question Header & Controls */}
                  <div className="space-y-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">
                          {inspectingQuestion.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-xs font-mono font-bold">
                          {formatSeconds(inspectingQuestion.timestamp)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {inspectingQuestion.points} points
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {typeof inspectingQuestion.timestamp === 'number' && (
                          <button
                            type="button"
                            onClick={() => handleSeekToQuestion(inspectingQuestion)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Jump Video Here
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRevealFeedback(inspectingQuestion.id)}
                          className={`px-3.5 py-1.5 font-bold rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                            feedbackSentId === inspectingQuestion.id
                              ? 'bg-emerald-600 text-white shadow-md scale-105'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          {feedbackSentId === inspectingQuestion.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                              <span>Feedback Sent!</span>
                            </>
                          ) : (
                            <span>Send Instant Feedback</span>
                          )}
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {inspectingQuestion.prompt}
                    </h3>

                    {/* Explanation / Correct Answer key for teacher reference */}
                    {inspectingQuestion.explanation && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Correct Answer & Explanation:</span>
                        </div>
                        <p className="text-emerald-800 leading-relaxed font-normal">
                          {inspectingQuestion.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Student Live Responses Roster */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>Live Student Responses ({studentsList.filter((s) => s.answers[inspectingQuestion.id]).length}/{totalStudents} submitted)</span>
                      </h4>
                    </div>

                    {studentsList.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-2">
                        <p>No students have joined this room yet.</p>
                        <p className="text-amber-700 font-medium">Click "+ 4 Test Students" in the top bar to simulate live responses!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {studentsList.map((stu) => {
                          const record = stu.answers[inspectingQuestion.id];
                          const hasAnswered = !!record;

                          // Format the student's answer text
                          let formattedResponse = 'Not answered yet';
                          if (hasAnswered) {
                            const val = record.answer;
                            if (inspectingQuestion.options) {
                              const opt = inspectingQuestion.options.find((o) => o.id === val);
                              formattedResponse = opt ? `Option ${opt.id.toUpperCase()}: "${opt.text}"` : String(val);
                            } else if (Array.isArray(val)) {
                              formattedResponse = val.join(', ');
                            } else if (typeof val === 'object' && val !== null) {
                              formattedResponse = JSON.stringify(val);
                            } else {
                              formattedResponse = String(val);
                            }
                          }

                          return (
                            <div
                              key={stu.id}
                              className={`p-3.5 flex items-center justify-between gap-4 text-xs ${
                                hasAnswered ? 'bg-white' : 'bg-slate-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-[140px]">
                                <span className={`w-2 h-2 rounded-full ${hasAnswered ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></span>
                                <div>
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span>{stu.name}</span>
                                    {stu.isBot && (
                                      <span className="text-[9px] px-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono">
                                        Bot
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Total: {stu.score} pts
                                  </div>
                                </div>
                              </div>

                              {/* Student's Exact Submitted Answer */}
                              <div className="flex-1 px-3">
                                {hasAnswered ? (
                                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px] leading-relaxed">
                                    "{formattedResponse}"
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Waiting for student response...</span>
                                )}
                              </div>

                              {/* Score & Status Badge */}
                              <div className="text-right min-w-[90px] shrink-0">
                                {hasAnswered ? (
                                  record.isCorrect ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>+{record.points} pts</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold text-[11px]">
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>0 pts</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Pending</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
