import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

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
    const chosen = Array.from(selectedChoices[question.id] || []);
    if (chosen.length === 0) return;
    evaluateAndSubmit(question, chosen);
  };

  const handleTextSubmit = (question: Question) => {
    const text = (textAnswers[question.id] || '').trim();
    if (!text) return;
    evaluateAndSubmit(question, text);
  };

  const handleMatchingPair = (question: Question, left: string, right: string) => {
    const current = { ...(matchingSelections[question.id] || {}) };
    current[left] = right;
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
        const isMatch =
          correctList.length === chosenList.length &&
          correctList.every((id) => chosenList.includes(id));
        isCorrect = isMatch;
      } else {
        const correct = question.correctAnswer || 'a';
        isCorrect = String(rawAnswer).toLowerCase() === correct.toLowerCase();
      }
    } else if (question.type === 'true_false') {
      const correct = question.correctAnswer || 'true';
      isCorrect = String(rawAnswer).toLowerCase() === correct.toLowerCase();
    } else if (question.type === 'close_ended') {
      const expected = (question.correctAnswer || '').trim().toLowerCase();
      const actual = String(rawAnswer).trim().toLowerCase();
      isCorrect = actual === expected;
    } else if (question.type === 'matching') {
      const pairs = question.matchingPairs || [];
      const userPairs = rawAnswer || {};
      const correctCount = pairs.filter((p) => userPairs[p.left] === p.right).length;
      isCorrect = correctCount === pairs.length;
      if (pairs.length > 0) {
        pointsEarned = Math.round((correctCount / pairs.length) * (question.points || 10));
      }
    } else if (question.type === 'open_ended') {
      isCorrect = true;
      pointsEarned = question.points || 10;
    }

    if (question.type !== 'matching') {
      pointsEarned = isCorrect ? question.points || 10 : 0;
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
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  // Group questions: Timed checkpoints and General questions
  const timedQuestions = questions.filter(
    (q) => typeof q.timestamp === 'number' && q.timestamp >= 0
  );
  const generalQuestions = questions.filter(
    (q) => q.timestamp === null || q.timestamp === undefined || q.timestamp < 0
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
        {questions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No questions added to this lesson yet.
          </div>
        ) : (
          questions.map((q, idx) => {
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
                            existingAnswer.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {existingAnswer.isCorrect ? (
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
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug mb-3">
                    {q.prompt}
                  </div>

                  {/* Interactive Question Input Components */}
                  <div className="space-y-2 text-xs">
                    {/* MULTIPLE CHOICE */}
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="space-y-1.5">
                        {q.allowMultipleAnswers && (
                          <div className="text-[10px] text-indigo-700 font-bold mb-1">
                            * Select all that apply, then click Submit
                          </div>
                        )}
                        {q.options.map((opt) => {
                          const isSelected = q.allowMultipleAnswers
                            ? selectedChoices[q.id]?.has(opt.id)
                            : existingAnswer?.answer === opt.id ||
                              selectedChoices[q.id]?.has(opt.id);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleChoiceClick(q, opt.id)}
                              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500 text-slate-950 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] bg-slate-100 text-slate-700 uppercase">
                                  {opt.id}
                                </span>
                                <span>{opt.text}</span>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-amber-700 shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        {q.allowMultipleAnswers && (
                          <button
                            type="button"
                            onClick={() => handleMultiSubmit(q)}
                            disabled={!selectedChoices[q.id] || selectedChoices[q.id].size === 0}
                            className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Submit Answer ({selectedChoices[q.id]?.size || 0} selected)
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
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleChoiceClick(q, val)}
                              className={`py-2 px-3 rounded-lg border font-bold capitalize transition-all cursor-pointer ${
                                isSelected
                                  ? val === 'true'
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-rose-600 text-white border-rose-700'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* CLOSE-ENDED / FILL IN THE BLANK */}
                    {q.type === 'close_ended' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
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
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleTextSubmit(q)}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                        >
                          Submit
                        </button>
                      </div>
                    )}

                    {/* MATCHING PAIRS */}
                    {q.type === 'matching' && q.matchingPairs && (
                      <div className="space-y-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Click a term on the left, then click its match on the right:
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            {q.matchingPairs.map((p) => {
                              const paired = matchingSelections[q.id]?.[p.left];
                              const isSelectedLeft = activeMatchingLeft[q.id] === p.left;
                              return (
                                <button
                                  key={p.left}
                                  type="button"
                                  onClick={() =>
                                    setActiveMatchingLeft((prev) => ({
                                      ...prev,
                                      [q.id]: p.left,
                                    }))
                                  }
                                  className={`w-full text-left p-1.5 rounded border text-[11px] transition-colors cursor-pointer ${
                                    isSelectedLeft
                                      ? 'bg-amber-200 border-amber-400 font-bold'
                                      : paired
                                      ? 'bg-slate-200/80 border-slate-300'
                                      : 'bg-white border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {p.left} {paired && `→ ${paired}`}
                                </button>
                              );
                            })}
                          </div>
                          <div className="space-y-1.5">
                            {q.matchingPairs.map((p) => (
                              <button
                                key={p.right}
                                type="button"
                                onClick={() => {
                                  const currentLeft = activeMatchingLeft[q.id];
                                  if (currentLeft) {
                                    handleMatchingPair(q, currentLeft, p.right);
                                  }
                                }}
                                className="w-full text-left p-1.5 rounded border text-[11px] bg-white border-slate-200 hover:bg-amber-50 cursor-pointer"
                              >
                                {p.right}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OPEN ENDED */}
                    {q.type === 'open_ended' && (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          value={textAnswers[q.id] !== undefined ? textAnswers[q.id] : (existingAnswer?.answer || '')}
                          onChange={(e) =>
                            setTextAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Type your reflection or answer..."
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleTextSubmit(q)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Submit Reflection
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feedback Explanation Banner (shown when answered or revealed by teacher) */}
                  {isFeedbackVisible && (
                    <div
                      className={`mt-3 p-2.5 rounded-lg border text-xs space-y-1 animate-in fade-in ${
                        existingAnswer.isCorrect
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-amber-50/80 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {existingAnswer.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Correct answer! (+{existingAnswer.pointsEarned} pts)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Needs review</span>
                          </>
                        )}
                      </div>

                      {q.explanation && (
                        <p className="text-[11px] text-slate-700 italic">
                          Explanation: {q.explanation}
                        </p>
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
