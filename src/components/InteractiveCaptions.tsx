import React, { useState, useEffect } from 'react';
import { CaptionSegment, VocabEntry } from '../types';
import { VocabPopover } from './VocabPopover';
import { Subtitles, AlignLeft, Search, ChevronDown } from 'lucide-react';
import {
  getSavedVocabList,
  toggleSaveVocabWord,
  PERSONAL_VOCAB_EVENT,
} from '../utils/personalVocab';

interface InteractiveCaptionsProps {
  captions: CaptionSegment[];
  difficultWords: VocabEntry[];
  currentTime: number;
  onSeek?: (time: number) => void;
  canSeek?: boolean;
  onWordClick?: (vocab: VocabEntry) => void;
  isTeacher?: boolean;
  onShowVocabToClass?: (vocab: VocabEntry) => void;
  isCollapsed?: boolean;
  onExpand?: () => void;
  userId?: string;
  lessonId?: string;
  lessonTitle?: string;
}

export const InteractiveCaptions: React.FC<InteractiveCaptionsProps> = ({
  captions,
  difficultWords,
  currentTime,
  onSeek,
  canSeek = true,
  onWordClick,
  isTeacher = false,
  onShowVocabToClass,
  isCollapsed = false,
  onExpand,
  userId,
  lessonId,
  lessonTitle,
}) => {
  const [selectedVocab, setSelectedVocab] = useState<VocabEntry | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedWordKeys, setSavedWordKeys] = useState<Set<string>>(() => {
    return new Set(getSavedVocabList(userId).map((w) => w.word.trim().toLowerCase()));
  });

  useEffect(() => {
    const syncSaved = () => {
      setSavedWordKeys(new Set(getSavedVocabList(userId).map((w) => w.word.trim().toLowerCase())));
    };
    syncSaved();
    window.addEventListener(PERSONAL_VOCAB_EVENT, syncSaved);
    return () => window.removeEventListener(PERSONAL_VOCAB_EVENT, syncSaved);
  }, [userId]);

  // Find the currently active caption line
  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end + 0.3
  );

  // Helper to color-code words
  const getVocabHighlightClass = (level: string) => {
    switch (level) {
      case 'A1':
        return 'bg-sky-100 text-sky-900 border-b-2 border-sky-500 hover:bg-sky-200';
      case 'A2':
        return 'bg-teal-100 text-teal-900 border-b-2 border-teal-500 hover:bg-teal-200';
      case 'B1':
        return 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500 hover:bg-emerald-200';
      case 'B2':
        return 'bg-amber-100 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-200';
      case 'C1':
        return 'bg-indigo-100 text-indigo-900 border-b-2 border-indigo-500 hover:bg-indigo-200';
      case 'C2':
        return 'bg-rose-100 text-rose-900 border-b-2 border-rose-500 hover:bg-rose-200';
      default:
        return 'bg-slate-200 text-slate-900 border-b-2 border-slate-400';
    }
  };

  // Render text and highlight matching vocabulary entries (including inflections)
  const renderTextWithVocab = (text: string) => {
    if (!difficultWords || difficultWords.length === 0) {
      return text;
    }

    const termPairs: { term: string; vocab: VocabEntry }[] = [];
    const seenTerms = new Set<string>();
    difficultWords.forEach((v) => {
      const candidates = [v.word, ...(v.inflections || [])];
      candidates.forEach((raw) => {
        const clean = (raw || '').trim();
        const key = clean.toLowerCase();
        if (clean && !seenTerms.has(key)) {
          seenTerms.add(key);
          termPairs.push({ term: clean, vocab: v });
        }
      });
    });

    if (termPairs.length === 0) return text;

    // Sort longest terms first so multi-word phrases and inflections match before base fragments
    termPairs.sort((a, b) => b.term.length - a.term.length);
    const termLookup = new Map<string, VocabEntry>(
      termPairs.map((item) => [item.term.toLowerCase(), item.vocab])
    );

    const pattern = new RegExp(
      `\\b(${termPairs.map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
      'gi'
    );

    const parts = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const matchedVocab = termLookup.get(matchedText.toLowerCase());

      if (matchedVocab) {
        const viHover = matchedVocab.vietnameseTranslation?.trim();
        parts.push(
          <span
            key={`vocab-${matchIndex}-${matchedText}`}
            className="relative inline-block group/vocab mx-0.5"
          >
            {viHover && (
              <span className="pointer-events-none opacity-0 group-hover/vocab:opacity-100 transition-opacity duration-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-lg bg-slate-950/95 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold whitespace-nowrap max-w-[240px] truncate shadow-xl z-30">
                {viHover}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedVocab(matchedVocab);
                if (onWordClick) {
                  onWordClick(matchedVocab);
                }
              }}
              className={`inline-block px-1 py-0.5 rounded cursor-pointer font-medium transition-all ${getVocabHighlightClass(
                matchedVocab.cefrLevel
              )}`}
              title={
                viHover
                  ? undefined
                  : `Click to view ${matchedVocab.cefrLevel} definition for "${matchedText}"`
              }
            >
              {matchedText}
              <span className="ml-1 text-[9px] uppercase font-bold tracking-tight opacity-75">
                {matchedVocab.cefrLevel}
              </span>
            </button>
          </span>
        );
      } else {
        parts.push(matchedText);
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const filteredCaptions = searchQuery.trim()
    ? captions.filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : captions;

  if (isCollapsed) {
    return (
      <div className="w-full">
        <div className="bg-slate-900 text-slate-300 rounded-xl px-4 py-3 shadow-xs border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Subtitles className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-300">Synchronized Captions</span>
            <span className="text-[11px] text-slate-500">· Collapsed (Teacher CC is OFF)</span>
          </div>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Turn Teacher CC ON</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Subtitle Banner below player */}
      <div className="relative bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-800 transition-all">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Subtitles className="w-4 h-4 text-amber-400" />
            <span className="font-medium text-slate-300">Synchronized Captions</span>
            <span className="text-[11px] text-slate-500">· Click colored words for definitions</span>
          </div>

          <button
            onClick={() => setShowFullTranscript(!showFullTranscript)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>{showFullTranscript ? 'Hide Full Transcript' : 'Full Transcript'}</span>
          </button>
        </div>

        {/* Current Active Caption Display */}
        <div className="min-h-[48px] flex items-center justify-center text-center pt-2">
          {activeCaption ? (
            <div className="text-base sm:text-lg font-medium leading-relaxed tracking-wide text-slate-100 max-w-2xl mx-auto">
              {activeCaption.speaker &&
                activeCaption.speaker.trim() &&
                activeCaption.speaker.trim().toLowerCase() !== 'speaker' && (
                  <span className="text-amber-400 font-semibold mr-2">
                    {activeCaption.speaker}:
                  </span>
                )}
              {renderTextWithVocab(activeCaption.text)}
            </div>
          ) : (
            <span className="text-sm text-slate-500 italic">
              (Listening for speech... playback synchronized)
            </span>
          )}
        </div>

        {/* Vocabulary Color Legend */}
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-center gap-3 sm:gap-4 text-[11px] flex-wrap text-slate-400">
          <span className="text-slate-500">Vocabulary:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
            <span>A1</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-400"></span>
            <span>A2</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span>
            <span>B1</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
            <span>B2</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400"></span>
            <span>C1</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400"></span>
            <span>C2</span>
          </span>
        </div>
      </div>

      {/* Expandable Full Transcript Drawer */}
      {showFullTranscript && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs transition-all space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-amber-600" />
              <span>Full Lesson Transcript</span>
            </h4>
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 pt-5 divide-y divide-slate-100">
            {filteredCaptions.map((cap) => {
              const isActive = currentTime >= cap.start && currentTime <= cap.end;
              const formatTime = (sec: number) => {
                const m = Math.floor(sec / 60);
                const s = Math.floor(sec % 60);
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              };

              return (
                <div
                  key={cap.id}
                  className={`pt-2 flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    isActive ? 'bg-amber-50/80 border-amber-200 font-medium' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    disabled={!canSeek}
                    onClick={() => onSeek && onSeek(cap.start)}
                    className={`shrink-0 font-mono text-xs px-2 py-0.5 rounded transition-colors ${
                      canSeek
                        ? 'text-amber-800 bg-amber-100/70 hover:bg-amber-200 cursor-pointer'
                        : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                    }`}
                    title={canSeek ? `Jump to ${formatTime(cap.start)}` : 'Seeking locked during lesson'}
                  >
                    {formatTime(cap.start)}
                  </button>
                  <div className="text-sm text-slate-800 leading-relaxed flex-1">
                    {cap.speaker &&
                      cap.speaker.trim() &&
                      cap.speaker.trim().toLowerCase() !== 'speaker' && (
                        <span className="font-semibold text-slate-900 mr-1.5">{cap.speaker}:</span>
                      )}
                    {renderTextWithVocab(cap.text)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vocabulary Modal Popup */}
      {selectedVocab && (
        <VocabPopover
          vocab={selectedVocab}
          onClose={() => setSelectedVocab(null)}
          isTeacher={isTeacher}
          onShowToClass={
            onShowVocabToClass ? () => onShowVocabToClass(selectedVocab) : undefined
          }
          isSaved={savedWordKeys.has(selectedVocab.word.trim().toLowerCase())}
          onToggleSave={
            !isTeacher
              ? () => {
                  const res = toggleSaveVocabWord(userId, selectedVocab, {
                    id: lessonId,
                    title: lessonTitle,
                  });
                  setSavedWordKeys(new Set(res.list.map((w) => w.word.trim().toLowerCase())));
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
