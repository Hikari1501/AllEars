import React, { useState, useEffect, useRef } from 'react';
import { Lesson, LiveSessionState, VocabEntry, Question } from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import { Radio, Users, Cast, ArrowLeft, HelpCircle, Sparkles, BookOpen, Clock, AlertCircle } from 'lucide-react';

interface LiveClassroomProjectorProps {
  lesson: Lesson;
  allLessons?: Lesson[];
  pin: string;
  onExit?: () => void;
}

export const LiveClassroomProjector: React.FC<LiveClassroomProjectorProps> = ({
  lesson,
  allLessons = [],
  pin,
  onExit,
}) => {
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [pauseTrigger, setPauseTrigger] = useState<number>(0);
  const [seekTriggerTime, setSeekTriggerTime] = useState<number | undefined>(undefined);
  const lastServerSyncTimeRef = useRef<number>(0);

  // Poll session state to keep in sync with teacher control console
  useEffect(() => {
    let isMounted = true;
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/live/session/${pin}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.session) {
            setSession(data.session);

            // If control console explicitly paused or jumped to a different time
            const serverTime = data.session.currentTime || 0;
            if (Math.abs(serverTime - currentTime) > 3 && Date.now() - lastServerSyncTimeRef.current > 2000) {
              setCurrentTime(serverTime);
              setSeekTriggerTime(serverTime);
            }
          }
        }
      } catch (e) {
        console.error('Error in projector session poll:', e);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pin, currentTime]);

  // Find the exact active lesson matching the live session
  const activeLesson = (session?.lessonId && allLessons.find((l) => l.id === session.lessonId)) || lesson;

  // Broadcast state changes from this projector tab to server
  const updateServerState = async (updates: Partial<LiveSessionState>) => {
    lastServerSyncTimeRef.current = Date.now();
    try {
      await fetch('/api/live/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, ...updates }),
      });
    } catch (e) {
      console.error('Error updating state from projector:', e);
    }
  };

  // Live video time updates
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    // Throttle server updates to every 1.5 seconds so student screens follow along
    if (Date.now() - lastServerSyncTimeRef.current > 1500) {
      updateServerState({ currentTime: time });
    }
  };

  // Checkpoint trigger
  const handleQuestionTrigger = (question: Question) => {
    setPauseTrigger(Date.now());
    setIsPlaying(false);
    updateServerState({
      currentTime: typeof question.timestamp === 'number' ? question.timestamp : currentTime,
      currentQuestionId: question.id,
      isPlaying: false,
    });
  };

  // Upcoming checkpoints calculation
  const upcomingQuestions = activeLesson.questions
    .filter((q) => typeof q.timestamp === 'number' && (q.timestamp || 0) > currentTime)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const nextQuestion = upcomingQuestions[0];
  const secondsToNextQ = nextQuestion && typeof nextQuestion.timestamp === 'number'
    ? Math.max(0, Math.floor(nextQuestion.timestamp - currentTime))
    : null;

  const studentsCount = session ? Object.keys(session.students).length : 0;

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none">
      {/* Projection Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-4 shadow-md">
        <div className="flex items-center gap-4">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Presentation Window"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-xs font-bold font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>ROOM PIN: {pin}</span>
          </div>

          <div>
            <h1 className="text-sm font-bold text-slate-100 truncate max-w-md">{activeLesson.title}</h1>
            <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
              <Cast className="w-3.5 h-3.5" />
              <span>Screen Share this tab/window via Google Meet or Zoom</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300">
            <Users className="w-4 h-4 text-amber-400" />
            <span>{studentsCount} Students Watching</span>
          </div>

          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              showCaptions ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            CC {showCaptions ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Screen Share View */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4">
        {/* Checkpoint Notice Bar for Teacher */}
        <div className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
            {nextQuestion ? (
              <span className="text-slate-300">
                <span className="font-bold text-amber-400">Next Checkpoint</span> at{' '}
                <span className="font-mono font-bold text-white">{formatSec(nextQuestion.timestamp || 0)}</span>{' '}
                ({secondsToNextQ}s away):{' '}
                <span className="text-slate-400 italic truncate max-w-sm inline-block align-bottom">
                  "{nextQuestion.prompt}"
                </span>
              </span>
            ) : (
              <span className="text-slate-400">All checkpoint questions completed for this lesson!</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Checkpoints pinned on timeline</span>
          </div>
        </div>

        {/* Player Container with built-in controls */}
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
          <UnifiedPlayer
            mediaType={activeLesson.mediaType}
            mediaUrl={activeLesson.mediaUrl}
            duration={activeLesson.duration}
            trimStart={activeLesson.trimStart}
            trimEnd={activeLesson.trimEnd}
            questions={activeLesson.questions}
            preventSkipping={false}
            isStudent={false}
            isControlledExternally={false}
            pauseTrigger={pauseTrigger}
            seekTriggerTime={seekTriggerTime}
            captions={activeLesson.captions}
            difficultWords={activeLesson.difficultWords}
            showCaptions={showCaptions}
            onToggleCaptions={() => setShowCaptions(!showCaptions)}
            onWordClick={() => {}}
            onTimeUpdate={handleTimeUpdate}
            onQuestionTrigger={handleQuestionTrigger}
          />

          {/* Active Vocabulary Spotlight Overlay (if spotlighted by teacher) */}
          {session?.activeVocabWord && (
            <div className="absolute top-4 right-4 max-w-sm bg-slate-900/95 backdrop-blur-md border-2 border-amber-500 rounded-2xl p-4 shadow-2xl text-left animate-in fade-in slide-in-from-top-2 z-30">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Class Vocabulary Spotlight</span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{session.activeVocabWord.word}</h3>
                <span className="text-xs font-mono text-slate-400">{session.activeVocabWord.phonetic}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-400 text-slate-950">
                  {session.activeVocabWord.cefrLevel}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {session.activeVocabWord.definition}
              </p>
              {session.activeVocabWord.example && (
                <p className="text-[11px] text-amber-300/90 italic mt-1.5 border-t border-slate-800 pt-1.5">
                  "{session.activeVocabWord.example}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Live Synchronized Timed Captions */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Synchronized Speech Captions & CEFR Vocabulary Highlights</span>
            </div>
            <div className="font-mono text-amber-400">
              Playback: {formatSec(currentTime)}
            </div>
          </div>

          <InteractiveCaptions
            captions={activeLesson.captions}
            difficultWords={activeLesson.difficultWords}
            currentTime={currentTime}
            canSeek={true}
            onSeek={(t) => {
              setCurrentTime(t);
              setSeekTriggerTime(t);
              updateServerState({ currentTime: t });
            }}
            isTeacher={false}
          />
        </div>
      </div>
    </div>
  );
};
