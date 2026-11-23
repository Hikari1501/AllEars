import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question, StudentAnswer } from '../types';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Award,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  Check,
  Lock,
  Unlock,
  X,
  BookOpen,
  Lightbulb,
  ChevronDown,
  Image as ImageIcon,
  Eye,
  KeyRound,
} from 'lucide-react';
import { MatchingPairsCanvas } from './MatchingPairsCanvas';
import { DragAndDropCanvas } from './DragAndDropCanvas';
import { playSuccessChime, playWrongAnswerSound } from '../utils/soundEffects';
import { getQuestionFeedbackStatus } from '../utils/feedbackHelpers';

interface StudentQuestionsPanelProps {
  questions: Question[];
  currentActiveQuestionId: string | null;
  answers: Record<string, StudentAnswer>;
  onAnswerSubmit: (answer: StudentAnswer) => void;
  onRewind?: (seconds: number) => void;
  onSeek?: (timestamp: number) => void;
  onTipSeek?: (timestamp: number) => void;
  onContinueWatching?: () => void;
  isLiveMode?: boolean;
  revealedFeedbackForQuestionId?: string | null;
  revealedKeyQuestionIds?: string[];
  allowRewind?: boolean;
  allowEditAnswer?: boolean;
  backgroundInfoText?: string;
  backgroundInfoImageUrl?: string;
}

export const StudentQuestionsPanel: React.FC<StudentQuestionsPanelProps> = ({
  questions,
  currentActiveQuestionId,
  answers,
  onAnswerSubmit,
  onRewind,
  onSeek,
  onTipSeek,
  onContinueWatching,
  isLiveMode = false,
  revealedFeedbackForQuestionId = null,
  revealedKeyQuestionIds = [],
  allowRewind = true,
  allowEditAnswer = true,
  backgroundInfoText,
  backgroundInfoImageUrl,
}) => {
  // Local pending states for non-submitted inputs
  const [selectedChoices, setSelectedChoices] = useState<Record<string, Set<string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [matchingSelections, setMatchingSelections] = useState<Record<string, Record<string, string>>>({});
  const [activeMatchingLeft, setActiveMatchingLeft] = useState<Record<string, string | null>>({});
  const [revealedTips, setRevealedTips] = useState<Record<string, boolean>>({});
  const [dragDropPlacements, setDragDropPlacements] = useState<Record<string, Record<string, string[]>>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [revealedCorrectAnswers, setRevealedCorrectAnswers] = useState<Record<string, boolean>>({});

  const questionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoOpenedTipsRef = useRef<Record<string, boolean>>({});

  // Auto-scroll to active question when it triggers
  useEffect(() => {
    if (currentActiveQuestionId && questionCardRefs.current[currentActiveQuestionId]) {
      questionCardRefs.current[currentActiveQuestionId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentActiveQuestionId]);

  // Auto-open Question Tip once if a wrong answer exists (e.g. synced session or feedback reveal)
  useEffect(() => {
    const toOpen: Record<string, boolean> = {};
    questions.forEach((q) => {
      const ans = answers[q.id];
      const hasTip = Boolean(q.tip?.trim() || (q.tipTimestamps && q.tipTimestamps.length > 0));
      if (
        ans &&
        !ans.isCorrect &&
        q.type !== 'open_ended' &&
        hasTip &&
        !autoOpenedTipsRef.current[q.id]
      ) {
        autoOpenedTipsRef.current[q.id] = true;
        toOpen[q.id] = true;
      }
    });
    if (Object.keys(toOpen).length > 0) {
      setRevealedTips((prev) => ({ ...prev, ...toOpen }));
    }
  }, [answers, questions]);

  const formatSec = (seconds?: number | null) => {
    if (seconds === undefined || seconds === null || seconds < 0) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isQuestionEditLocked = (questionId: string) =>
    (Boolean(answers[questionId]) && !allowEditAnswer) ||
    (!isLiveMode && Boolean(revealedCorrectAnswers[questionId]));

  const handleChoiceClick = (question: Question, optionId: string) => {
    if (isQuestionEditLocked(question.id)) return;
    const isMulti = question.allowMultipleAnswers;
    const currentSet = new Set(selectedChoices[question.id] || []);

    if (isMulti) {
      if (currentSet.has(optionId)) {
        currentSet.delete(optionId);
      } else {
        currentSet.add(optionId);
      }
      setSelectedChoices((prev) => ({
        ...prev,
        [question.id]: currentSet,
      }));
    } else {
      // Single choice: select immediately
      const newSet = new Set([optionId]);
      setSelectedChoices((prev) => ({
        ...prev,
        [question.id]: newSet,
      }));

      // In single choice, evaluate and submit immediately
      evaluateAndSubmit(question, optionId);
    }
  };

  const handleMultiSubmit = (question: Question) => {
    if (isQuestionEditLocked(question.id)) return;
    const chosen = Array.from(selectedChoices[question.id] || []);
    if (chosen.length === 0) return;
    evaluateAndSubmit(question, chosen);
  };

  const handleTextSubmit = (question: Question) => {
    if (isQuestionEditLocked(question.id)) return;
    const text = (textAnswers[question.id] || '').trim();
    if (!text) return;
    evaluateAndSubmit(question, text);
  };

  const handleMatchingPair = (question: Question, left: string, right: string) => {
    if (isQuestionEditLocked(question.id)) return;
    const current = { ...(matchingSelections[question.id] || {}) };
    if (!right) {
      delete current[left];
    } else {
      // If another left item was already mapped to this right item, remove the previous mapping
      Object.keys(current).forEach((k) => {
        if (current[k] === right) delete current[k];
      });
      current[left] = right;
    }
    setMatchingSelections((prev) => ({
      ...prev,
      [question.id]: current,
    }));
    setActiveMatchingLeft((prev) => ({
      ...prev,
      [question.id]: null,
    }));

    // If all pairs connected, submit automatically
    const totalRequired = question.matchingPairs?.length || 0;
    if (Object.keys(current).length === totalRequired) {
      evaluateAndSubmit(question, current);
    }
  };

  const evaluateAndSubmit = (question: Question, rawAnswer: any) => {
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.type === 'multiple_choice') {
      if (question.allowMultipleAnswers) {
        const correctList = question.correctAnswers || [question.correctAnswer || 'a'];
        const chosenList = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
        // Multi-choice: award points only when students choose all correct options (0 points if wrong or missing)
        const isMatch =
          correctList.length === chosenList.length &&
          correctList.every((id) => chosenList.includes(id));
        isCorrect = isMatch;
        pointsEarned = isCorrect ? question.points || 10 : 0;
      } else {
        const correct = question.correctAnswer || 'a';
        isCorrect = String(rawAnswer).toLowerCase() === correct.toLowerCase();
        pointsEarned = isCorrect ? question.points || 10 : 0;
      }
    } else if (question.type === 'true_false') {
      const correct = question.correctAnswer || 'true';
      isCorrect = String(rawAnswer).toLowerCase() === correct.toLowerCase();
      pointsEarned = isCorrect ? question.points || 10 : 0;
    } else if (question.type === 'close_ended') {
      const expected = (question.correctAnswer || '').trim().toLowerCase();
      const actual = String(rawAnswer).trim().toLowerCase();
      isCorrect = actual === expected;
      pointsEarned = isCorrect ? question.points || 10 : 0;
    } else if (question.type === 'matching') {
      const pairs = question.matchingPairs || [];
      const userPairs = rawAnswer || {};
      const correctCount = pairs.filter((p) => userPairs[p.left] === p.right).length;
      isCorrect = pairs.length > 0 && correctCount === pairs.length;
      // Matching: award points for each line students match right
      if (pairs.length > 0) {
        pointsEarned = Math.round((correctCount / pairs.length) * (question.points || 10));
      } else {
        pointsEarned = 0;
      }
    } else if (question.type === 'drag_and_drop') {
      const categories = question.categories || [];
      const userPlacements: Record<string, string[]> = rawAnswer || {};
      let totalItems = 0;
      let correctCount = 0;

      categories.forEach((cat) => {
        const expectedItems = cat.items || [];
        totalItems += expectedItems.length;
        const placedInCat = userPlacements[cat.id] || [];
        expectedItems.forEach((expItem) => {
          if (
            placedInCat.some(
              (it) => it.trim().toLowerCase() === expItem.trim().toLowerCase()
            )
          ) {
            correctCount++;
          }
        });
      });

      isCorrect = totalItems > 0 && correctCount === totalItems;
      // Award points for each item the student drags correctly
      if (totalItems > 0) {
        pointsEarned = Math.round((correctCount / totalItems) * (question.points || 10));
      } else {
        pointsEarned = 0;
      }
    } else if (question.type === 'open_ended') {
      isCorrect = true;
      // Open-ended questions: do not award students with points
      pointsEarned = 0;
    }

    // Play sound on students' device: chime for all correct, gentle cue for wrong answer
    if (isCorrect && question.type !== 'open_ended') {
      playSuccessChime();
    } else if (!isCorrect && question.type !== 'open_ended') {
      playWrongAnswerSound();
    }

    // Automatically open Question Tip (if available) when student gets a wrong answer
    const hasTipContent = Boolean(
      question.tip?.trim() || (question.tipTimestamps && question.tipTimestamps.length > 0)
    );
    if (!isCorrect && question.type !== 'open_ended' && hasTipContent) {
      autoOpenedTipsRef.current[question.id] = true;
      setRevealedTips((prev) => ({
        ...prev,
        [question.id]: true,
      }));
    }

    // Increment submission attempt counter for this question
    setAttemptCounts((prev) => ({
      ...prev,
      [question.id]: (prev[question.id] || 0) + 1,
    }));

    const submission: StudentAnswer = {
      questionId: question.id,
      answer: rawAnswer,
      isCorrect,
      pointsEarned,
      submittedAt: Date.now(),
    };

    onAnswerSubmit(submission);
  };

  const answeredCount = Object.keys(answers).length;
  const totalScore = Object.values(answers).reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
  const maxScore = questions.reduce((sum, q) => sum + (q.type === 'open_ended' ? 0 : q.points), 0);

  // Group questions: general / no-pause questions come first, followed by timestamped questions
  const orderedQuestions = useMemo(() => {
    const general = questions.filter((q) => q.timestamp == null || q.timestamp < 0);
    const timestamped = questions
      .filter((q) => typeof q.timestamp === 'number' && q.timestamp >= 0)
      .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
    return [...general, ...timestamped];
  }, [questions]);

  const hasBackgroundInfo = Boolean(
    backgroundInfoText?.trim() || backgroundInfoImageUrl?.trim()
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full max-h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-20 backdrop-blur-xs flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Questions & Tasks</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Answer checkpoints as video plays or at your own pace
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Answered</div>
            <div className="text-xs font-mono font-bold text-slate-800">
              {answeredCount} / {questions.length}
            </div>
          </div>
          <div className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold font-mono shadow-xs flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            <span>{totalScore} pts</span>
          </div>
        </div>
      </div>

      {/* Questions Scrollable Feed */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 divide-y divide-slate-100">
        {/* Background Information (Shown above questions if present) */}
        {hasBackgroundInfo && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Background Information</span>
            </div>
            {backgroundInfoText && backgroundInfoText.trim().length > 0 && (
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                {backgroundInfoText}
              </p>
            )}
            {backgroundInfoImageUrl && backgroundInfoImageUrl.trim().length > 0 && (
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center p-1">
                <img
                  src={backgroundInfoImageUrl}
                  alt="Lesson Background Information"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                  className="max-h-52 max-w-full object-contain rounded"
                />
              </div>
            )}
          </div>
        )}

        {orderedQuestions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No questions added to this lesson yet.
          </div>
        ) : (
          orderedQuestions.map((q, idx) => {
            const isTimestamped = typeof q.timestamp === 'number' && q.timestamp >= 0;
            const timeStr = formatSec(q.timestamp);
            const isActive = currentActiveQuestionId === q.id;
            const existingAnswer = answers[q.id];
            const isAnswered = !!existingAnswer;
            const attempts = attemptCounts[q.id] || (isAnswered ? 1 : 0);
            const isWrongPractice =
              !isLiveMode && isAnswered && !existingAnswer.isCorrect && q.type !== 'open_ended';
            const hasClickedShowAnswer = Boolean(revealedCorrectAnswers[q.id]);
            const isLockedAfterReveal = !isLiveMode && hasClickedShowAnswer;
            const isInputDisabled = (isAnswered && !allowEditAnswer) || isLockedAfterReveal;
            const hasTeacherRevealedKey = Boolean(
              isLiveMode &&
                (revealedKeyQuestionIds.includes(q.id) ||
                  revealedFeedbackForQuestionId === q.id)
            );
            const isFeedbackVisible = isAnswered;
            const canShowCorrectAnswer = isLiveMode
              ? (isAnswered && q.type === 'open_ended') || hasTeacherRevealedKey
              : isAnswered &&
                (existingAnswer.isCorrect || q.type === 'open_ended' || hasClickedShowAnswer);

            return (
              <div
                key={q.id}
                ref={(el) => {
                  questionCardRefs.current[q.id] = el;
                }}
                className={`pt-4 first:pt-0 transition-all ${
                  isActive ? 'scale-[1.01]' : ''
                }`}
              >
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'border-2 border-amber-500 bg-amber-50/70 shadow-md ring-2 ring-amber-400/30'
                      : isAnswered
                      ? 'border-slate-200 bg-slate-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        Q{idx + 1}
                      </span>

                      {/* Timestamp Badge or General Badge */}
                      {isTimestamped ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSeek && q.timestamp !== undefined && q.timestamp !== null) {
                              onSeek(q.timestamp);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-extrabold animate-pulse'
                              : 'bg-amber-100/90 text-amber-900 hover:bg-amber-200'
                          }`}
                          title="Click to jump to this checkpoint"
                        >
                          <Clock className="w-3 h-3" />
                          <span>At {timeStr}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Layers className="w-3 h-3" />
                          <span>Whole Video / General</span>
                        </span>
                      )}

                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                        {q.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAnswered && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.type === 'open_ended'
                              ? 'bg-indigo-100 text-indigo-800'
                              : (existingAnswer.pointsEarned || 0) > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {q.type === 'open_ended' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                              <span>Submitted</span>
                            </>
                          ) : (existingAnswer.pointsEarned || 0) > 0 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>+{existingAnswer.pointsEarned} pts</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>0 pts</span>
                            </>
                          )}
                        </span>
                      )}

                      {isActive && (
                        <span className="px-2 py-0.5 bg-amber-600 text-white rounded text-[9px] font-black uppercase tracking-wider animate-pulse">
                          Checkpoint Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Question Audio Controls: Rewind & Continue */}
                  {isActive && (
                    <div className="mb-3 p-2.5 bg-amber-100/80 border border-amber-300 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {allowRewind && onRewind && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRewind(5)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Rewind video 5 seconds to re-listen"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Rewind 5s</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onRewind(10)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Rewind video 10 seconds to re-listen"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Rewind 10s</span>
                            </button>
                          </>
                        )}
                      </div>

                      {onContinueWatching && (
                        <button
                          type="button"
                          onClick={onContinueWatching}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer ml-auto"
                        >
                          <span>Resume Video</span>
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Question Prompt */}
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug mb-2.5">
                    {q.prompt}
                  </div>

                  {/* Attached Question Image (Only shown if image URL exists) */}
                  {q.imageUrl && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-1 shadow-2xs">
                      <img
                        src={q.imageUrl}
                        alt="Question Illustration"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        className="max-h-56 max-w-full object-contain rounded-lg transition-transform hover:scale-101"
                      />
                    </div>
                  )}

                  {/* Question Tip (Only shown if tip text or tip timestamps exist; collapsed by default, auto-opens on wrong answer) */}
                  {(q.tip?.trim() || (q.tipTimestamps && q.tipTimestamps.length > 0)) && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedTips((prev) => ({
                            ...prev,
                            [q.id]: !prev[q.id],
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                          revealedTips[q.id]
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-amber-50 hover:bg-amber-100/80 text-amber-800 border-amber-200'
                        }`}
                        title={revealedTips[q.id] ? 'Hide Question Tip' : 'View Question Tip'}
                        aria-label={revealedTips[q.id] ? 'Hide Question Tip' : 'View Question Tip'}
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            revealedTips[q.id] ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {revealedTips[q.id] && (
                        <div className="mt-1.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed shadow-2xs animate-in fade-in duration-150">
                          <div className="space-y-2">
                            {q.tip && q.tip.trim().length > 0 && (
                              <p className="whitespace-pre-line">{q.tip}</p>
                            )}
                            {q.tipTimestamps && q.tipTimestamps.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {q.tipTimestamps.map((ts, tsIdx) => {
                                  const label = formatSec(ts) || '00:00';
                                  const jumpHandler = !isLiveMode ? (onTipSeek || onSeek) : undefined;
                                  return jumpHandler ? (
                                    <button
                                      key={`${q.id}-tip-ts-${tsIdx}-${ts}`}
                                      type="button"
                                      onClick={() => jumpHandler(ts)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                                      title={`Jump video to ${label}`}
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current text-amber-700" />
                                      <span>{label}</span>
                                    </button>
                                  ) : (
                                    <span
                                      key={`${q.id}-tip-ts-${tsIdx}-${ts}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 text-amber-900 border border-amber-300 font-mono text-[11px] font-bold"
                                    >
                                      <Clock className="w-2.5 h-2.5 text-amber-700" />
                                      <span>{label}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Answer Status / Edit Permission Notice */}
                  {isAnswered && !isLockedAfterReveal && (
                    <div className="flex items-center gap-1.5 text-[11px] mb-2.5 font-medium">
                      {!allowEditAnswer ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Answer submitted</span>
                        </span>
                      ) : isLiveMode ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg">
                          <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Answer submitted</span>
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Interactive Question Input Components */}
                  <div className="space-y-2 text-xs">
                    {/* MULTIPLE CHOICE */}
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="space-y-1.5">
                        {q.allowMultipleAnswers && (
                          <div className="text-[10px] text-indigo-700 font-bold mb-1">
                            * Select all that apply, then click {isAnswered ? 'Update' : 'Submit'}
                          </div>
                        )}
                        {q.options.map((opt) => {
                          const isSelected = q.allowMultipleAnswers
                            ? selectedChoices[q.id]
                              ? selectedChoices[q.id].has(opt.id)
                              : Array.isArray(existingAnswer?.answer) &&
                                existingAnswer.answer.includes(opt.id)
                            : existingAnswer?.answer === opt.id ||
                              selectedChoices[q.id]?.has(opt.id);

                          const expectedList = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []);
                          const isOptCorrect = expectedList.includes(opt.id) || expectedList.includes(opt.text);

                          let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                          if (isSelected) {
                            buttonStyle = 'bg-amber-500/15 border-amber-500 text-slate-950 font-semibold';
                          }

                          if (canShowCorrectAnswer) {
                            if (isOptCorrect) {
                              buttonStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-400/40 shadow-2xs';
                            } else if (isSelected && !isOptCorrect) {
                              buttonStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                            } else {
                              buttonStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          } else if (isFeedbackVisible && q.allowMultipleAnswers && isSelected) {
                            buttonStyle = isOptCorrect
                              ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-400/40 shadow-2xs'
                              : 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                          } else if (isFeedbackVisible && !q.allowMultipleAnswers && isSelected && !existingAnswer?.isCorrect) {
                            buttonStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                          }

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isInputDisabled}
                              onClick={() => handleChoiceClick(q, opt.id)}
                              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                                isInputDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${buttonStyle}`}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 uppercase ${
                                    canShowCorrectAnswer && isOptCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : canShowCorrectAnswer && isSelected && !isOptCorrect
                                      ? 'bg-rose-600 text-white'
                                      : isFeedbackVisible && q.allowMultipleAnswers && isSelected
                                      ? isOptCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-rose-600 text-white'
                                      : isFeedbackVisible && !canShowCorrectAnswer && !q.allowMultipleAnswers && isSelected
                                      ? 'bg-rose-600 text-white'
                                      : isSelected
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {opt.id}
                                </span>
                                <span className="leading-snug">{opt.text}</span>
                              </div>

                              {/* Right Feedback / Selection Status Badge */}
                              {canShowCorrectAnswer ? (
                                isOptCorrect ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                    <Check className="w-3.5 h-3.5 text-emerald-800 stroke-[3]" />
                                    <span>{isSelected ? 'Your Answer (Correct!)' : 'Correct Answer'}</span>
                                  </span>
                                ) : isSelected ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                    <X className="w-3.5 h-3.5 text-rose-800 stroke-[3]" />
                                    <span>Your Answer (Incorrect)</span>
                                  </span>
                                ) : null
                              ) : isFeedbackVisible && q.allowMultipleAnswers && isSelected ? (
                                isOptCorrect ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                    <Check className="w-3.5 h-3.5 text-emerald-800 stroke-[3]" />
                                    <span>Correct</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                    <X className="w-3.5 h-3.5 text-rose-800 stroke-[3]" />
                                    <span>Incorrect</span>
                                  </span>
                                )
                              ) : isFeedbackVisible && !q.allowMultipleAnswers && isSelected && !existingAnswer?.isCorrect ? (
                                <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-bold flex items-center gap-1 shrink-0">
                                  <X className="w-3.5 h-3.5 text-rose-800 stroke-[3]" />
                                  <span>Your Answer (Incorrect)</span>
                                </span>
                              ) : (
                                isSelected && <Check className="w-4 h-4 text-amber-700 shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        {q.allowMultipleAnswers && !isLockedAfterReveal && (
                          <button
                            type="button"
                            onClick={() => handleMultiSubmit(q)}
                            disabled={(!selectedChoices[q.id] || selectedChoices[q.id].size === 0) || isInputDisabled}
                            className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            {isAnswered ? 'Update Answer' : 'Submit Answer'} ({selectedChoices[q.id]?.size || 0} selected)
                          </button>
                        )}
                      </div>
                    )}

                    {/* TRUE / FALSE */}
                    {q.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-2">
                        {['true', 'false'].map((val) => {
                          const isSelected =
                            existingAnswer?.answer === val ||
                            selectedChoices[q.id]?.has(val);
                          const correctVal = (q.correctAnswer || 'true').toLowerCase();
                          const isThisCorrect = correctVal === val;

                          let tfStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                          if (isSelected) {
                            tfStyle = val === 'true'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-rose-600 text-white border-rose-700';
                          }

                          if (canShowCorrectAnswer) {
                            if (isThisCorrect) {
                              tfStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-400/40 shadow-2xs';
                            } else if (isSelected && !isThisCorrect) {
                              tfStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                            } else {
                              tfStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          } else if (isFeedbackVisible && isSelected && !existingAnswer?.isCorrect) {
                            tfStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                          }

                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={isInputDisabled}
                              onClick={() => handleChoiceClick(q, val)}
                              className={`py-2 px-3 rounded-lg border font-bold capitalize transition-all flex items-center justify-between ${
                                isInputDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${tfStyle}`}
                            >
                              <span>{val}</span>
                              {canShowCorrectAnswer && isThisCorrect && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center gap-0.5">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>{isSelected ? 'Correct!' : 'Key'}</span>
                                </span>
                              )}
                              {isFeedbackVisible && isSelected && !isThisCorrect && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-bold flex items-center gap-0.5">
                                  <X className="w-3 h-3 stroke-[2.5]" />
                                  <span>Your Choice</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* CLOSE-ENDED / FILL IN THE BLANK */}
                    {q.type === 'close_ended' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={isInputDisabled}
                            value={textAnswers[q.id] !== undefined ? textAnswers[q.id] : (existingAnswer?.answer || '')}
                            onChange={(e) =>
                              setTextAnswers((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTextSubmit(q);
                            }}
                            placeholder="Type your answer here..."
                            className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                          {!isLockedAfterReveal && (
                            <button
                              type="button"
                              disabled={isInputDisabled}
                              onClick={() => handleTextSubmit(q)}
                              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
                            >
                              {isAnswered ? 'Update' : 'Submit'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MATCHING PAIRS */}
                    {q.type === 'matching' && q.matchingPairs && (
                      <div className="space-y-3">
                        <MatchingPairsCanvas
                          questionId={q.id}
                          pairs={q.matchingPairs}
                          currentSelections={matchingSelections[q.id] || {}}
                          onPairMatch={(left, right) => handleMatchingPair(q, left, right)}
                          disabled={isInputDisabled}
                          isFeedbackVisible={isFeedbackVisible}
                        />
                      </div>
                    )}

                    {/* DRAG AND DROP (CATEGORIZATION) */}
                    {q.type === 'drag_and_drop' && q.categories && (
                      <div className="space-y-3">
                        <DragAndDropCanvas
                          questionId={q.id}
                          categories={q.categories}
                          currentPlacements={
                            dragDropPlacements[q.id] ||
                            (existingAnswer?.answer as Record<string, string[]>) ||
                            {}
                          }
                          onPlacementsChange={(placements) =>
                            setDragDropPlacements((prev) => ({
                              ...prev,
                              [q.id]: placements,
                            }))
                          }
                          onSubmit={(placements) => {
                            if (!isQuestionEditLocked(q.id)) {
                              evaluateAndSubmit(q, placements);
                            }
                          }}
                          disabled={isInputDisabled}
                          isAnswered={isAnswered}
                          isFeedbackVisible={isFeedbackVisible}
                          canShowKey={canShowCorrectAnswer}
                          pointsEarned={existingAnswer?.pointsEarned || 0}
                          totalPoints={q.points || 10}
                        />
                      </div>
                    )}

                    {/* OPEN ENDED */}
                    {q.type === 'open_ended' && (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          disabled={isInputDisabled}
                          value={textAnswers[q.id] !== undefined ? textAnswers[q.id] : (existingAnswer?.answer || '')}
                          onChange={(e) =>
                            setTextAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Type your reflection or answer..."
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          disabled={isInputDisabled}
                          onClick={() => handleTextSubmit(q)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isAnswered ? 'Update Reflection' : 'Submit Reflection'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feedback Explanation Banner (shown immediately on submit) */}
                  {isFeedbackVisible && (() => {
                    const feedbackStatus = getQuestionFeedbackStatus(q, existingAnswer);
                    const closeEndedAnalysis = feedbackStatus.closeEndedAnalysis;

                    const hasSpecificExp =
                      q.explanationCorrect !== undefined || q.explanationIncorrect !== undefined;
                    const showBothExplanations =
                      (isWrongPractice && hasClickedShowAnswer) ||
                      (isLiveMode && !existingAnswer.isCorrect && hasTeacherRevealedKey);

                    const primaryExplanation = existingAnswer.isCorrect
                      ? (q.explanationCorrect || (!hasSpecificExp ? q.explanation : ''))
                      : (q.explanationIncorrect ||
                          (showBothExplanations ? q.explanationCorrect : '') ||
                          (!hasSpecificExp ? q.explanation : ''));

                    const secondaryCorrectExplanation =
                      showBothExplanations && q.explanationIncorrect && q.explanationCorrect
                        ? q.explanationCorrect
                        : '';

                    const showCloseEndedWordDiff = Boolean(
                      q.type === 'close_ended' &&
                        closeEndedAnalysis &&
                        !existingAnswer.isCorrect &&
                        closeEndedAnalysis.tokens.length > 0
                    );

                    const hasDetails = Boolean(
                      showCloseEndedWordDiff ||
                        primaryExplanation?.trim() ||
                        secondaryCorrectExplanation?.trim() ||
                        existingAnswer.aiFeedback
                    );

                    const bannerStyle =
                      feedbackStatus.statusLevel === 'correct'
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                        : feedbackStatus.statusLevel === 'almost'
                        ? 'bg-sky-50/90 border-sky-300 text-sky-950'
                        : 'bg-amber-50/90 border-amber-300 text-amber-950';

                    return (
                      <>
                        <div
                          className={`mt-3 p-3.5 rounded-xl border text-xs space-y-2.5 animate-in fade-in shadow-2xs ${bannerStyle}`}
                        >
                          <div
                            className={`font-bold flex items-center justify-between gap-2 ${
                              hasDetails ? 'border-b border-black/5 pb-2' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-sm">
                              {feedbackStatus.statusLevel === 'correct' ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                                  <span className="text-emerald-900 font-extrabold">
                                    {feedbackStatus.statusLabel}
                                  </span>
                                </>
                              ) : feedbackStatus.statusLevel === 'almost' ? (
                                <>
                                  <Sparkles className="w-4 h-4 text-sky-600 stroke-[2.5]" />
                                  <span className="text-sky-900 font-extrabold">
                                    {feedbackStatus.statusLabel}
                                  </span>
                                </>
                              ) : feedbackStatus.statusLevel === 'keep_going' ? (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                                  <span className="text-amber-900 font-extrabold">
                                    {feedbackStatus.statusLabel}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                                  <span className="text-rose-900 font-extrabold">
                                    {feedbackStatus.statusLabel}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-800">
                              +{existingAnswer.pointsEarned} pts
                            </span>
                          </div>

                          {/* Granular Word-by-Word Check for Fill-in-the-Blank */}
                          {showCloseEndedWordDiff && closeEndedAnalysis && (
                            <div className="space-y-1.5 pt-0.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Word-by-Word Check
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-white/90 border border-slate-200/80">
                                {closeEndedAnalysis.tokens.map((tok, tIdx) => (
                                  <span
                                    key={`${q.id}-diff-${tIdx}`}
                                    className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                                      tok.status === 'correct'
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : tok.status === 'misplaced'
                                        ? 'bg-sky-100 text-sky-900 border-sky-300'
                                        : tok.status === 'missing'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-rose-100 text-rose-900 border-rose-300'
                                    }`}
                                    title={
                                      tok.status === 'correct'
                                        ? 'Correct word & position'
                                        : tok.status === 'misplaced'
                                        ? 'Correct word, wrong location'
                                        : tok.status === 'missing'
                                        ? 'Missing word'
                                        : 'Incorrect word'
                                    }
                                  >
                                    {tok.text}
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-600 font-medium">
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>Correct</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                                  <span>Incorrect</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                                  <span>Wrong location</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-mono font-extrabold text-amber-800">*</span>
                                  <span>Missing word</span>
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Explanation (why wrong during retries, or answer explanation once revealed/correct) */}
                          {primaryExplanation && primaryExplanation.trim().length > 0 && (
                            <div className="space-y-0.5 pt-0.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Teacher Explanation:
                              </div>
                              <p className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                                {primaryExplanation}
                              </p>
                            </div>
                          )}

                          {secondaryCorrectExplanation && secondaryCorrectExplanation.trim().length > 0 && (
                            <div className="space-y-0.5 pt-1 border-t border-black/5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                Correct Answer Explanation:
                              </div>
                              <p className="text-xs text-emerald-950 leading-relaxed font-normal whitespace-pre-line">
                                {secondaryCorrectExplanation}
                              </p>
                            </div>
                          )}

                          {/* Optional AI Feedback for open-ended reflections */}
                          {existingAnswer.aiFeedback && (
                            <div className="p-2 bg-amber-100/60 border border-amber-300 rounded-lg text-xs space-y-0.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                                Teacher / AI Feedback:
                              </div>
                              <p className="text-amber-950 leading-relaxed">{existingAnswer.aiFeedback}</p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Key / Answer Breakdown (Displayed BELOW Correct / Needs Review box once Key is revealed) */}
                  {canShowCorrectAnswer && q.type === 'close_ended' && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 flex items-center justify-between gap-2 flex-wrap shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Key:{' '}
                          <strong className="font-mono text-sm underline decoration-emerald-500 font-bold">
                            {q.correctAnswer}
                          </strong>
                        </span>
                      </div>
                      {existingAnswer && !existingAnswer.isCorrect && (
                        <span className="text-[11px] text-rose-800 font-mono bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                          You typed: "{String(existingAnswer.answer)}"
                        </span>
                      )}
                    </div>
                  )}

                  {canShowCorrectAnswer && q.type === 'matching' && q.matchingPairs && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 space-y-1.5 shadow-2xs animate-in fade-in">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Key (Matching Pairs):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.matchingPairs.map((pair, pIdx) => (
                          <div
                            key={pIdx}
                            className="p-1.5 bg-white rounded border border-emerald-200 text-[11px] flex items-center justify-between gap-1 shadow-2xs"
                          >
                            <span className="font-semibold text-slate-800">{pair.left}</span>
                            <span className="text-emerald-600 font-bold">➔</span>
                            <span className="font-bold text-emerald-900">{pair.right}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canShowCorrectAnswer && q.type === 'drag_and_drop' && q.categories && (
                    <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 space-y-2 shadow-2xs animate-in fade-in">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Key (Category Breakdown):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="p-2 bg-white rounded-lg border border-emerald-200 shadow-2xs space-y-1"
                          >
                            <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide">
                              {cat.name}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {cat.items.map((item, iIdx) => (
                                <span
                                  key={iIdx}
                                  className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-semibold border border-emerald-200"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Practice Mode 3-Attempt "Show Answer" Control (below "Needs Review" box) */}
                  {isWrongPractice && !hasClickedShowAnswer && (
                    attempts >= 3 ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-amber-800 font-medium">
                          Attempted {attempts} times.
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedCorrectAnswers((prev) => ({
                              ...prev,
                              [q.id]: true,
                            }))
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Show Answer</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500 font-medium">
                        Attempt {attempts} of 3 · Try again to unlock "Show Answer".
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
