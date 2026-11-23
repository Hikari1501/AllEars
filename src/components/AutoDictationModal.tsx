import React, { useState, useEffect } from 'react';
import { AutoDictationReport, Lesson } from '../types';
import {
  getAutoDictationReports,
  deleteAutoDictationReport,
  AUTO_DICTATION_REPORTS_EVENT,
} from '../utils/autoDictation';
import { analyzeCloseEndedFeedback } from '../utils/feedbackHelpers';
import {
  Sparkles,
  X,
  Play,
  SlidersHorizontal,
  Award,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  FileText,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface AutoDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  userId?: string;
  initialTab?: 'setup' | 'reports';
  highlightedReportId?: string | null;
  onStartDictation: (
    lesson: Lesson,
    minWordsPerBlank: number,
    maxWordsPerBlank: number,
    questionCount: number
  ) => void;
}

export const AutoDictationModal: React.FC<AutoDictationModalProps> = ({
  isOpen,
  onClose,
  lesson,
  userId,
  initialTab = 'setup',
  highlightedReportId = null,
  onStartDictation,
}) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'reports'>(initialTab);
  const [minWords, setMinWords] = useState<number>(1);
  const [maxWords, setMaxWords] = useState<number>(3);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [reports, setReports] = useState<AutoDictationReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(highlightedReportId);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (highlightedReportId) {
      setSelectedReportId(highlightedReportId);
    }
    const refresh = () => {
      const list = getAutoDictationReports(userId);
      setReports(list);
      if (highlightedReportId) {
        setSelectedReportId(highlightedReportId);
      } else if (list.length > 0 && !selectedReportId) {
        setSelectedReportId(list[0].id);
      }
    };
    refresh();
    window.addEventListener(AUTO_DICTATION_REPORTS_EVENT, refresh);
    return () => window.removeEventListener(AUTO_DICTATION_REPORTS_EVENT, refresh);
  }, [isOpen, initialTab, highlightedReportId, userId]);

  if (!isOpen) return null;

  const usableLines = (lesson?.captions || []).filter(
    (c) => typeof c.text === 'string' && c.text.trim().length > 0
  );
  const hasTranscript = usableLines.length > 0;

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const activeReport =
    reports.find((r) => r.id === selectedReportId) || (reports.length > 0 ? reports[0] : null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Auto-Dictation Practice
              </h3>
              {lesson && (
                <p className="text-[11px] text-slate-500 truncate">{lesson.title}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close Auto-Dictation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-6 pt-3 pb-2 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {lesson && (
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'setup'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New Dictation Set
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Device Reports ({reports.length})
            </button>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            <Shield className="w-3 h-3 text-amber-600" />
            <span>Private to This Device Only</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'setup' && lesson && (
            <div className="space-y-5">
              {!hasTranscript ? (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">No transcript available for this lesson</div>
                    <p className="text-rose-800 leading-relaxed">
                      Auto-Dictation generates fill-in-the-blank questions directly from the video/audio transcript. Please choose a lesson that includes captions or a transcript.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                      <span>How Auto-Dictation Works</span>
                    </div>
                    <p>
                      Sentences from this lesson&apos;s transcript ({usableLines.length} lines available) are automatically turned into fill-in-the-blank listening tasks (<span className="font-mono font-bold">_________</span>). Your questions and results stay strictly on your device and are never sent to the server.
                    </p>
                  </div>

                  {/* Option 1: Range of words per blank (min 1, max 5) */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">
                        1. Words per Blank Range (1 to 5 words)
                      </label>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                        {minWords} – {maxWords} {maxWords === 1 ? 'word' : 'words'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Minimum Words (1–5)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={minWords}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(5, Number(e.target.value)));
                            setMinWords(val);
                            if (val > maxWords) setMaxWords(val);
                          }}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={n === minWords ? 'font-bold text-amber-700' : ''}>
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Maximum Words (1–5)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={maxWords}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(5, Number(e.target.value)));
                            setMaxWords(val);
                            if (val < minWords) setMinWords(val);
                          }}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={n === maxWords ? 'font-bold text-amber-700' : ''}>
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Number of questions (1 to 10) */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">
                        2. Number of Dictation Questions (1 to 10)
                      </label>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                        {Math.min(questionCount, usableLines.length)} {Math.min(questionCount, usableLines.length) === 1 ? 'question' : 'questions'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                        className="w-full accent-amber-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <span key={n} className={n === questionCount ? 'font-bold text-amber-700' : ''}>
                            {n}
                          </span>
                        ))}
                      </div>
                      {questionCount > usableLines.length && (
                        <p className="text-[11px] text-amber-700 font-medium pt-1">
                          This transcript has {usableLines.length} segments, so {usableLines.length} questions will be generated.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onStartDictation(lesson, minWords, maxWords, questionCount);
                      onClose();
                    }}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs tracking-wide transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Generate & Start Auto-Dictation</span>
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Award className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">No Auto-Dictation reports yet</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Complete an Auto-Dictation practice session and your detailed score breakdown will appear here on your device.
                  </p>
                </div>
              ) : (
                <>
                  {/* Report Selector Strip */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Recent Dictation Sessions ({reports.length})
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {reports.map((rep) => {
                        const isSelected = activeReport?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            type="button"
                            onClick={() => setSelectedReportId(rep.id)}
                            className={`shrink-0 text-left px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-bold truncate max-w-[180px]">{rep.lessonTitle}</div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                              <span>{rep.percentage}%</span>
                              <span>·</span>
                              <span>
                                {rep.correctCount}/{rep.totalQuestions} exact
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Report Details */}
                  {activeReport && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {activeReport.lessonTitle}
                          </h4>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(activeReport.createdAt).toLocaleString()} · Blanks:{' '}
                            {activeReport.minWordsPerBlank}–{activeReport.maxWordsPerBlank} words
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-amber-500 text-slate-950 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5" />
                            <span>
                              {activeReport.totalScore}/{activeReport.maxScore} pts ({activeReport.percentage}%)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteAutoDictationReport(userId, activeReport.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this local report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {activeReport.results.map((item, idx) => {
                          const analysis = analyzeCloseEndedFeedback(
                            item.studentAnswer,
                            item.correctAnswer
                          );
                          return (
                            <div
                              key={item.questionId}
                              className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-800">Q{idx + 1}</span>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{formatSec(item.timestamp)}</span>
                                  </span>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                    item.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {item.isCorrect ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Correct</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>{analysis.statusLabel}</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              <p className="text-slate-800 font-medium leading-relaxed">{item.prompt}</p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Your Answer
                                  </div>
                                  {item.studentAnswer.trim() ? (
                                    <div className="flex flex-wrap gap-1">
                                      {analysis.tokens.map((tok, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                                            tok.status === 'correct'
                                              ? 'bg-emerald-100 text-emerald-900'
                                              : tok.status === 'misplaced'
                                              ? 'bg-sky-100 text-sky-900'
                                              : tok.status === 'missing'
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-rose-100 text-rose-900'
                                          }`}
                                        >
                                          {tok.text}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="italic text-slate-400">No answer submitted</span>
                                  )}
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                  <div className="text-[10px] font-bold uppercase text-emerald-700 mb-1">
                                    Expected Answer
                                  </div>
                                  <div className="font-mono font-bold text-emerald-950">
                                    {item.correctAnswer}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
