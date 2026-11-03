import React, { useState, useEffect, useRef } from 'react';
import {
  LiveSessionState,
  Lesson,
  Question,
  LiveStudentData,
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
} from 'lucide-react';
import { VocabEntry } from '../types';

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
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAddingBots, setIsAddingBots] = useState(false);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);

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
        }
      } catch (e) {
        console.error('Error fetching live session:', e);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1500);
    return () => clearInterval(interval);
  }, [pin]);

  // Sync playback time to server periodically
  const updateServerState = async (updates: Partial<LiveSessionState>) => {
    try {
      await fetch('/api/live/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, ...updates }),
      });
    } catch (e) {
      console.error('Failed to sync live state:', e);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    // Broadcast time sync every second
    if (Math.floor(time) % 2 === 0) {
      updateServerState({ currentTime: time });
    }
  };

  const handleQuestionTrigger = (q: Question) => {
    setActiveQuestion(q);
    updateServerState({ currentQuestionId: q.id, isPlaying: false });

    // Trigger simulated bots to answer after realistic 2-3s delay
    setTimeout(async () => {
      try {
        await fetch('/api/live/bot-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            questionId: q.id,
            questionType: q.type,
            correctAnswer: q.correctAnswer,
            options: q.options || [],
          }),
        });
      } catch (err) {}
    }, 2500);
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
      // Refresh immediately
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

  // Teacher presses button to send instant feedback to students (for objectively scored questions)
  const handleRevealFeedback = async () => {
    if (!activeQuestion) return;
    try {
      await fetch('/api/live/reveal-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, questionId: activeQuestion.id }),
      });
      // Update local state
      if (session) {
        setSession({
          ...session,
          revealedFeedbackForQuestionId: activeQuestion.id,
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

  // Broadcast a difficult vocabulary word to all students (pauses playback)
  const handleBroadcastVocab = async (vocab: VocabEntry) => {
    setPauseTrigger(Date.now());
    updateServerState({ isPlaying: false, activeVocabWord: vocab });
  };

  // Dismiss vocabulary spotlight
  const handleDismissVocabSpotlight = async () => {
    updateServerState({ activeVocabWord: null });
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/?join=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const studentsList: LiveStudentData[] = session ? Object.values(session.students) : [];
  const totalStudents = studentsList.length;

  // Calculate responses for the active question
  let answeredCount = 0;
  const optionTallies: Record<string, number> = {};

  if (activeQuestion) {
    if (activeQuestion.options) {
      activeQuestion.options.forEach((opt) => {
        optionTallies[opt.id] = 0;
      });
    }

    studentsList.forEach((stu) => {
      const studentAns = stu.answers[activeQuestion.id];
      if (studentAns) {
        answeredCount++;
        const ansVal = studentAns.answer;
        if (typeof ansVal === 'string' && optionTallies[ansVal] !== undefined) {
          optionTallies[ansVal]++;
        }
      }
    });
  }

  const isFeedbackRevealed =
    session?.revealedFeedbackForQuestionId === activeQuestion?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Room Code & Student Counter */}
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-medium transition-colors"
                title="Copy student invite link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Student Link'}</span>
              </button>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden sm:block" />

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Lesson
            </div>
            <div className="text-sm font-bold text-slate-800">{lesson.title}</div>
            <div className="text-xs text-slate-500">Teacher Host: Dr. Sarah Jenkins</div>
          </div>
        </div>

        {/* Right Tools: Bot Simulator & Exit */}
        <div className="flex items-center gap-3">
          {totalStudents < 3 && (
            <button
              onClick={handleAddBots}
              disabled={isAddingBots}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-indigo-600" />
              <span>{isAddingBots ? 'Adding Bots...' : '+ Add 4 Simulated Students'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
            <Users className="w-4 h-4 text-slate-500" />
            <span>{totalStudents} Connected</span>
          </div>

          <button
            onClick={handleEndSession}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            title="End live session and save report"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Active Vocabulary Broadcast Spotlight Banner */}
      {session?.activeVocabWord && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>Classroom Vocabulary Spotlight Active</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 text-[10px] font-extrabold">Video Paused</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                Target Word: <span className="font-extrabold text-amber-900 underline">{session.activeVocabWord.word}</span>{' '}
                <span className="text-xs font-mono text-slate-500 font-normal">({session.activeVocabWord.cefrLevel} {session.activeVocabWord.partOfSpeech})</span>
              </div>
              <div className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                {session.activeVocabWord.definition}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismissVocabSpotlight}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            Dismiss Spotlight
          </button>
        </div>
      )}

      {/* Main Classroom Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Teacher Unified Player & Captions (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
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

        {/* Right Column: Live Formative Assessment Monitor (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Active Question Box */}
          {activeQuestion ? (
            <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-sm space-y-4 ring-1 ring-amber-400/30">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Live Question Active
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-600 font-mono">
                  {answeredCount} / {totalStudents || 1} Answered
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {activeQuestion.prompt}
                </h4>
              </div>

              {/* Real-time Live Response Bars for Multiple Choice & True/False */}
              {activeQuestion.options && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold uppercase text-slate-400">Class Response Distribution</div>
                  {activeQuestion.options.map((opt) => {
                    const count = optionTallies[opt.id] || 0;
                    const percent = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                    const isCorrect = opt.id === activeQuestion.correctAnswer;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`flex items-center gap-1.5 ${isFeedbackRevealed && isCorrect ? 'font-bold text-emerald-800' : 'text-slate-700'}`}>
                            <span className="font-mono uppercase font-bold text-slate-400">{opt.id}.</span>
                            <span className="truncate max-w-[200px]">{opt.text}</span>
                            {isFeedbackRevealed && isCorrect && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </span>
                          <span className="font-mono font-medium text-slate-500">{percent}% ({count})</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isFeedbackRevealed && isCorrect
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons: Send Feedback to Students (Objectively Scored) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {!isFeedbackRevealed ? (
                  <button
                    onClick={handleRevealFeedback}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Feedback & Answers to Students</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Feedback and explanations sent to student screens!</span>
                  </div>
                )}

                <button
                  onClick={handleResumePlayback}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Video Playback</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>Upcoming Questions</span>
              </div>
              <p className="text-xs text-slate-500">
                The video will automatically pause when it reaches these checkpoints:
              </p>
              <div className="space-y-2">
                {lesson.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {idx + 1}. {q.prompt.substring(0, 40)}...
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        At {Math.floor(q.timestamp / 60)}:{(q.timestamp % 60).toString().padStart(2, '0')} · {q.type}
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuestionTrigger(q)}
                      className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 rounded-md text-[11px] font-semibold transition-colors"
                    >
                      Trigger Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vocabulary Spotlight Panel for Teacher */}
          {lesson.difficultWords && lesson.difficultWords.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <span>Difficult Vocabulary ({lesson.difficultWords.length})</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Click to broadcast</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {lesson.difficultWords.map((v) => (
                  <div
                    key={v.word}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="truncate">{v.word}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-900">
                          {v.cefrLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic truncate">
                        {v.definition}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBroadcastVocab(v)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] shrink-0 transition-colors cursor-pointer shadow-xs"
                      title="Pause video and spotlight this word on all student screens"
                    >
                      Show to Class
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Roster Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Student Roster ({studentsList.length})</span>
              </div>
            </div>

            {studentsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 space-y-2">
                <p>Waiting for students to join...</p>
                <p className="text-amber-700 font-medium">
                  Tip: Click "+ Add 4 Simulated Students" above to test immediately!
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {studentsList.map((stu) => {
                  const answeredCurrent = activeQuestion && stu.answers[activeQuestion.id];
                  return (
                    <div key={stu.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="font-medium text-slate-800">{stu.name}</span>
                        {stu.isBot && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono">
                            Bot
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {activeQuestion && (
                          <span className={`text-[11px] font-medium ${answeredCurrent ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                            {answeredCurrent ? 'Answered' : 'Thinking...'}
                          </span>
                        )}
                        <span className="font-mono font-bold text-slate-700">
                          {stu.score} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
