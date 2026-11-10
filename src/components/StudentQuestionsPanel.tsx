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
} from 'lucide-react';
import { MatchingPairsCanvas } from './MatchingPairsCanvas';
import { playSuccessChime, playWrongAnswerSound } from '../utils/soundEffects';

interface StudentQuestionsPanelProps {
  questions: Question[];
  currentActiveQuestionId: string | null;
  answers: Record<string, StudentAnswer>;
  onAnswerSubmit: (answer: StudentAnswer) => void;
  onRewind?: (seconds: number) => void;
  onSeek?: (timestamp: number) => void;
  onContinueWatching?: () => void;
  isLiveMode?: boolean;
  revealedFeedbackForQuestionId?: string | null;
  allowRewind?: boolean;
  allowEditAnswer?: boolean;
}

export const StudentQuestionsPanel: React.FC<StudentQuestionsPanelProps> = ({
  questions,
  currentActiveQuestionId,
  answers,
  onAnswerSubmit,
  onRewind,
  onSeek,
  onContinueWatching,
  isLiveMode = false,
  revealedFeedbackForQuestionId = null,
  allowRewind = true,
  allowEditAnswer = true,
}) => {
  // Local pending states for non-submitted inputs
  const [selectedChoices, setSelectedChoices] = useState<Record<string, Set<string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [matchingSelections, setMatchingSelections] = useState<Record<string, Record<string, string>>>({});
  const [activeMatchingLeft, setActiveMatchingLeft] = useState<Record<string, string | null>>({});

  const questionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll to active question when it triggers
  useEffect(() => {
    if (currentActiveQuestionId && questionCardRefs.current[currentActiveQuestionId]) {
      questionCardRefs.current[currentActiveQuestionId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentActiveQuestionId]);

  const formatSec = (seconds?: number | null) => {
    if (seconds === undefined || seconds === null || seconds < 0) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleChoiceClick = (question: Question, optionId: string) => {
    if (answers[question.id] && !allowEditAnswer) return;
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
    if (answers[question.id] && !allowEditAnswer) return;
    const chosen = Array.from(selectedChoices[question.id] || []);
    if (chosen.length === 0) return;
    evaluateAndSubmit(question, chosen);
  };

  const handleTextSubmit = (question: Question) => {
    if (answers[question.id] && !allowEditAnswer) return;
    const text = (textAnswers[question.id] || '').trim();
    if (!text) return;
    evaluateAndSubmit(question, text);
  };

  const handleMatchingPair = (question: Question, left: string, right: string) => {
    if (answers[question.id] && !allowEditAnswer) return;
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

  const getFormattedCorrectAnswer = (q: Question) => {
    if (q.type === 'multiple_choice' && q.options) {
      const expectedList = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []);
      const matched = q.options.filter(
        (o) => expectedList.includes(o.id) || expectedList.includes(o.text)
      );
      if (matched.length > 0) {
        return matched.map((m) => `Option ${m.id.toUpperCase()}: "${m.text}"`).join(' and ');
      }
      return `Option ${(q.correctAnswer || 'A').toUpperCase()}`;
    }
    if (q.type === 'true_false') {
      return String(q.correctAnswer || 'true').toUpperCase();
    }
    if (q.type === 'close_ended') {
      return `"${q.correctAnswer || ''}"`;
    }
    if (q.type === 'matching' && q.matchingPairs) {
      return q.matchingPairs.map((p) => `${p.left} ➔ ${p.right}`).join(' | ');
    }
    return q.correctAnswer || 'Model response';
  };

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
            const isFeedbackVisible =
              isAnswered && (!isLiveMode || revealedFeedbackForQuestionId === q.id);

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

                  {/* Answer Status / Edit Permission Notice */}
                  {isAnswered && (
                    <div className="flex items-center gap-1.5 text-[11px] mb-2.5 font-medium">
                      {!allowEditAnswer ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Answer submitted (Editing locked by teacher)</span>
                        </span>
                      ) : isLiveMode ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg">
                          <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Answer submitted (Editing allowed · Click to update your answer)</span>
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
                            ? selectedChoices[q.id]?.has(opt.id)
                            : existingAnswer?.answer === opt.id ||
                              selectedChoices[q.id]?.has(opt.id);

                          const expectedList = q.correctAnswers || (q.correctAnswer ? [q.correctAnswer] : []);
                          const isOptCorrect = expectedList.includes(opt.id) || expectedList.includes(opt.text);

                          let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                          if (isSelected) {
                            buttonStyle = 'bg-amber-500/15 border-amber-500 text-slate-950 font-semibold';
                          }

                          if (isFeedbackVisible) {
                            if (isOptCorrect) {
                              buttonStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-400/40 shadow-2xs';
                            } else if (isSelected && !isOptCorrect) {
                              buttonStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                            } else {
                              buttonStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          }

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isAnswered && !allowEditAnswer}
                              onClick={() => handleChoiceClick(q, opt.id)}
                              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                                isAnswered && !allowEditAnswer ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${buttonStyle}`}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 uppercase ${
                                    isFeedbackVisible && isOptCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : isFeedbackVisible && isSelected && !isOptCorrect
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
                              {isFeedbackVisible ? (
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
                              ) : (
                                isSelected && <Check className="w-4 h-4 text-amber-700 shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        {q.allowMultipleAnswers && (
                          <button
                            type="button"
                            onClick={() => handleMultiSubmit(q)}
                            disabled={(!selectedChoices[q.id] || selectedChoices[q.id].size === 0) || (isAnswered && !allowEditAnswer)}
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

                          if (isFeedbackVisible) {
                            if (isThisCorrect) {
                              tfStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-400/40 shadow-2xs';
                            } else if (isSelected && !isThisCorrect) {
                              tfStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950 font-medium';
                            } else {
                              tfStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          }

                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={isAnswered && !allowEditAnswer}
                              onClick={() => handleChoiceClick(q, val)}
                              className={`py-2 px-3 rounded-lg border font-bold capitalize transition-all flex items-center justify-between ${
                                isAnswered && !allowEditAnswer ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${tfStyle}`}
                            >
                              <span>{val}</span>
                              {isFeedbackVisible && isThisCorrect && (
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
                            disabled={isAnswered && !allowEditAnswer}
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
                          <button
                            type="button"
                            disabled={isAnswered && !allowEditAnswer}
                            onClick={() => handleTextSubmit(q)}
                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {isAnswered ? 'Update' : 'Submit'}
                          </button>
                        </div>

                        {/* When feedback is visible, show correct expected text */}
                        {isFeedbackVisible && (
                          <div className="p-2.5 rounded-lg bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Correct Answer: <strong className="font-mono text-sm underline decoration-emerald-500 font-bold">{q.correctAnswer}</strong></span>
                            </div>
                            {existingAnswer && !existingAnswer.isCorrect && (
                              <span className="text-[11px] text-rose-800 font-mono bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                You typed: "{String(existingAnswer.answer)}"
                              </span>
                            )}
                          </div>
                        )}
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
                          disabled={isAnswered && !allowEditAnswer}
                          isFeedbackVisible={isFeedbackVisible}
                        />

                        {/* When feedback is visible, display correct matching key */}
                        {isFeedbackVisible && (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 space-y-1.5 shadow-2xs">
                            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Correct Matching Pairs:</span>
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
                      </div>
                    )}

                    {/* OPEN ENDED */}
                    {q.type === 'open_ended' && (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          disabled={isAnswered && !allowEditAnswer}
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
                          disabled={isAnswered && !allowEditAnswer}
                          onClick={() => handleTextSubmit(q)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isAnswered ? 'Update Reflection' : 'Submit Reflection'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feedback Explanation Banner (shown when answered or revealed by teacher) */}
                  {isFeedbackVisible && (
                    <div
                      className={`mt-3 p-3.5 rounded-xl border text-xs space-y-2.5 animate-in fade-in shadow-2xs ${
                        existingAnswer.isCorrect
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                          : 'bg-amber-50/90 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between gap-2 border-b border-black/5 pb-2">
                        <div className="flex items-center gap-1.5 text-sm">
                          {existingAnswer.isCorrect ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                              <span className="text-emerald-900 font-extrabold">Correct Answer!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                              <span className="text-rose-900 font-extrabold">Needs Review</span>
                            </>
                          )}
                        </div>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-800">
                          +{existingAnswer.pointsEarned} pts
                        </span>
                      </div>

                      {/* Prominent Correct Answer Display */}
                      <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-300 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          <span>Correct Answer:</span>
                        </div>
                        <div className="text-xs font-bold text-emerald-950 leading-relaxed">
                          {getFormattedCorrectAnswer(q)}
                        </div>
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="space-y-0.5 pt-0.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Teacher Explanation:
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed font-normal">
                            {q.explanation}
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
