import React, { useState, useEffect } from 'react';
import { SavedVocabItem } from '../types';
import {
  getSavedVocabList,
  fetchSavedVocabFromServer,
  removeSavedVocabWord,
  PERSONAL_VOCAB_EVENT,
} from '../utils/personalVocab';
import {
  BookOpen,
  X,
  Volume2,
  Trash2,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  Bookmark,
} from 'lucide-react';

interface PersonalVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const PersonalVocabModal: React.FC<PersonalVocabModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [savedWords, setSavedWords] = useState<SavedVocabItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quizMode, setQuizMode] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => setSavedWords(getSavedVocabList(userId));
    refresh();
    fetchSavedVocabFromServer(userId).then((items) => setSavedWords(items));
    window.addEventListener(PERSONAL_VOCAB_EVENT, refresh);
    return () => window.removeEventListener(PERSONAL_VOCAB_EVENT, refresh);
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRemove = (word: string) => {
    const updated = removeSavedVocabWord(userId, word);
    setSavedWords(updated);
  };

  const filtered = savedWords.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.word.toLowerCase().includes(q) ||
      (item.definition || '').toLowerCase().includes(q) ||
      (item.vietnameseTranslation || '').toLowerCase().includes(q) ||
      (item.lessonTitle || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-amber-500 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                My Saved Vocabulary ({savedWords.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Personal vocabulary list saved on your account/device for review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedWords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuizMode((prev) => !prev);
                  setRevealedCards({});
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  quizMode
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Hide meanings so you can test yourself before clicking Reveal"
              >
                {quizMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{quizMode ? 'Study Quiz: ON' : 'Self-Test Mode'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Close My Vocabulary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {savedWords.length > 0 && (
          <div className="px-6 py-3 bg-white border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved words, Vietnamese meanings, or lessons..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        {/* Word Cards List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50/40">
          {savedWords.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No saved vocabulary yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                During Practice Mode, click any glossed word or use the bookmark button in the Glossed Words list to save words for review here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No saved words match "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filtered.map((item) => {
                const isRevealed = !quizMode || Boolean(revealedCards[item.word]);
                const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(
                  item.cambridgeSlug || item.word.toLowerCase()
                )}`;

                return (
                  <div
                    key={item.word}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-base font-bold text-slate-900">{item.word}</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-200">
                              {item.cefrLevel}
                            </span>
                            <span className="text-[11px] italic text-slate-500">
                              {item.partOfSpeech}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.phonetic && (
                              <span className="text-xs font-mono text-slate-500">
                                {item.phonetic}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => speakWord(item.word)}
                              className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                              title="Listen to pronunciation"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemove(item.word)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove from My Vocabulary"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isRevealed ? (
                        <div className="space-y-2 animate-in fade-in duration-150">
                          {item.vietnameseTranslation && item.vietnameseTranslation.trim() && (
                            <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-950">
                              {item.vietnameseTranslation}
                            </div>
                          )}
                          {item.definition && item.definition.trim() && (
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {item.definition}
                            </p>
                          )}
                          {item.example && item.example.trim() && (
                            <p className="text-[11px] italic text-slate-500 border-l-2 border-amber-400 pl-2">
                              "{item.example}"
                            </p>
                          )}
                          {item.inflections && item.inflections.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.inflections.map((form, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] border border-slate-200"
                                >
                                  {form}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedCards((prev) => ({ ...prev, [item.word]: true }))
                          }
                          className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Reveal Meaning</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 truncate max-w-[160px]" title={item.lessonTitle}>
                        {item.lessonTitle ? `From: ${item.lessonTitle}` : 'Saved Vocabulary'}
                      </span>
                      <a
                        href={cambridgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline shrink-0"
                      >
                        <span>Cambridge</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
