import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  HelpCircle,
  Music,
  Scissors,
  AlertTriangle,
} from 'lucide-react';
import { Question, CaptionSegment, VocabEntry } from '../types';

interface UnifiedPlayerProps {
  mediaType: 'youtube' | 'video' | 'audio';
  mediaUrl: string;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  questions: Question[];
  preventSkipping: boolean;
  isStudent?: boolean;
  answeredQuestionIds?: Set<string>;
  onTimeUpdate: (currentTime: number) => void;
  onQuestionTrigger: (question: Question) => void;
  // External control flags (used in synchronized live classroom mode)
  isControlledExternally?: boolean;
  externalCurrentTime?: number;
  externalIsPlaying?: boolean;
  externalPlaybackSpeed?: number;
  pauseTrigger?: number;
  seekTriggerTime?: number;
  captions?: CaptionSegment[];
  difficultWords?: VocabEntry[];
  showCaptions?: boolean;
  onToggleCaptions?: () => void;
  onWordClick?: (vocab: VocabEntry) => void;
}

export const UnifiedPlayer: React.FC<UnifiedPlayerProps> = ({
  mediaType,
  mediaUrl,
  duration,
  trimStart = 0,
  trimEnd,
  questions,
  preventSkipping,
  isStudent = false,
  answeredQuestionIds = new Set(),
  onTimeUpdate,
  onQuestionTrigger,
  isControlledExternally = false,
  externalCurrentTime,
  externalIsPlaying,
  externalPlaybackSpeed,
  pauseTrigger,
  seekTriggerTime,
  captions = [],
  difficultWords = [],
  showCaptions = true,
  onToggleCaptions,
  onWordClick,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [inVideoCaptions, setInVideoCaptions] = useState(showCaptions);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [maxWatchedTime, setMaxWatchedTime] = useState(trimStart);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [useFallbackPlayer, setUseFallbackPlayer] = useState(false);

  useEffect(() => {
    setInVideoCaptions(showCaptions);
  }, [showCaptions]);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`);
  const triggeredQuestionIds = useRef<Set<string>>(new Set());

  const effectiveEnd = trimEnd && trimEnd > trimStart ? trimEnd : duration || 180;
  const effectiveStart = trimStart || 0;
  const effectiveDuration = Math.max(1, effectiveEnd - effectiveStart);

  // Speed steps requested: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5];

  // Extract YouTube ID if valid
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = mediaType === 'youtube' ? getYouTubeId(mediaUrl) || 'f99P4eWbC9w' : null;

  // Initialize YouTube Player API if mediaType is youtube
  useEffect(() => {
    if (mediaType !== 'youtube' || !youtubeId || useFallbackPlayer) return;

    let checkInterval: any = null;

    const initYouTube = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        try {
          ytPlayerRef.current = new (window as any).YT.Player(ytContainerId.current, {
            videoId: youtubeId,
            playerVars: {
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              enablejsapi: 1,
              start: effectiveStart,
              end: effectiveEnd,
            },
            events: {
              onReady: (event: any) => {
                event.target.setPlaybackRate(playbackSpeed);
                event.target.setVolume(volume * 100);
                if (effectiveStart > 0) {
                  event.target.seekTo(effectiveStart, true);
                }
              },
              onStateChange: (event: any) => {
                if (event.data === 1) {
                  setIsPlaying(true);
                } else if (event.data === 2 || event.data === 0) {
                  setIsPlaying(false);
                }
              },
              onError: (event: any) => {
                console.warn('YouTube Player Error:', event.data);
                // 100: not found, 101/150: embedding not allowed
                if ([100, 101, 150].includes(event.data)) {
                  setPlaybackError(
                    'This video does not allow external embedding. Switched to high-compatibility educational media track.'
                  );
                  setUseFallbackPlayer(true);
                }
              },
            },
          });
        } catch (e) {
          console.error('Failed to initialize YouTube player:', e);
          setUseFallbackPlayer(true);
        }
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initYouTube;
    } else {
      initYouTube();
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [mediaType, youtubeId, useFallbackPlayer, effectiveStart, effectiveEnd]);

  // Main time-tracking & trimming loop
  useEffect(() => {
    const timer = setInterval(() => {
      let t = currentTime;

      if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          t = ytPlayerRef.current.getCurrentTime() || 0;
        } catch (e) {}
      } else if (mediaType === 'video' || useFallbackPlayer) {
        if (videoRef.current) t = videoRef.current.currentTime;
      } else if (mediaType === 'audio') {
        if (audioRef.current) t = audioRef.current.currentTime;
      }

      // Enforce trimming boundaries
      if (effectiveStart > 0 && t < effectiveStart - 0.75) {
        seekTo(effectiveStart);
        return;
      }
      if (effectiveEnd > 0 && t >= effectiveEnd) {
        handlePause();
        seekTo(effectiveEnd);
        return;
      }

      if (t !== currentTime) {
        setCurrentTime(t);
        onTimeUpdate(t);

        if (t > maxWatchedTime) {
          setMaxWatchedTime(t);
        }

        // Check if any unanswered question falls on or before current time
        questions.forEach((q) => {
          const isTriggered = triggeredQuestionIds.current.has(q.id);
          const isAnswered = answeredQuestionIds.has(q.id);

          if (!isTriggered && !isAnswered && Math.abs(t - q.timestamp) <= 0.6) {
            triggeredQuestionIds.current.add(q.id);
            handlePause();
            onQuestionTrigger(q);
          }
        });
      }
    }, 250);

    return () => clearInterval(timer);
  }, [currentTime, maxWatchedTime, questions, answeredQuestionIds, mediaType, useFallbackPlayer, effectiveStart, effectiveEnd]);

  // External sync controls for live classroom
  useEffect(() => {
    if (!isControlledExternally) return;

    if (externalCurrentTime !== undefined && Math.abs(currentTime - externalCurrentTime) > 1.0) {
      seekTo(externalCurrentTime);
    }

    if (externalIsPlaying !== undefined && externalIsPlaying !== isPlaying) {
      if (externalIsPlaying) {
        handlePlay();
      } else {
        handlePause();
      }
    }

    if (externalPlaybackSpeed !== undefined && externalPlaybackSpeed !== playbackSpeed) {
      changeSpeed(externalPlaybackSpeed);
    }
  }, [isControlledExternally, externalCurrentTime, externalIsPlaying, externalPlaybackSpeed]);

  const handlePlay = useCallback(() => {
    if (currentTime < effectiveStart || (effectiveEnd > 0 && currentTime >= effectiveEnd)) {
      seekTo(effectiveStart);
    }

    if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
      ytPlayerRef.current.playVideo();
    } else if (mediaType === 'video' || useFallbackPlayer) {
      if (videoRef.current) videoRef.current.play().catch(() => {});
    } else if (mediaType === 'audio' && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(true);
  }, [mediaType, useFallbackPlayer, currentTime, effectiveStart, effectiveEnd]);

  const handlePause = useCallback(() => {
    if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    } else if (mediaType === 'video' || useFallbackPlayer) {
      if (videoRef.current) videoRef.current.pause();
    } else if (mediaType === 'audio' && audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [mediaType, useFallbackPlayer]);

  useEffect(() => {
    if (pauseTrigger) {
      handlePause();
    }
  }, [pauseTrigger, handlePause]);

  // Support programmatic external seek (e.g. from Homework audio rewind buttons)
  useEffect(() => {
    if (seekTriggerTime !== undefined && seekTriggerTime >= 0) {
      seekTo(seekTriggerTime);
    }
  }, [seekTriggerTime]);

  // Active Caption for in-video display
  const activeCaption = captions ? captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end + 0.3
  ) : null;

  const getVocabHighlightClass = (level: string) => {
    switch (level) {
      case 'B1':
        return 'bg-emerald-500/30 text-emerald-300 border-b-2 border-emerald-400 hover:bg-emerald-500/50';
      case 'B2':
        return 'bg-amber-500/30 text-amber-300 border-b-2 border-amber-400 hover:bg-amber-500/50';
      case 'C1':
        return 'bg-indigo-500/30 text-indigo-300 border-b-2 border-indigo-400 hover:bg-indigo-500/50';
      case 'C2':
        return 'bg-rose-500/30 text-rose-300 border-b-2 border-rose-400 hover:bg-rose-500/50';
      default:
        return 'bg-slate-700 text-slate-200 border-b border-slate-400';
    }
  };

  const renderTextWithVocab = (text: string) => {
    if (!difficultWords || difficultWords.length === 0) return text;
    const sorted = [...difficultWords].sort((a, b) => b.word.length - a.word.length);
    const pattern = new RegExp(
      `\\b(${sorted.map((v) => v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
      'gi'
    );
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;
      if (matchIndex > lastIndex) parts.push(text.substring(lastIndex, matchIndex));
      const matchedVocab = difficultWords.find(
        (v) => v.word.toLowerCase() === matchedText.toLowerCase()
      );
      if (matchedVocab) {
        parts.push(
          <button
            key={`vocab-iv-${matchIndex}-${matchedText}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onWordClick) onWordClick(matchedVocab);
            }}
            className={`inline-block px-1 py-0.2 mx-0.5 rounded cursor-pointer font-semibold transition-all ${getVocabHighlightClass(
              matchedVocab.cefrLevel
            )}`}
            title={`Click to view ${matchedVocab.cefrLevel} definition`}
          >
            {matchedText}
          </button>
        );
      } else {
        parts.push(matchedText);
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts;
  };

  const togglePlay = () => {
    if (isControlledExternally) return;
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const seekTo = (seconds: number) => {
    let target = Math.max(effectiveStart, Math.min(seconds, effectiveEnd));

    // Enforce skip prevention if in student mode
    if (preventSkipping && isStudent && target > maxWatchedTime + 1) {
      target = maxWatchedTime;
    }

    if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(target, true);
    } else if (mediaType === 'video' || useFallbackPlayer) {
      if (videoRef.current) videoRef.current.currentTime = target;
    } else if (mediaType === 'audio' && audioRef.current) {
      audioRef.current.currentTime = target;
    }
    setCurrentTime(target);
    onTimeUpdate(target);
  };

  const rewind5s = () => {
    if (isControlledExternally) return;
    seekTo(currentTime - 5);
  };

  const forward5s = () => {
    if (isControlledExternally) return;
    seekTo(currentTime + 5);
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(speed);
    } else if (mediaType === 'video' || useFallbackPlayer) {
      if (videoRef.current) videoRef.current.playbackRate = speed;
    } else if (mediaType === 'audio' && audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (!useFallbackPlayer && mediaType === 'youtube' && ytPlayerRef.current) {
      if (nextMute) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    } else if (mediaType === 'video' || useFallbackPlayer) {
      if (videoRef.current) videoRef.current.muted = nextMute;
    } else if (mediaType === 'audio' && audioRef.current) {
      audioRef.current.muted = nextMute;
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rewind5s();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        forward5s();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index >= 0 && index < speedOptions.length) {
          changeSpeed(speedOptions[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, maxWatchedTime, isControlledExternally]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentTime - effectiveStart) / effectiveDuration) * 100)
  );
  const watchedPercent = Math.min(
    100,
    Math.max(0, ((maxWatchedTime - effectiveStart) / effectiveDuration) * 100)
  );

  return (
    <div
      ref={containerRef}
      className="w-full bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 text-white select-none flex flex-col"
    >
      {/* Playback Error Warning Banner if applicable */}
      {playbackError && (
        <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{playbackError}</span>
        </div>
      )}

      {/* Media Display Area */}
      <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
        {mediaType === 'youtube' && !useFallbackPlayer && (
          <div className="w-full h-full">
            <div id={ytContainerId.current} className="w-full h-full" />
          </div>
        )}

        {(mediaType === 'video' || useFallbackPlayer) && (
          <video
            ref={videoRef}
            src={
              useFallbackPlayer
                ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                : mediaUrl
            }
            className="w-full h-full object-contain"
            playsInline
            onClick={togglePlay}
          />
        )}

        {mediaType === 'audio' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-radial from-slate-900 to-slate-950">
            <audio ref={audioRef} src={mediaUrl} preload="metadata" />
            <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-inner">
              <Music className={`w-10 h-10 ${isPlaying ? 'animate-bounce' : ''}`} />
              {isPlaying && (
                <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping opacity-30" />
              )}
            </div>
            <div className="text-sm font-medium text-slate-300">English Audio Track</div>
            <div className="text-xs text-slate-500 mt-1">Listen closely and follow the captions below</div>
          </div>
        )}

        {/* Big play button overlay when paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            disabled={isControlledExternally}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-lg hover:bg-amber-400 hover:scale-105 transition-all cursor-pointer z-10"
            aria-label="Play video"
          >
            <Play className="w-7 h-7 fill-current translate-x-0.5" />
          </button>
        )}

        {/* Live Controlled Notice */}
        {isControlledExternally && (
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-amber-400 border border-amber-500/30 flex items-center gap-2 z-20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Teacher-Controlled Live Session</span>
          </div>
        )}

        {/* In-Video CC Toggle Badge (Top Right) */}
        <button
          type="button"
          onClick={() => {
            const next = !inVideoCaptions;
            setInVideoCaptions(next);
            if (onToggleCaptions) onToggleCaptions();
          }}
          className={`absolute top-3 ${effectiveStart > 0 || trimEnd ? 'right-48' : 'right-3'} px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all z-20 flex items-center gap-1.5 cursor-pointer backdrop-blur-md shadow-sm ${
            inVideoCaptions
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title={inVideoCaptions ? 'Click to turn off in-video captions' : 'Click to turn on in-video captions'}
        >
          <Subtitles className="w-3.5 h-3.5" />
          <span>{inVideoCaptions ? 'CC ON' : 'CC OFF'}</span>
        </button>

        {/* Trim Active Indicator */}
        {(effectiveStart > 0 || trimEnd) && (
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-amber-300 border border-slate-700 flex items-center gap-1.5 z-20">
            <Scissors className="w-3 h-3 text-amber-400" />
            <span>Trimmed: {formatTime(effectiveStart)} - {formatTime(effectiveEnd)}</span>
          </div>
        )}

        {/* In-Video Floating Captions Overlay */}
        {inVideoCaptions && activeCaption && (
          <div className="absolute bottom-4 left-0 right-0 px-4 sm:px-8 text-center pointer-events-auto z-20 transition-all animate-in fade-in duration-100">
            <div className="inline-block max-w-2xl px-4 py-2 rounded-xl bg-black/85 backdrop-blur-xs text-white text-xs sm:text-sm font-medium shadow-2xl border border-white/15 leading-relaxed">
              {activeCaption.speaker && (
                <span className="text-amber-400 font-semibold mr-1.5">{activeCaption.speaker}:</span>
              )}
              {renderTextWithVocab(activeCaption.text)}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/95 border-t border-slate-800 space-y-2.5">
        {/* Timeline Scrubber with Embedded Question Markers */}
        <div className="relative w-full group py-1">
          <div
            className={`relative h-2 w-full bg-slate-800 rounded-full overflow-hidden ${
              isControlledExternally ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
            }`}
            onClick={(e) => {
              if (isControlledExternally) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              seekTo(effectiveStart + clickPos * effectiveDuration);
            }}
          >
            {/* Watched boundary line for skip prevention */}
            {preventSkipping && isStudent && (
              <div
                className="absolute top-0 left-0 h-full bg-slate-700/60"
                style={{ width: `${watchedPercent}%` }}
              />
            )}

            {/* Current progress bar */}
            <div
              className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Question timestamp pins */}
          {questions.map((q, idx) => {
            const pinTime = Math.max(effectiveStart, Math.min(q.timestamp, effectiveEnd));
            const pos = Math.min(
              99,
              Math.max(1, ((pinTime - effectiveStart) / effectiveDuration) * 100)
            );
            const isAnswered = answeredQuestionIds.has(q.id);

            return (
              <button
                key={q.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isControlledExternally) seekTo(q.timestamp);
                }}
                disabled={isControlledExternally}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-125 z-10 cursor-pointer"
                style={{ left: `${pos}%` }}
                title={`Question ${idx + 1} at ${formatTime(q.timestamp)} (${q.type})`}
              >
                <span
                  className={`w-3 h-3 rounded-full border-2 ${
                    isAnswered
                      ? 'bg-emerald-400 border-emerald-600 shadow-sm'
                      : 'bg-amber-400 border-slate-950 shadow-md ring-2 ring-amber-500/50'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Lower Toolbar */}
        <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePlay}
              disabled={isControlledExternally}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (Space or K)' : 'Play (Space or K)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={rewind5s}
              disabled={isControlledExternally}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Rewind 5s (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={forward5s}
              disabled={isControlledExternally}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Forward 5s (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Time Indicator */}
            <div className="font-mono text-slate-300 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-400">{formatTime(effectiveEnd)}</span>
            </div>

            {preventSkipping && isStudent && (
              <span className="hidden md:inline text-[11px] text-amber-400/90 font-medium">
                · Skipping Locked
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Speed Selector (Keys 1-5) */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg">
              {speedOptions.map((spd, idx) => (
                <button
                  key={spd}
                  onClick={() => changeSpeed(spd)}
                  disabled={isControlledExternally}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Speed ${spd}x (Hotkey: ${idx + 1})`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Captions Toggle */}
            <button
              onClick={() => {
                const next = !inVideoCaptions;
                setInVideoCaptions(next);
                if (onToggleCaptions) onToggleCaptions();
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                inVideoCaptions
                  ? 'text-amber-400 bg-slate-800'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title={inVideoCaptions ? 'Turn in-video captions OFF' : 'Turn in-video captions ON'}
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Volume Mute */}
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
