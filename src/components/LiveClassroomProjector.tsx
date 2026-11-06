import React, { useState, useEffect } from 'react';
import { Lesson, LiveSessionState, VocabEntry } from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import { Radio, Users, Cast, Volume2, ArrowLeft } from 'lucide-react';

interface LiveClassroomProjectorProps {
  lesson: Lesson;
  pin: string;
  onExit?: () => void;
}

export const LiveClassroomProjector: React.FC<LiveClassroomProjectorProps> = ({
  lesson,
  pin,
  onExit,
}) => {
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);

  // Poll session state every 1 second to keep video strictly in sync with teacher controls
  useEffect(() => {
    let isMounted = true;
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/live/session/${pin}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSession(data.session);
          }
        }
      } catch (e) {
        console.error('Error in projector session poll:', e);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pin]);

  const studentsCount = session ? Object.keys(session.students).length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Projection Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Return to Control Console"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-xs font-bold font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>ROOM PIN: {pin}</span>
          </div>

          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-100 truncate max-w-md">{lesson.title}</h1>
            <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
              <Cast className="w-3 h-3" />
              <span>Share this tab/window via Google Meet or Zoom</span>
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

      {/* Main Screen Share View: Large High-Resolution Player */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-4">
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
          <UnifiedPlayer
            mediaType={lesson.mediaType}
            mediaUrl={lesson.mediaUrl}
            duration={lesson.duration}
            trimStart={lesson.trimStart}
            trimEnd={lesson.trimEnd}
            questions={lesson.questions}
            preventSkipping={false}
            isStudent={false}
            isControlledExternally={true}
            externalCurrentTime={session?.currentTime || 0}
            externalIsPlaying={Boolean(session?.isPlaying && !session?.activeVocabWord)}
            externalPlaybackSpeed={session?.playbackSpeed || 1}
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            showCaptions={showCaptions}
            onToggleCaptions={() => setShowCaptions(!showCaptions)}
            onWordClick={() => {}}
            onTimeUpdate={() => {}}
            onQuestionTrigger={() => {}}
          />
        </div>

        {/* Live Presentation Captions */}
        <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <InteractiveCaptions
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            currentTime={session?.currentTime || 0}
            canSeek={false}
            isTeacher={false}
          />
        </div>
      </div>
    </div>
  );
};
