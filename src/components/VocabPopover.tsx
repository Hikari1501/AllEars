import React from 'react';
import { Volume2, ExternalLink, X, BookOpen, Radio } from 'lucide-react';
import { VocabEntry } from '../types';

interface VocabPopoverProps {
  vocab: VocabEntry;
  onClose: () => void;
  isTeacher?: boolean;
  onShowToClass?: () => void;
  isShown?: boolean;
  onUnshowFromClass?: () => void;
}

export const VocabPopover: React.FC<VocabPopoverProps> = ({
  vocab,
  onClose,
  isTeacher,
  onShowToClass,
  isShown = false,
  onUnshowFromClass,
}) => {
  const speakWord = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(vocab.word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getCefrBadgeStyle = (level: string) => {
    switch (level) {
      case 'B1':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'B2':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'C1':
        return 'bg-indigo-50 text-indigo-800 border-indigo-300';
      case 'C2':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(vocab.cambridgeSlug || vocab.word.toLowerCase())}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">Vocabulary Glossary</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close vocabulary card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Word Hero */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{vocab.word}</h3>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getCefrBadgeStyle(vocab.cefrLevel)}`}>
                  {vocab.cefrLevel}
                </span>
                <span className="text-xs italic text-slate-500">{vocab.partOfSpeech}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-slate-500">{vocab.phonetic}</span>
                <button
                  onClick={speakWord}
                  className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Definition */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
            <div className="text-xs font-medium text-slate-500 mb-1">Definition</div>
            <p className="text-sm text-slate-800 leading-relaxed">{vocab.definition}</p>
          </div>

          {/* Example in Context */}
          <div className="border-l-2 border-amber-500 pl-3 py-1">
            <div className="text-xs font-medium text-slate-500 mb-0.5">Illustrative Example</div>
            <p className="text-sm italic text-slate-700">"{vocab.example}"</p>
          </div>

          {/* External Cambridge Dictionary Link & Teacher Broadcast */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <a
              href={cambridgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline transition-colors"
            >
              <span>Cambridge Dictionary</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="flex items-center gap-2">
              {isTeacher && isShown && onUnshowFromClass && (
                <button
                  type="button"
                  onClick={() => {
                    onUnshowFromClass();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Unshow from Class</span>
                </button>
              )}
              {isTeacher && !isShown && onShowToClass && (
                <button
                  type="button"
                  onClick={() => {
                    onShowToClass();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Show to Class</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
