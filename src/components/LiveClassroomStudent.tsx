import React, { useState, useEffect } from 'react';
import { Lesson, Question, LiveSessionState, StudentAnswer } from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import { StudentQuestionsPanel } from './StudentQuestionsPanel';
import { Radio, Award, CheckCircle2, User, BookOpen, Volume2, ExternalLink } from 'lucide-react';
import { VocabPopover } from './VocabPopover';

interface LiveClassroomStudentProps {
  lesson: Lesson;
  pin: string;
  studentId: string;
  studentName: string;
  onExit: () => void;
}

export const LiveClassroomStudent: React.FC<LiveClassroomStudentProps> = ({
  lesson,
  pin,
  studentId,
  studentName,
  onExit,
}) => {
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [myAnswers, setMyAnswers] = useState<Record<string, StudentAnswer>>({});
  const [myScore, setMyScore] = useState<number>(0);
  const [isLocalWordOpen, setIsLocalWordOpen] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  // Poll live session state every 1.2s
  useEffect(() => {
    let isMounted = true;
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/live/session/${pin}`);
        if (res.status === 410) {
          if (isMounted) setIsSessionEnded(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.isEnded) {
            if (isMounted) setIsSessionEnded(true);
            return;
          }
          const sess: LiveSessionState = data.session;
          if (isMounted) {
            setSession(sess);

            // Sync student score and answered records if stored in session
            if (sess.students[studentId]) {
              setMyScore(sess.students[studentId].score || 0);
              const serverAns = sess.students[studentId].answers || {};
              const converted: Record<string, StudentAnswer> = {};
              Object.entries(serverAns).forEach(([qId, val]) => {
                converted[qId] = {
                  questionId: qId,
                  answer: val.answer,
                  isCorrect: val.isCorrect,
                  pointsEarned: val.points,
                  submittedAt: val.submittedAt,
                };
              });
              setMyAnswers((prev) => ({ ...converted, ...prev }));
            }
          }
        }
      } catch (e) {
        console.error('Failed to poll live student session:', e);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pin, studentId, lesson.questions]);

  const handleStudentSubmit = async (answer: StudentAnswer) => {
    setMyAnswers((prev) => ({
      ...prev,
      [answer.questionId]: answer,
    }));

    try {
      await fetch('/api/live/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          studentId,
          questionId: answer.questionId,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          points: answer.pointsEarned,
        }),
      });
    } catch (e) {
      console.error('Failed to submit student answer:', e);
    }
  };

  if (isSessionEnded) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Class Session Ended</div>
          <h3 className="text-xl font-extrabold text-slate-900">Session Completed</h3>
          <p className="text-xs text-slate-500">The teacher has concluded this live classroom session.</p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <div className="text-xs text-slate-500 font-semibold">Your Final Score</div>
          <div className="text-3xl font-extrabold font-mono text-slate-900">{myScore} pts</div>
        </div>
        <button
          onClick={onExit}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs tracking-wide transition-colors cursor-pointer shadow-sm"
        >
          Return to All Ears Lessons
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Student Live Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-bold tracking-wide">
            <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>Live Classroom · Room {pin}</span>
          </div>

          <div className="text-sm font-bold text-slate-800 hidden sm:block">
            {lesson.title}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>{studentName}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold font-mono shadow-xs">
            <Award className="w-4 h-4" />
            <span>{myScore} pts</span>
          </div>

          <button
            onClick={onExit}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* TWO COLUMN SIDE-BY-SIDE LAYOUT: Left = Video & Captions, Right = Questions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Synchronized Player & Interactive Captions */}
        <div className="lg:col-span-7 space-y-4">
          <UnifiedPlayer
            mediaType={lesson.mediaType}
            mediaUrl={lesson.mediaUrl}
            duration={lesson.duration}
            trimStart={lesson.trimStart}
            trimEnd={lesson.trimEnd}
            questions={lesson.questions}
            preventSkipping={true}
            isStudent={true}
            isControlledExternally={true}
            externalCurrentTime={session?.currentTime || 0}
            externalIsPlaying={Boolean(session?.isPlaying && !session?.activeVocabWord && !isLocalWordOpen)}
            externalPlaybackSpeed={session?.playbackSpeed || 1}
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            showCaptions={showCaptions}
            onToggleCaptions={() => setShowCaptions(!showCaptions)}
            onWordClick={() => setIsLocalWordOpen(true)}
            onTimeUpdate={() => {}}
            onQuestionTrigger={() => {}}
          />

          <InteractiveCaptions
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            currentTime={session?.currentTime || 0}
            canSeek={false}
            onWordClick={() => setIsLocalWordOpen(true)}
          />
        </div>

        {/* Right Column (5 cols): Persistent Questions Panel */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <StudentQuestionsPanel
            questions={lesson.questions}
            currentActiveQuestionId={session?.currentQuestionId || null}
            answers={myAnswers}
            onAnswerSubmit={handleStudentSubmit}
            isLiveMode={true}
            revealedFeedbackForQuestionId={session?.revealedFeedbackForQuestionId || null}
            allowRewind={false}
          />
        </div>
      </div>

      {/* Teacher Vocabulary Spotlight Modal (Teacher paused video to explain word) */}
      {session?.activeVocabWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-amber-300 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 ring-2 ring-amber-400">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-amber-500 text-slate-950">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  Teacher Spotlight: Difficult Vocabulary
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-600/30 text-slate-950">
                Video Paused
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {session.activeVocabWord.word}
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {session.activeVocabWord.cefrLevel}
                    </span>
                    <span className="text-xs italic text-slate-500">
                      {session.activeVocabWord.partOfSpeech}
                    </span>
                  </div>
                  <div className="text-sm font-mono text-slate-500 mt-1">
                    {session.activeVocabWord.phonetic}
                  </div>
                </div>
              </div>

              {/* Definition */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Learner Meaning
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {session.activeVocabWord.definition}
                </p>
              </div>

              {/* Example */}
              <div className="border-l-3 border-amber-500 pl-3.5 py-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Illustrative Example
                </div>
                <p className="text-sm italic text-slate-700">
                  "{session.activeVocabWord.example}"
                </p>
              </div>

              {/* Cambridge link */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(session.activeVocabWord.cambridgeSlug || session.activeVocabWord.word.toLowerCase())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
                >
                  <span>Open Cambridge Dictionary</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="text-xs text-slate-500 italic">
                  Teacher will resume video when ready
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
